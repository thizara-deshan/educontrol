import type { Interlock, RoomState } from "@eduscope/contracts";
import { STANDBY_BELOW_W } from "./projector.ts";

// R11 shutdown interlock [INFERRED] (Q7): projector mains is not cut while the lamp still draws ≥ 5 W.

export const INTERLOCK_RULE_TEXT = "Projector mains stays on until draw is below 5 W.";

/** S2.E23: bypassed (technician setting) > holding (lamp cooling) > armed. */
export function deriveInterlock(state: RoomState, bypassed: boolean): Interlock {
  const status = bypassed ? "bypassed" : state.display.projector.state.value === "cooling_down" ? "holding" : "armed";
  return { status, rule_text: INTERLOCK_RULE_TEXT };
}

/** Why `projector.mains off` must be refused right now, or null when it may go ahead. */
export function mainsOffBlocked(state: RoomState, bypassed: boolean): string | null {
  if (bypassed) return null;
  const power = state.display.projector.power.value;
  if (power === null) return "Projector draw unknown · mains stays on";
  if (power.watts >= STANDBY_BELOW_W) return `Projector still draws ${Math.round(power.watts)} W · mains stays on until it cools`;
  return null;
}
