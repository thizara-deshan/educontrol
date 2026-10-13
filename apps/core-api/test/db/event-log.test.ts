import { describe, expect, it } from "vitest";
import { fixedClock } from "../../src/clock.ts";
import { openDb } from "../../src/db/client.ts";
import { createEventLogger } from "../../src/db/event-log.ts";
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
