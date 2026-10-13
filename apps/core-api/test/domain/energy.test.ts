import { describe, expect, it } from "vitest";
import { kwhToday, localDate } from "../../src/domain/energy.ts";

describe("kWh today", () => {
  it("localDate is the process-local calendar date (TZ=UTC in tests)", () => {
    expect(localDate(new Date("2026-10-05T23:59:59Z"))).toBe("2026-10-05");
    expect(localDate(new Date("2026-10-06T00:00:00Z"))).toBe("2026-10-06");
  });
  it.each([
    [null, 412.67, "2026-10-05", { date: "2026-10-05", kwh_total: 412.67 }, 0],
    [{ date: "2026-10-05", kwh_total: 412.67 }, 414.51, "2026-10-05", { date: "2026-10-05", kwh_total: 412.67 }, 1.84],
    [{ date: "2026-10-04", kwh_total: 400 }, 414.51, "2026-10-05", { date: "2026-10-05", kwh_total: 414.51 }, 0],
    [{ date: "2026-10-05", kwh_total: 412.67 }, 2, "2026-10-05", { date: "2026-10-05", kwh_total: 2 }, 0], // meter reset
  ])("baseline %j, total %d on %s", (baseline, total, date, expectedBaseline, expected) => {
    expect(kwhToday(baseline, total, date)).toEqual({ baseline: expectedBaseline, kwhToday: expected });
  });
});
