import type { ProjectorFeedback, ProjectorState } from "@eduscope/contracts";
import { describe, expect, it } from "vitest";
import { roomState } from "@/data/test/room-state";
import { projectorView, type ProjectorInput } from "./projector.view";

function input(
  value: ProjectorState | null, watts: number | null, feedback: Partial<ProjectorFeedback> = {}, extra: Partial<ProjectorInput> = {},
): ProjectorInput {
  const { display, interlock } = roomState();
  const { projector } = display;
  return {
    projector: {
      ...projector,
      state: { ...projector.state, value },
      power: { ...projector.power, value: watts === null ? null : { watts, volts: 231, kwh_today: 1, rating_a: 13, at: "2026-10-05T10:41:30Z" } },
      feedback: { ...projector.feedback, phase: "idle", ...feedback },
    },
    interlock,
    meterOnline: true,
    blasterOnline: true,
    ...extra,
  };
}

describe("projectorView (S1.E13–E15)", () => {
  it("running: On · confirmed by draw, green 287 W, Power on active", () => {
    expect(projectorView(input("running", 287))).toMatchObject({
      tone: "confirmed", stateLine: "On · confirmed by draw", watts: "287 W", wattsTone: "accent",
      powerOnActive: "confirmed", powerOffActive: null, powerOnBlocked: false, holdLine: null, blasterLine: null,
    });
  });
  it("running but not confirmed by draw reads On · assumed", () => {
    const base = input("running", 287);
    const assumed = { ...base, projector: { ...base.projector, state: { ...base.projector.state, confidence: "assumed" as const } } };
    expect(projectorView(assumed)).toMatchObject({ tone: "assumed", stateLine: "On · assumed" });
  });
  it("standby: grey dot, 3 W in text-2, Power off active", () => {
    expect(projectorView(input("standby", 3))).toMatchObject({
      tone: "off", stateLine: "Standby · confirmed by draw", watts: "3 W", wattsTone: "muted",
      powerOnActive: null, powerOffActive: "neutral",
    });
  });
  it("warming up / cooling down: amber dot, live wattage (H14)", () => {
    expect(projectorView(input("warming_up", 27))).toMatchObject({ tone: "warning", stateLine: "Warming up", watts: "27 W", powerOnActive: "confirmed" });
    expect(projectorView(input("cooling_down", 30))).toMatchObject({ tone: "warning", stateLine: "Cooling down", powerOffActive: "neutral" });
  });
  it("IR sent, waiting for draw keeps the current tone (H7b)", () => {
    expect(projectorView(input("standby", 3, { last_ir: "power_on", phase: "waiting_for_draw" }))).toMatchObject({
      tone: "off", stateLine: "Power on sent · waiting for draw",
    });
  });
  it("no change in draw after 90 s is amber (H7b)", () => {
    expect(projectorView(input("running", 287, { last_ir: "power_off", phase: "no_change" }))).toMatchObject({
      tone: "warning", stateLine: "Power off sent · no change in draw",
    });
  });
  it("power meter offline: hollow ring, — W, state unknown", () => {
    expect(projectorView(input("running", 287, {}, { meterOnline: false }))).toMatchObject({
      tone: "unknown", stateLine: "Power meter offline · state unknown", watts: "— W", wattsTone: "faint",
      powerOnActive: null, powerOffActive: null,
    });
  });
  it("unknown state: Unknown, no active button", () => {
    expect(projectorView(input(null, null))).toMatchObject({ tone: "unknown", stateLine: "Unknown", watts: "— W", powerOnActive: null, powerOffActive: null });
  });
  it("interlock holding blocks Power on and shows the H15 line", () => {
    const view = projectorView(input("cooling_down", 30, {}, { interlock: { status: "holding", rule_text: "" } }));
    expect(view.powerOnBlocked).toBe(true);
    expect(view.holdLine).toBe("Mains held on until projector cools");
  });
  it("blaster offline shows the H25 line", () => {
    expect(projectorView(input("running", 287, {}, { blasterOnline: false })).blasterLine).toBe("IR blaster offline");
  });
});
