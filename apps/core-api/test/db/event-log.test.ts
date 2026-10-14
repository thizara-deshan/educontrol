import { describe, expect, it } from "vitest";
import { fixedClock } from "../../src/clock.ts";
import { openDb } from "../../src/db/client.ts";
import { createEventLogger, pruneEventLog } from "../../src/db/event-log.ts";
import { eventLog } from "../../src/db/schema.ts";
import { T0 } from "../helpers.ts";

describe("event log", () => {
  it("writes one row per entry, stamped with the clock, payload as JSON", () => {
    const { db } = openDb(":memory:");
    const log = createEventLogger(db, fixedClock(T0));
    log({ type: "command", actor: "phone", public_id: "p1", subject: "lights.set", payload: { gang: "rear" }, result: "confirmed" });
    log({ type: "hw", subject: "link", result: "down" });
    expect(db.select().from(eventLog).all()).toEqual([
      { id: 1, at: T0, type: "command", actor: "phone", public_id: "p1", subject: "lights.set", payload: '{"gang":"rear"}', result: "confirmed" },
      { id: 2, at: T0, type: "hw", actor: null, public_id: null, subject: "link", payload: null, result: "down" },
    ]);
  });
});

describe("event log retention", () => {
  it("prunes rows older than 30 days, keeps the rest", () => {
    const { db } = openDb(":memory:");
    const clock = fixedClock("2026-09-05T10:41:59.000Z");
    const log = createEventLogger(db, clock);
    log({ type: "system", subject: "old" });
    clock.set("2026-09-05T10:42:01.000Z");
    log({ type: "system", subject: "kept" });
    expect(pruneEventLog(db, new Date(T0))).toBe(1);
    expect(db.select().from(eventLog).all().map((row) => row.subject)).toEqual(["kept"]);
  });
});
