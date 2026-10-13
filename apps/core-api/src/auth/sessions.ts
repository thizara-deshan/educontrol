import { randomBytes } from "node:crypto";
import {
  AccessLevel, ClientLabel, ClientSession, ClientType, type AccessLevel as Access, type ClientLabel as Label,
  type ClientType as Type,
} from "@eduscope/contracts";
import { and, eq, isNotNull, lt, lte, ne } from "drizzle-orm";
import type { Clock } from "../clock.ts";
import type { Db } from "../db/client.ts";
import type { EventLogger } from "../db/event-log.ts";
import { sessions } from "../db/schema.ts";
import { baselineAccess, expiresAt, hasAccess, rowMatches, VIEW_ROW_TTL_MS } from "../domain/session-rules.ts";

// ARCHITECTURE §5 sessions (D-07): a `sessions` row per browser, cookie = row id, `public_id` is
// what other clients may see. Expiry is checked on every request and by a 15 s sweep.

export type SessionRow = typeof sessions.$inferSelect;

/** Who is asking, after cookie, kiosk exemption and expiry are applied. */
export interface ResolvedClient {
  row: SessionRow | null;
  clientType: Type;
  access: Access;
  label: Label;
  ip: string;
}

export interface SessionService {
  resolve(cookieId: string | null, ip: string, kiosk: boolean): ResolvedClient;
  /** Gives the client a row (and a cookie to set) if it has none. */
  ensure(client: ResolvedClient): { client: ResolvedClient & { row: SessionRow }; newCookieId: string | null };
  login(client: ResolvedClient & { row: SessionRow }, level: "control" | "technician", label: Label): ClientSession;
  lock(client: ResolvedClient & { row: SessionRow }): ClientSession;
  /** An authorised mutation: resets the idle timer (§5 "Activity"). */
  touch(client: ResolvedClient): void;
  /** WS `hello`: a remote browser names its form factor (Q19). */
  setLabel(publicId: string, label: Label): void;
  /** Ends idle sessions (pushes `session`) and drops old view rows. */
  sweep(): void;
  toClientSession(client: ResolvedClient & { row: SessionRow }): ClientSession;
}

const DEFAULT_REMOTE_LABEL: Label = "laptop";

export function createSessionService(deps: {
  db: Db;
  clock: Clock;
  log: EventLogger;
  /** A session changed without the client asking (expiry, lock/login from another tab): push it. */
  onChange: (session: ClientSession) => void;
}): SessionService {
  const { db, clock } = deps;
  const nowIso = (): string => clock.now().toISOString();

  const toClientSession = (row: SessionRow): ClientSession =>
    ClientSession.parse({
      public_id: row.public_id, client_type: row.client_type, label: row.label, access: row.access,
      unlocked_at: row.unlocked_at, last_activity: row.last_activity, expires_at: row.expires_at,
    });

  const reload = (id: string): SessionRow => {
    const row = db.select().from(sessions).where(eq(sessions.id, id)).get();
    if (row === undefined) throw new Error("session row vanished");
    return row;
  };

  /** Drops an unlocked row back to its baseline (expiry, lock). */
  const downgrade = (row: SessionRow, reason: string): SessionRow => {
    const clientType = ClientType.parse(row.client_type);
    db.update(sessions)
      .set({ access: baselineAccess(clientType), unlocked_at: null, last_activity: null, expires_at: null })
      .where(eq(sessions.id, row.id))
      .run();
    deps.log({ type: "session", actor: row.label, public_id: row.public_id, subject: reason, result: baselineAccess(clientType) });
    return reload(row.id);
  };

  const fromRow = (row: SessionRow, ip: string): ResolvedClient => ({
    row, ip, clientType: ClientType.parse(row.client_type), access: AccessLevel.parse(row.access), label: ClientLabel.parse(row.label),
  });

  return {
    resolve(cookieId, ip, kiosk) {
      const clientType: Type = kiosk ? "kiosk" : "remote";
      let row = cookieId === null ? undefined : db.select().from(sessions).where(eq(sessions.id, cookieId)).get();
      if (row !== undefined && !rowMatches(ClientType.parse(row.client_type), kiosk)) row = undefined; // kiosk row off-loopback
      if (row !== undefined && row.expires_at !== null && Date.parse(row.expires_at) <= clock.now().getTime()) {
        row = downgrade(row, "expired");
        deps.onChange(toClientSession(row));
      }
      if (row !== undefined) return fromRow(row, ip);
      return { row: null, ip, clientType, access: baselineAccess(clientType), label: kiosk ? "room screen" : DEFAULT_REMOTE_LABEL };
    },
    ensure(client) {
      if (client.row !== null) return { client: { ...client, row: client.row }, newCookieId: null };
      const id = randomBytes(32).toString("base64url");
      db.insert(sessions)
        .values({
          id, public_id: randomBytes(9).toString("base64url"), access: client.access, client_type: client.clientType,
          label: client.label, ip: client.ip, created_at: nowIso(), unlocked_at: null, last_activity: null, expires_at: null,
        })
        .run();
      const row = reload(id);
      return { client: { ...fromRow(row, client.ip), row }, newCookieId: id };
    },
    login(client, level, label) {
      const now = clock.now();
      const access: Access = hasAccess(client.access, level) ? client.access : level;
      const expires = expiresAt(access, client.clientType, now);
      db.update(sessions)
        .set({
          access, label: client.clientType === "kiosk" ? "room screen" : label, ip: client.ip,
          unlocked_at: now.toISOString(), last_activity: now.toISOString(), expires_at: expires === null ? null : expires.toISOString(),
        })
        .where(eq(sessions.id, client.row.id))
        .run();
      const session = toClientSession(reload(client.row.id));
      deps.log({ type: "session", actor: session.label, public_id: session.public_id, subject: "login", result: access });
      deps.onChange(session);
      return session;
    },
    lock(client) {
      const session = toClientSession(downgrade(client.row, "lock"));
      deps.onChange(session);
      return session;
    },
    touch(client) {
      if (client.row === null || client.access === baselineAccess(client.clientType)) return;
      const now = clock.now();
      const expires = expiresAt(client.access, client.clientType, now);
      db.update(sessions)
        .set({ last_activity: now.toISOString(), expires_at: expires === null ? null : expires.toISOString() })
        .where(eq(sessions.id, client.row.id))
        .run();
    },
    setLabel(publicId, label) {
      db.update(sessions).set({ label }).where(and(eq(sessions.public_id, publicId), eq(sessions.client_type, "remote"))).run();
    },
    sweep() {
      const now = nowIso();
      const expired = db
        .select()
        .from(sessions)
        .where(and(isNotNull(sessions.expires_at), lte(sessions.expires_at, now), ne(sessions.access, "view")))
        .all();
      for (const row of expired) deps.onChange(toClientSession(downgrade(row, "expired")));
      const cutoff = new Date(clock.now().getTime() - VIEW_ROW_TTL_MS).toISOString();
      db.delete(sessions).where(and(eq(sessions.access, "view"), lt(sessions.created_at, cutoff))).run();
    },
    toClientSession: (client) => toClientSession(client.row),
  };
}
