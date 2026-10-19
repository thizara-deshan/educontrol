import type { HwPlugStateData, PlugReading, RoomState } from "@eduscope/contracts";
import { reported } from "./observed.ts";

// D-34: the general-purpose smart plug. Its own report is the truth, like the lights (R6); a change nobody
// commanded is "by hand" (its button, attribution.ts). Values the plug has not reported keep their last value.

export function applyPlugReport(state: RoomState, data: HwPlugStateData | null, at: string): RoomState {
  if (data === null) return state;
  const { plug } = state;
  const on = data.on === null ? plug.on : reported(plug.on, data.on, at);
  const value: PlugReading = { watts: data.watts, volts: data.volts, amps: data.amps, kwh_today: data.kwh_today };
  const metered = Object.values(value).some((v) => v !== null);
  const reading = metered ? reported(plug.reading, value, at) : plug.reading;
  return { ...state, plug: { on, reading, online: data.online } };
}
