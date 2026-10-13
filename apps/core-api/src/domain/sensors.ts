import type { HwSensorReadingData, RoomState, SensorReading, ZigbeeNode } from "@eduscope/contracts";
import type { RuleConfig } from "./model.ts";
import { withStale } from "./observed.ts";

// R13 staleness and S1.E41 "n reporting". Periodic sensors: stale after 2× their report interval;
// event sensors (occupancy, door): stale when their node was last seen more than 60 min ago.

export const EVENT_SENSOR_STALE_MS = 60 * 60_000;

type Sensors = RoomState["environment"]["sensors"];
type SensorSlot = "temperature" | "humidity" | "occupancy" | "contact";

/** One `sensors.reading`: the tile for that kind takes value, node and time; the node counts as seen. */
export function applySensorReading(state: RoomState, data: HwSensorReadingData, at: string): RoomState {
  const reading: SensorReading = { ...data, at, stale: false };
  const sensors: Sensors = { ...state.environment.sensors, [data.kind]: reading };
  const seen = (node: ZigbeeNode): boolean => node.last_seen === null || Date.parse(node.last_seen) < Date.parse(at);
  const nodes = state.zigbee.nodes.map((node) => (node.friendly_name === data.node && seen(node) ? { ...node, last_seen: at } : node));
  return { ...state, environment: { ...state.environment, sensors }, zigbee: { ...state.zigbee, nodes } };
}

function lastSeen(reading: SensorReading, nodes: readonly ZigbeeNode[]): string | null {
  return nodes.find((node) => node.friendly_name === reading.node)?.last_seen ?? reading.at;
}

function isStale(reading: SensorReading, nodes: readonly ZigbeeNode[], now: Date, cfg: RuleConfig): boolean {
  const periodic = reading.kind === "temperature" || reading.kind === "humidity";
  const since = periodic ? reading.at : lastSeen(reading, nodes);
  if (since === null) return false; // never reported is H11 "No reading yet", not stale
  const limit = periodic ? 2 * cfg.climateIntervalS * 1000 : EVENT_SENSOR_STALE_MS;
  return now.getTime() - Date.parse(since) > limit;
}

/** Re-evaluates every staleness flag (sensor tiles + power meter). */
export function applyStaleness(state: RoomState, now: Date, cfg: RuleConfig): RoomState {
  const { sensors } = state.environment;
  const slots: SensorSlot[] = ["temperature", "humidity", "occupancy", "contact"];
  let nextSensors: Sensors = sensors;
  for (const slot of slots) {
    const reading = sensors[slot];
    const stale = isStale(reading, state.zigbee.nodes, now, cfg);
    if (reading.stale !== stale) nextSensors = { ...nextSensors, [slot]: { ...reading, stale } };
  }
  const { projector } = state.display;
  const powerAt = projector.power.updated_at;
  const powerStale = powerAt !== null && now.getTime() - Date.parse(powerAt) > 2 * cfg.powerIntervalS * 1000;
  return {
    ...state,
    environment: { ...state.environment, sensors: nextSensors },
    display: {
      ...state.display,
      projector: { ...projector, power: withStale(projector.power, powerStale), state: withStale(projector.state, powerStale) },
    },
  };
}

/** S1.E41: sensor devices online with a fresh, non-null reading on every tile they own. */
export function deriveReporting(state: RoomState): { count: number; of: number } {
  const { temperature, humidity, occupancy, contact } = state.environment.sensors;
  const readings = [temperature, humidity, occupancy, contact];
  const sensorDevices = state.devices.filter((device) => device.kind === "sensor");
  const count = sensorDevices.filter((device) => {
    if (device.online.value !== true) return false;
    const own = readings.filter((reading) => reading.node === device.hw_ref);
    return own.length > 0 && own.every((reading) => !reading.stale && reading.value !== null);
  }).length;
  return { count, of: sensorDevices.length };
}
