import { describe, expect, it } from "vitest";
import { kwhToday, localDate, rollKwhBaseline } from "../../src/domain/energy.ts";
import { applyPowerReading } from "../../src/domain/projector.ts";
import { bootModel, T0 } from "../helpers.ts";

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

describe("midnight baseline", () => {
  const reading = { watts: 287, volts: 230, energy_kwh_total: 414.51 };
  const morning = applyPowerReading(bootModel({ kwhBaseline: { date: "2026-10-05", kwh_total: 412.67 } }), reading, T0);

  it("same day: nothing changes", () => {
    expect(rollKwhBaseline(morning, new Date("2026-10-05T23:59:59Z"))).toBe(morning);
  });

  it("a new day: the last total is the baseline and TODAY reads 0", () => {
    expect(morning.state.display.projector.power.value?.kwh_today).toBe(1.84);
    const next = rollKwhBaseline(morning, new Date("2026-10-06T00:00:10Z"));
    expect(next.facts.kwh_baseline).toEqual({ date: "2026-10-06", kwh_total: 414.51 });
    expect(next.state.display.projector.power.value).toMatchObject({ watts: 287, kwh_today: 0 });
  });

  it("no meter total yet: nothing to roll", () => {
    const boot = bootModel();
    expect(rollKwhBaseline(boot, new Date("2026-10-06T00:00:10Z"))).toBe(boot);
  });
});
