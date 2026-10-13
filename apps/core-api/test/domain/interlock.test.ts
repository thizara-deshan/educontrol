import type { ProjectorState, RoomState } from "@eduscope/contracts";
import { describe, expect, it } from "vitest";
import { deriveInterlock, mainsOffBlocked } from "../../src/domain/interlock.ts";
import { bootModel, T0 } from "../helpers.ts";

/** The boot state with a meter reading and a projector state written in. */
function withDraw(watts: number, value: ProjectorState): RoomState {
  const { state } = bootModel();
  const { projector } = state.display;
  const reading = { watts, volts: 231, kwh_today: 0, rating_a: 13, at: T0 };
  return {
    ...state,
    display: {
      ...state.display,
      projector: {
        ...projector,
        power: { ...projector.power, value: reading, confidence: "confirmed", updated_at: T0 },
        state: { ...projector.state, value, confidence: "confirmed", updated_at: T0 },
      },
    },
  };
}

describe("R11 interlock", () => {
  it.each([
    [287, false, "Projector still draws 287 W · mains stays on until it cools"],
    [5, false, "Projector still draws 5 W · mains stays on until it cools"],
    [4, false, null],
    [287, true, null], // bypassed
  ])("mains off at %d W (bypassed %s) → %s", (watts, bypassed, expected) => {
    expect(mainsOffBlocked(withDraw(watts, "running"), bypassed)).toBe(expected);
  });
  it("draw unknown blocks mains off", () => {
    expect(mainsOffBlocked(bootModel().state, false)).toBe("Projector draw unknown · mains stays on");
  });
  it("holding while cooling down, bypassed wins, armed otherwise", () => {
    expect(deriveInterlock(withDraw(45, "cooling_down"), false).status).toBe("holding");
    expect(deriveInterlock(withDraw(45, "cooling_down"), true).status).toBe("bypassed");
    expect(deriveInterlock(withDraw(287, "running"), false)).toEqual({ status: "armed", rule_text: "Projector mains stays on until draw is below 5 W." });
  });
});
