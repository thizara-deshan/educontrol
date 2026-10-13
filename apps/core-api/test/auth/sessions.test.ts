import type { ClientSession } from "@eduscope/contracts";
import { describe, expect, it } from "vitest";
import { createSessionService } from "../../src/auth/sessions.ts";
import { fixedClock } from "../../src/clock.ts";
import { openDb } from "../../src/db/client.ts";
import type { LogEntry } from "../../src/db/event-log.ts";
import { sessions as sessionsTable } from "../../src/db/schema.ts";
import { T0 } from "../helpers.ts";

function service() {
  const { db } = openDb(":memory:");
  const clock = fixedClock(T0);
  const pushed: ClientSession[] = [];
  const logs: LogEntry[] = [];
  const sessions = createSessionService({ db, clock, log: (entry) => logs.push(entry), onChange: (s) => pushed.push(s) });
  return { db, clock, pushed, logs, sessions };
}

const PHONE_IP = "192.168.1.50";

describe("session service", () => {
  it("no cookie: remote → view, kiosk → control (no row yet)", () => {
    const { sessions } = service();
    expect(sessions.resolve(null, PHONE_IP, false)).toEqual({ row: null, ip: PHONE_IP, clientType: "remote", access: "view", label: "laptop" });
    expect(sessions.resolve(null, "127.0.0.1", true)).toMatchObject({ row: null, clientType: "kiosk", access: "control", label: "room screen" });
  });

  it("ensure creates one row and a cookie id; the cookie resolves back to it", () => {
    const { sessions, db } = service();
    const { client, newCookieId } = sessions.ensure(sessions.resolve(null, PHONE_IP, false));
    expect(newCookieId).toMatch(/^[\w-]{43}$/);
    expect(client.row.public_id).not.toBe(newCookieId);
    expect(sessions.ensure(client).newCookieId).toBeNull();
    expect(sessions.resolve(newCookieId, PHONE_IP, false).row?.id).toBe(newCookieId);
    expect(db.select().from(sessionsTable).all()).toHaveLength(1);
  });

  it("login sets access, label, unlock time and the idle expiry, and pushes it", () => {
    const { sessions, pushed, logs } = service();
    const { client } = sessions.ensure(sessions.resolve(null, PHONE_IP, false));
    const session = sessions.login(client, "control", "phone");
    expect(session).toMatchObject({ client_type: "remote", label: "phone", access: "control", unlocked_at: T0, last_activity: T0, expires_at: "2026-10-05T12:42:00.000Z" });
    expect(pushed).toEqual([session]);
    expect(logs).toEqual([expect.objectContaining({ type: "session", subject: "login", result: "control" })]);
  });

  it("a room PIN never lowers a technician session; the kiosk keeps its label", () => {
    const { sessions } = service();
    const remote = sessions.ensure(sessions.resolve(null, PHONE_IP, false)).client;
    sessions.login(remote, "technician", "laptop");
    const again = sessions.resolve(remote.row.id, PHONE_IP, false);
    expect(sessions.login({ ...again, row: remote.row }, "control", "laptop").access).toBe("technician");
    const kiosk = sessions.ensure(sessions.resolve(null, "127.0.0.1", true)).client;
    expect(sessions.login(kiosk, "technician", "phone")).toMatchObject({ label: "room screen", expires_at: "2026-10-05T10:44:00.000Z" });
  });

  it("an expired session is downgraded on the next request and pushed", () => {
    const { sessions, clock, pushed } = service();
    const { client, newCookieId } = sessions.ensure(sessions.resolve(null, PHONE_IP, false));
    sessions.login(client, "technician", "laptop");
    clock.advance(15 * 60_000);
    expect(sessions.resolve(newCookieId, PHONE_IP, false)).toMatchObject({ access: "view" });
    expect(pushed.at(-1)).toMatchObject({ access: "view", expires_at: null });
  });

  it("touch resets the idle timer; lock drops to the baseline", () => {
    const { sessions, clock } = service();
    const { client, newCookieId } = sessions.ensure(sessions.resolve(null, PHONE_IP, false));
    sessions.login(client, "control", "phone");
    clock.advance(60 * 60_000);
    sessions.touch(sessions.resolve(newCookieId, PHONE_IP, false));
    clock.advance(90 * 60_000);
    const live = sessions.resolve(newCookieId, PHONE_IP, false);
    expect(live.access).toBe("control");
    expect(live.row?.expires_at).toBe("2026-10-05T13:42:00.000Z");
  });

  it("a kiosk row is ignored from a LAN address (and a remote row from the kiosk)", () => {
    const { sessions } = service();
    const { newCookieId } = sessions.ensure(sessions.resolve(null, "127.0.0.1", true));
    expect(sessions.resolve(newCookieId, PHONE_IP, false)).toMatchObject({ row: null, clientType: "remote", access: "view" });
  });

  it("hello labels only remote rows; the sweep ends idle sessions and drops week-old view rows", () => {
    const { sessions, clock, pushed, db } = service();
    const viewer = sessions.ensure(sessions.resolve(null, "192.168.1.60", false)).client;
    sessions.setLabel(viewer.row.public_id, "tablet");
    const unlocked = sessions.ensure(sessions.resolve(null, PHONE_IP, false)).client;
    sessions.login(unlocked, "control", "phone");
    clock.advance(2 * 60 * 60_000);
    sessions.sweep();
    expect(pushed.at(-1)).toMatchObject({ public_id: unlocked.row.public_id, access: "view" });
    expect(sessions.resolve(viewer.row.id, "192.168.1.60", false).label).toBe("tablet");
    clock.advance(7 * 24 * 60 * 60_000);
    sessions.sweep();
    expect(db.select().from(sessionsTable).all()).toHaveLength(0);
  });
});
