import { lt } from "drizzle-orm";
import type { Clock } from "../clock.ts";
import type { Db } from "./client.ts";
import { eventLog } from "./schema.ts";

// ARCHITECTURE §6.2 `event_log`: commands, by-hand changes, sessions, PIN failures, hw up/down.
// Kept 30 days; the scheduler prunes older rows once a day.

export const EVENT_LOG_RETENTION_MS = 30 * 24 * 60 * 60_000;

export interface LogEntry {
  type: "command" | "state" | "session" | "pin_failure" | "hw" | "system";
  actor?: string | null;
  public_id?: string | null;
  subject?: string | null;
  payload?: unknown;
  result?: string | null;
}

export type EventLogger = (entry: LogEntry) => void;

export function createEventLogger(db: Db, clock: Clock): EventLogger {
  return (entry) => {
    db.insert(eventLog)
      .values({
        at: clock.now().toISOString(),
        type: entry.type,
        actor: entry.actor ?? null,
        public_id: entry.public_id ?? null,
        subject: entry.subject ?? null,
        payload: entry.payload === undefined ? null : JSON.stringify(entry.payload),
        result: entry.result ?? null,
      })
      .run();
  };
}

/** Deletes rows older than the retention; returns how many went. */
export function pruneEventLog(db: Db, now: Date): number {
  const cutoff = new Date(now.getTime() - EVENT_LOG_RETENTION_MS).toISOString();
  return db.delete(eventLog).where(lt(eventLog.at, cutoff)).run().changes;
}
