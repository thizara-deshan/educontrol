import type { AcState, ChangedBy } from "@eduscope/contracts";
import type { RoomModel } from "./model.ts";
import { assumed } from "./observed.ts";

// R3 (always assumed, Unknown after start), R4 (−/+ step through captured frames only), Q5, H19.

/** Power on with no setpoint sent since start sends this frame when captured [ASSUMED]. */
export const DEFAULT_SETPOINT_C = 24;

/** The frame AC Power on sends (S1.E35): the current setpoint, else 24°, else the middle captured one. */
export function powerOnSetpoint(ac: AcState): number | null {
  const current = ac.setpoint_c.value;
  if (current !== null && ac.available_setpoints.includes(current)) return current;
  if (ac.available_setpoints.includes(DEFAULT_SETPOINT_C)) return DEFAULT_SETPOINT_C;
  return ac.available_setpoints[Math.floor(ac.available_setpoints.length / 2)] ?? null;
}

export type StepResult = { ok: true; temp_c: number } | { ok: false; reason: string };

/** R4 next lower/higher captured setpoint; Q5 rejects −/+ unless the AC is assumed on; H19 at the ends. */
export function stepTarget(ac: AcState, direction: "down" | "up"): StepResult {
  if (ac.power.value !== "on") return { ok: false, reason: "Turn the air conditioning on first" };
  const current = ac.setpoint_c.value;
  if (current === null) return { ok: false, reason: "Air conditioning setpoint is unknown" };
  const candidates = ac.available_setpoints.filter((t) => (direction === "up" ? t > current : t < current));
  if (candidates.length === 0) {
    return { ok: false, reason: direction === "up" ? "Already at the highest setpoint" : "Already at the lowest setpoint" };
  }
  return { ok: true, temp_c: direction === "up" ? Math.min(...candidates) : Math.max(...candidates) };
}

/** After the blaster accepted a frame: power and/or setpoint become assumed values (R3). */
export function acSent(ac: AcState, change: { power?: "on" | "off"; setpoint_c?: number }, at: string, by: ChangedBy | null): AcState {
  return {
    ...ac,
    power: change.power === undefined ? ac.power : assumed(change.power, at, by),
    setpoint_c: change.setpoint_c === undefined ? ac.setpoint_c : assumed(change.setpoint_c, at, by),
  };
}

/** R4: S1's −/+ range after S3 captured or removed a setpoint frame (captured temperatures, ascending). */
export function withAvailableSetpoints(model: RoomModel, setpoints: readonly number[]): RoomModel {
  const { environment } = model.state;
  return { ...model, state: { ...model.state, environment: { ...environment, ac: { ...environment.ac, available_setpoints: [...setpoints] } } } };
}
