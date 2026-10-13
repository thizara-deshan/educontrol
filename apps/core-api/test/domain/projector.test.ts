import type { ProjectorFeedback, ProjectorState } from "@eduscope/contracts";
import { describe, expect, it } from "vitest";
import { drawAgrees, feedbackAfterIr, nextPhase, stateFromDraw } from "../../src/domain/projector.ts";
import { T0 } from "../helpers.ts";

const IDLE: ProjectorFeedback = { last_ir: null, sent_at: null, phase: "idle" };
const WAIT_ON: ProjectorFeedback = { last_ir: "power_on", sent_at: T0, phase: "waiting_for_draw" };
const WAIT_OFF: ProjectorFeedback = { last_ir: "power_off", sent_at: T0, phase: "waiting_for_draw" };

describe("R1 stateFromDraw", () => {
  const cases: [number, ProjectorState | null, ProjectorFeedback, ProjectorState][] = [
    [287, null, IDLE, "running"],
    [51, "standby", IDLE, "running"],
    [50, "running", IDLE, "cooling_down"], // 50 W is "between"
    [3, null, IDLE, "standby"],
    [4.9, "running", IDLE, "standby"],
    [5, "standby", IDLE, "warming_up"],
    [24, null, WAIT_ON, "warming_up"],
    [24, "running", WAIT_ON, "warming_up"], // the command in flight decides
    [45, "standby", WAIT_OFF, "cooling_down"],
    [45, "running", IDLE, "cooling_down"],
    [12, "warming_up", IDLE, "warming_up"],
    [30, "cooling_down", IDLE, "cooling_down"],
    [30, null, { last_ir: "power_off", sent_at: T0, phase: "idle" }, "cooling_down"],
    [30, null, IDLE, "unknown"],
  ];
  it.each(cases)("%d W after %s (%j) → %s", (watts, prev, feedback, expected) => {
    expect(stateFromDraw(watts, prev, feedback)).toBe(expected);
  });
});

describe("H7b feedback", () => {
  it("drawAgrees per direction", () => {
    expect(drawAgrees("power_on", "warming_up")).toBe(true);
    expect(drawAgrees("power_on", "standby")).toBe(false);
    expect(drawAgrees("power_off", "cooling_down")).toBe(true);
    expect(drawAgrees(null, "running")).toBe(false);
  });
  it("IR sent while the draw already agrees is idle at once", () => {
    expect(feedbackAfterIr(true, "running", T0)).toEqual({ last_ir: "power_on", sent_at: T0, phase: "idle" });
    expect(feedbackAfterIr(true, "standby", T0).phase).toBe("waiting_for_draw");
  });
  const at = (ms: number): Date => new Date(Date.parse(T0) + ms);
  it.each([
    [WAIT_ON, "standby", 89_999, "waiting_for_draw"],
    [WAIT_ON, "standby", 90_000, "no_change"],
    [WAIT_ON, "warming_up", 1_000, "idle"],
    [{ ...WAIT_ON, phase: "no_change" }, "standby", 200_000, "no_change"],
    [{ ...WAIT_ON, phase: "no_change" }, "running", 200_000, "idle"],
  ] as const)("%j with %s after %d ms → %s", (feedback, state, ms, phase) => {
    expect(nextPhase(feedback, state, at(ms)).phase).toBe(phase);
  });
});
