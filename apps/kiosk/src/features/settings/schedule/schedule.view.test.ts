import type { TimedAction } from "@eduscope/contracts";
import { describe, expect, it } from "vitest";
import { actionRows, blockRows, formatDays, withEnabled } from "./schedule.view";

describe("formatDays", () => {
  it.each<[Parameters<typeof formatDays>[0], string]>([
    [["mon", "tue", "wed", "thu", "fri", "sat", "sun"], "every day"],
    [["fri", "mon", "tue", "wed", "thu"], "weekdays"],
    [["sun", "sat"], "weekends"],
    [["mon", "tue", "wed", "thu"], "Mon–Thu"],
    [["mon", "wed"], "Mon, Wed"],
    [["wed"], "Wed"],
  ])("%j → %s", (days, text) => {
    expect(formatDays(days)).toBe(text);
  });
});

const allOff: TimedAction = {
  id: "act-1", name: "All off", time: "18:00", days: ["mon", "tue", "wed", "thu", "fri"], enabled: true,
  steps: [{ kind: "ac.power", on: false }],
};

describe("rows", () => {
  it("blocks by first day then start", () => {
    expect(blockRows([
      { id: "b", days: ["mon", "wed"], start: "13:00", end: "15:00" },
      { id: "c", days: ["tue"], start: "08:00", end: "09:00" },
      { id: "a", days: ["mon", "tue", "wed", "thu", "fri"], start: "08:00", end: "10:00" },
    ])).toEqual([
      { id: "a", time: "08:00–10:00", days: "weekdays" },
      { id: "b", time: "13:00–15:00", days: "Mon, Wed" },
      { id: "c", time: "08:00–09:00", days: "Tue" },
    ]);
  });
  it("actions read 'All off · 18:00 weekdays' (SPEC S3c)", () => {
    expect(actionRows([allOff])[0]).toMatchObject({ id: "act-1", label: "All off · 18:00 weekdays", enabled: true });
  });
  it("withEnabled builds the PUT body without the id", () => {
    expect(withEnabled(allOff, false)).toEqual({ name: "All off", time: "18:00", days: allOff.days, enabled: false, steps: allOff.steps });
  });
});
