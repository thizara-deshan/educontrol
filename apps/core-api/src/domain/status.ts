import type { RoomState, RoomStatus } from "@eduscope/contracts";

// S1.E4 room status: fault > degraded > normal. Inputs are already-derived fields of the state.

/** H16: a battery at or below this is low. */
export const LOW_BATTERY_PCT = 20;

export function deriveStatus(state: RoomState): RoomStatus {
  if (state.connection.hw === "down") return { level: "fault", text: "Hardware service offline" };
  if (state.zigbee.coordinator.status === "offline") return { level: "fault", text: "Coordinator offline" }; // H9
  const offline = state.devices.filter((device) => device.online.value === false);
  const first = offline[0];
  if (first !== undefined) {
    // H8; one router offline (R7) lands here too: degraded, never fault.
    return { level: "degraded", text: offline.length === 1 ? `${first.name} offline` : `${offline.length} devices offline` };
  }
  const { count, of } = state.environment.sensors.reporting;
  if (count < of) return { level: "degraded", text: count === 0 ? "No sensors reporting" : "Sensor not reporting" };
  const lowBattery = state.zigbee.nodes.some((node) => node.battery_pct !== null && node.battery_pct <= LOW_BATTERY_PCT);
  if (lowBattery) return { level: "degraded", text: "Sensor battery low" }; // H16
  return { level: "normal", text: "All systems normal" };
}
