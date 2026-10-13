import type { LightGang, RoomState } from "@eduscope/contracts";
import { reported } from "./observed.ts";

// R6: the switch always reports the truth; a change nobody commanded is "by hand" (attribution.ts).

export function applyLightsReport(state: RoomState, gang: LightGang, on: boolean | null, at: string): RoomState {
  const { lights } = state.environment;
  return { ...state, environment: { ...state.environment, lights: { ...lights, [gang]: reported(lights[gang], on, at) } } };
}
