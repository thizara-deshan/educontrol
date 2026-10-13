import { describe, expect, it } from "vitest";
import { roomState } from "@/data/test/room-state";
import { applyProjectorStep, projectorRamp, RUNNING_WATTS, setProjectorPhase, STANDBY_WATTS } from "./mock-rules";

const AT = "2026-10-05T10:43:00Z";
const times = { irToDrawMs: 300, warmUpMs: 3000, coolDownMs: 6000 };

describe("R1 projector ramp (mock)", () => {
  it("on: waiting for draw, warming up between 5 and 50 W, then running", () => {
    expect(projectorRamp(true, 0, times)).toEqual({ watts: STANDBY_WATTS, state: "standby", phase: "waiting_for_draw", done: false });
    const warming = projectorRamp(true, 1800, times);
    expect(warming.state).toBe("warming_up");
    expect(warming.watts).toBeGreaterThan(5);
    expect(warming.watts).toBeLessThan(50);
    expect(warming.phase).toBe("idle");
    expect(projectorRamp(true, 3300, times)).toEqual({ watts: RUNNING_WATTS, state: "running", phase: "idle", done: true });
  });

  it("off: cooling down, then standby; the interlock holds while cooling (R11)", () => {
    const cooling = projectorRamp(false, 1000, times);
    expect(cooling.state).toBe("cooling_down");
    const held = applyProjectorStep(roomState(), cooling, AT);
    expect(held.interlock.status).toBe("holding");
    expect(held.display.projector.power.value?.watts).toBe(cooling.watts);
    expect(held.display.projector.state).toMatchObject({ value: "cooling_down", confidence: "confirmed", source: "power_meter" });
    const done = projectorRamp(false, 6300, times);
    expect(done).toEqual({ watts: STANDBY_WATTS, state: "standby", phase: "idle", done: true });
    expect(applyProjectorStep(held, done, AT).interlock.status).toBe("armed");
  });

  it("setProjectorPhase changes only the H7b phase", () => {
    const next = setProjectorPhase(roomState(), "no_change");
    expect(next.display.projector.feedback).toEqual({ ...roomState().display.projector.feedback, phase: "no_change" });
    expect(next.display.projector.state.value).toBe("running");
  });
});
