import type { ProjectorFeedback, ProjectorState } from "@eduscope/contracts";
import { kwhToday, localDate } from "./energy.ts";
import type { RoomModel } from "./model.ts";
import { reported } from "./observed.ts";

// R1 (state from draw), R2 (IR alone never confirms), H7b (waiting for draw / no change).

export const RUNNING_ABOVE_W = 50;
export const STANDBY_BELOW_W = 5;
export const NO_CHANGE_AFTER_MS = 90_000;
/** S2.E12 RATING, static (SPEC §6 PowerReading). */
export const RATING_A = 13;

type LastIr = ProjectorFeedback["last_ir"];

/** R1: >50 W running, <5 W standby; in between the commanded or ongoing direction decides. */
export function stateFromDraw(watts: number, prev: ProjectorState | null, feedback: ProjectorFeedback): ProjectorState {
  if (watts > RUNNING_ABOVE_W) return "running";
  if (watts < STANDBY_BELOW_W) return "standby";
  if (feedback.phase === "waiting_for_draw" && feedback.last_ir !== null) {
    return feedback.last_ir === "power_on" ? "warming_up" : "cooling_down";
  }
  if (prev === "running" || prev === "cooling_down") return "cooling_down";
  if (prev === "standby" || prev === "warming_up") return "warming_up";
  if (feedback.last_ir !== null) return feedback.last_ir === "power_on" ? "warming_up" : "cooling_down";
  return "unknown";
}

/** The draw already shows the effect of the last IR command. */
export function drawAgrees(lastIr: LastIr, state: ProjectorState | null): boolean {
  if (lastIr === "power_on") return state === "warming_up" || state === "running";
  if (lastIr === "power_off") return state === "cooling_down" || state === "standby";
  return false;
}

/** Feedback right after core-api sends a power IR command (before the ack). */
export function feedbackAfterIr(on: boolean, state: ProjectorState | null, at: string): ProjectorFeedback {
  const lastIr = on ? "power_on" : "power_off";
  return { last_ir: lastIr, sent_at: at, phase: drawAgrees(lastIr, state) ? "idle" : "waiting_for_draw" };
}

/** H7b: waiting → idle once the draw agrees; waiting → no_change after 90 s; a late change still clears it. */
export function nextPhase(feedback: ProjectorFeedback, state: ProjectorState | null, now: Date): ProjectorFeedback {
  if (feedback.phase === "idle") return feedback;
  if (drawAgrees(feedback.last_ir, state)) return { ...feedback, phase: "idle" };
  if (feedback.phase === "waiting_for_draw" && feedback.sent_at !== null) {
    if (now.getTime() - Date.parse(feedback.sent_at) >= NO_CHANGE_AFTER_MS) return { ...feedback, phase: "no_change" };
  }
  return feedback;
}

/** A `projector_power.reading`: live power, kWh today and the R1 state, all confirmed by the meter. */
export function applyPowerReading(
  model: RoomModel,
  reading: { watts: number; volts: number; energy_kwh_total: number },
  at: string,
): RoomModel {
  const { projector } = model.state.display;
  const energy = kwhToday(model.facts.kwh_baseline, reading.energy_kwh_total, localDate(new Date(at)));
  const state = stateFromDraw(reading.watts, projector.state.value, projector.feedback);
  const power = { watts: reading.watts, volts: reading.volts, kwh_today: energy.kwhToday, rating_a: RATING_A, at };
  return {
    ...model,
    state: {
      ...model.state,
      display: {
        ...model.state.display,
        projector: {
          ...projector,
          state: reported(projector.state, state, at),
          power: reported(projector.power, power, at),
          feedback: nextPhase(projector.feedback, state, new Date(at)),
        },
      },
    },
    facts: { ...model.facts, energy_kwh_total: reading.energy_kwh_total, kwh_baseline: energy.baseline },
  };
}
