import type { TimedActionInput } from "@eduscope/contracts";
import { describe, expect, it } from "vitest";
import { openDb } from "../../src/db/client.ts";
import { createAction, createBlock, deleteAction, deleteBlock, loadSchedule, updateAction, updateBlock } from "../../src/db/schedule.ts";

const ALL_OFF: TimedActionInput = {
  name: "All off", time: "18:00", days: ["mon", "tue", "wed", "thu", "fri"], enabled: true,
  steps: [{ kind: "lights.set", gang: "front", on: false }, { kind: "ac.power", on: false }],
};

describe("schedule records", () => {
  it("round-trips blocks and actions, sorted by time", () => {
    const { db } = openDb(":memory:");
    createBlock(db, "b2", { days: ["mon"], start: "10:15", end: "12:15" });
    createBlock(db, "b1", { days: ["mon", "wed"], start: "08:00", end: "10:00" });
    const action = createAction(db, "a1", ALL_OFF);
    expect(action).toEqual({ id: "a1", ...ALL_OFF });
    expect(loadSchedule(db)).toEqual({
      class_blocks: [
        { id: "b1", days: ["mon", "wed"], start: "08:00", end: "10:00" },
        { id: "b2", days: ["mon"], start: "10:15", end: "12:15" },
      ],
      actions: [{ id: "a1", ...ALL_OFF }],
    });
  });

  it("updates and deletes; unknown ids answer null / false", () => {
    const { db } = openDb(":memory:");
    createBlock(db, "b1", { days: ["mon"], start: "08:00", end: "10:00" });
    createAction(db, "a1", ALL_OFF);
    expect(updateBlock(db, "b1", { days: ["fri"], start: "09:00", end: "11:00" })).toEqual({ id: "b1", days: ["fri"], start: "09:00", end: "11:00" });
    expect(updateAction(db, "a1", { ...ALL_OFF, enabled: false })?.enabled).toBe(false);
    expect(updateBlock(db, "nope", { days: ["fri"], start: "09:00", end: "11:00" })).toBeNull();
    expect(deleteBlock(db, "b1")).toBe(true);
    expect(deleteAction(db, "a1")).toBe(true);
    expect(deleteAction(db, "a1")).toBe(false);
    expect(loadSchedule(db)).toEqual({ class_blocks: [], actions: [] });
  });
});
