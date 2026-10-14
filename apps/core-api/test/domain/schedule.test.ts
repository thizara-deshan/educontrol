import type { ClassBlock, TimedAction } from "@eduscope/contracts";
import { describe, expect, it } from "vitest";
import { dueActions, endedBlocks, occurrences, tickWindow, weekdayOf } from "../../src/domain/schedule.ts";

// vitest.config.ts runs with TZ=UTC, so local time = the ISO strings below. 2026-10-05 is a Monday.

const at = (iso: string): Date => new Date(iso);
const action = (time: string, days: TimedAction["days"], enabled = true): TimedAction => ({
  id: `${time}-${days.join("")}`, name: "Lights off", time, days, enabled, steps: [{ kind: "lights.set", gang: "rear", on: false }],
});
const block = (end: string, days: ClassBlock["days"]): ClassBlock => ({ id: end, days, start: "00:00", end });

describe("scheduler due-calculation", () => {
  it("knows the weekday", () => {
    expect(weekdayOf(at("2026-10-05T10:42:00Z"))).toBe("mon");
    expect(weekdayOf(at("2026-10-11T23:59:59Z"))).toBe("sun");
  });

  it("minute boundary: due once, in the tick that crosses HH:MM:00", () => {
    const actions = [action("18:00", ["mon"])];
    expect(dueActions(actions, at("2026-10-05T17:59:30Z"), at("2026-10-05T18:00:00Z"))).toEqual(actions);
    expect(dueActions(actions, at("2026-10-05T18:00:00Z"), at("2026-10-05T18:00:30Z"))).toEqual([]); // not twice
    expect(dueActions(actions, at("2026-10-05T17:59:00Z"), at("2026-10-05T17:59:59Z"))).toEqual([]);
  });

  it("days: only on the listed weekdays", () => {
    const weekdays = action("18:00", ["mon", "tue", "wed", "thu", "fri"]);
    const sunday = action("18:00", ["sun"]);
    expect(dueActions([weekdays, sunday], at("2026-10-05T17:59:45Z"), at("2026-10-05T18:00:15Z"))).toEqual([weekdays]);
    expect(dueActions([weekdays, sunday], at("2026-10-11T17:59:45Z"), at("2026-10-11T18:00:15Z"))).toEqual([sunday]);
  });

  it("midnight: 00:00 belongs to the new day; 23:59 to the old one", () => {
    const tuesdayMidnight = action("00:00", ["tue"]);
    const mondayLate = action("23:59", ["mon"]);
    const from = at("2026-10-05T23:59:45Z");
    const to = at("2026-10-06T00:00:15Z");
    expect(dueActions([tuesdayMidnight, mondayLate], from, to)).toEqual([tuesdayMidnight]);
    expect(occurrences(["mon"], "23:59", at("2026-10-05T23:58:50Z"), at("2026-10-06T00:00:10Z"))).toEqual([at("2026-10-05T23:59:00Z")]);
  });

  it("a disabled action never runs", () => {
    expect(dueActions([action("18:00", ["mon"], false)], at("2026-10-05T17:59:30Z"), at("2026-10-05T18:00:00Z"))).toEqual([]);
  });

  it("a long gap catches up at most 5 minutes", () => {
    const window = tickWindow(at("2026-10-05T12:00:00Z"), at("2026-10-05T18:00:30Z"));
    expect(window).toEqual({ from: at("2026-10-05T17:55:30Z"), to: at("2026-10-05T18:00:30Z") });
    expect(dueActions([action("15:00", ["mon"])], window.from, window.to)).toEqual([]);
    expect(tickWindow(at("2026-10-05T18:00:00Z"), at("2026-10-05T18:00:30Z")).from).toEqual(at("2026-10-05T18:00:00Z"));
  });

  it("class-block end: due on its days at its end time", () => {
    const morning = block("10:00", ["mon", "wed"]);
    expect(endedBlocks([morning], at("2026-10-05T09:59:45Z"), at("2026-10-05T10:00:15Z"))).toEqual([morning]);
    expect(endedBlocks([morning], at("2026-10-06T09:59:45Z"), at("2026-10-06T10:00:15Z"))).toEqual([]);
  });
});
