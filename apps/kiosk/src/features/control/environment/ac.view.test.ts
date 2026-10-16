import type { AcState } from "@eduscope/contracts";
import { describe, expect, it } from "vitest";
import { roomState } from "@/data/test/room-state";
import { acView } from "./ac.view";

function ac(power: "on" | "off" | null, setpoint: number | null): AcState {
  const base = roomState().environment.ac;
  return {
    ...base,
    power: { ...base.power, value: power, confidence: power === null ? "unknown" : "assumed" },
    setpoint_c: { ...base.setpoint_c, value: setpoint, confidence: setpoint === null ? "unknown" : "assumed" },
  };
}

describe("acView (S1.E34–E40)", () => {
  it("assumed On: amber ring, Power on active, both steps enabled mid-range", () => {
    expect(acView(ac("on", 24), true)).toEqual({
      tone: "assumed", stateLine: "On · assumed", powerOnActive: "assumed", powerOffActive: null,
      setpoint: "24°", setpointDimmed: false, canStepDown: true, canStepUp: true, blasterLine: null,
    });
  });
  it("− is disabled at the lowest captured setpoint, + at the highest (H19)", () => {
    expect(acView(ac("on", 18), true)).toMatchObject({ canStepDown: false, canStepUp: true });
    expect(acView(ac("on", 30), true)).toMatchObject({ canStepDown: true, canStepUp: false });
  });
  it("assumed Off: Power off active, setpoint dimmed, both steps disabled (Q5)", () => {
    expect(acView(ac("off", 24), true)).toMatchObject({
      stateLine: "Off · assumed", powerOnActive: null, powerOffActive: "neutral", setpointDimmed: true,
      canStepDown: false, canStepUp: false,
    });
  });
  it("Unknown before any command (R3): hollow ring, —, nothing active", () => {
    expect(acView(ac(null, null), true)).toEqual({
      tone: "unknown", stateLine: "Unknown", powerOnActive: null, powerOffActive: null,
      setpoint: "—", setpointDimmed: true, canStepDown: false, canStepUp: false, blasterLine: null,
    });
  });
  it("assumed On with the setpoint unknown: both steps enabled (D-28), none without captured setpoints", () => {
    expect(acView(ac("on", null), true)).toMatchObject({ setpoint: "—", canStepDown: true, canStepUp: true });
    expect(acView({ ...ac("on", null), available_setpoints: [] }, true)).toMatchObject({ canStepDown: false, canStepUp: false });
  });
  it("only captured setpoints count (R4)", () => {
    const sparse = { ...ac("on", 22), available_setpoints: [22, 26] };
    expect(acView(sparse, true)).toMatchObject({ canStepDown: false, canStepUp: true });
  });
  it("blaster offline shows the H25 line", () => {
    expect(acView(ac("on", 24), false).blasterLine).toBe("IR blaster offline");
  });
});
