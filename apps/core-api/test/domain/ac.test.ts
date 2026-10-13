import type { AcState } from "@eduscope/contracts";
import { describe, expect, it } from "vitest";
import { acSent, powerOnSetpoint, stepTarget } from "../../src/domain/ac.ts";
import { unknown } from "../../src/domain/observed.ts";
import { T0 } from "../helpers.ts";

function ac(power: "on" | "off" | null, setpoint: number | null, available: number[]): AcState {
  const obs = <T>(value: T | null) => ({ ...unknown<T>("ir"), value, confidence: value === null ? ("unknown" as const) : ("assumed" as const) });
  return { power: obs(power), setpoint_c: obs(setpoint), available_setpoints: available };
}

describe("R4 AC setpoints", () => {
  it.each([
    [ac(null, null, [18, 24, 30]), 24],
    [ac("off", 20, [18, 20, 24]), 20],
    [ac(null, null, [18, 19, 20]), 19], // no 24 captured: the middle one
    [ac(null, 22, [18, 30]), 30], // 22 not captured any more: the middle of [18, 30] (index 1)
    [ac(null, null, []), null],
  ])("power on frame for %j → %s", (state, expected) => {
    expect(powerOnSetpoint(state)).toBe(expected);
  });

  it.each([
    [ac("on", 24, [18, 22, 24, 26]), "up", { ok: true, temp_c: 26 }],
    [ac("on", 24, [18, 22, 24, 26]), "down", { ok: true, temp_c: 22 }], // 23 never captured: skipped
    [ac("on", 26, [18, 22, 24, 26]), "up", { ok: false, reason: "Already at the highest setpoint" }], // H19
    [ac("on", 18, [18, 22]), "down", { ok: false, reason: "Already at the lowest setpoint" }],
    [ac("off", 24, [18, 24, 30]), "up", { ok: false, reason: "Turn the air conditioning on first" }], // Q5
    [ac(null, null, [18, 24]), "up", { ok: false, reason: "Turn the air conditioning on first" }], // R3 Unknown
    [ac("on", null, [18, 24]), "up", { ok: false, reason: "Air conditioning setpoint is unknown" }],
  ] as const)("step %j %s → %j", (state, direction, expected) => {
    expect(stepTarget(state, direction)).toEqual(expected);
  });

  it("R3: a sent frame is assumed, from IR, attributed", () => {
    const next = acSent(ac(null, null, [24]), { power: "on", setpoint_c: 24 }, T0, "phone");
    expect(next.power).toEqual({ value: "on", confidence: "assumed", source: "ir", updated_at: T0, stale: false, changed_by: "phone" });
    expect(next.setpoint_c.value).toBe(24);
    expect(acSent(next, { power: "off" }, T0, "laptop").setpoint_c).toBe(next.setpoint_c);
  });
});
