import type { RoomState, SensorReading } from "@eduscope/contracts";
import { INTERLOCK_RULE_TEXT } from "./interlock.ts";
import type { DeviceInfo, KwhBaseline, RoomModel } from "./model.ts";
import { unknown } from "./observed.ts";
import { placeholderCoordinator } from "./zigbee.ts";

// The model at boot, before hw-service reports anything (D-15: live state is never persisted).
// The link starts down; the store's first derive fills devices, mesh, status.

/** S3.E10 "Coverage" [ASSUMED]: not reported by hw, not in the registry. */
export const BLASTER_COVERAGE = "360°, 12 m";

/** Which registry device owns each sensor tile (its hw_ref is the reading's node). */
export const SENSOR_DEVICE_IDS = { temperature: "room_climate", humidity: "room_climate", occupancy: "motion", contact: "door" } as const;

export interface InitialModelInput {
  room: { id: string; hostname: string };
  registry: readonly DeviceInfo[];
  /** Captured AC setpoint frames, ascending (R4). */
  acSetpoints: readonly number[];
  interlockBypassed: boolean;
  kwhBaseline: KwhBaseline | null;
  now: string;
}

export function initialModel(input: InitialModelInput): RoomModel {
  const device = (id: string): DeviceInfo | undefined => input.registry.find((info) => info.id === id);
  const node = (slot: keyof typeof SENSOR_DEVICE_IDS): string => device(SENSOR_DEVICE_IDS[slot])?.hw_ref ?? "";
  const reading = <K extends SensorReading["kind"]>(kind: K) => ({ kind, value: null, node: node(kind), at: null, stale: false });
  const blaster = device("ir_blaster");
  const coordinator = device("coordinator");

  const state: RoomState = {
    rev: 0,
    server_time: input.now,
    room: { id: input.room.id, hostname: input.room.hostname, status: { level: "fault", text: "Hardware service offline" } },
    connection: { hw: "down" },
    display: {
      source: unknown("hdmi_switch"),
      projector: {
        state: unknown("power_meter"),
        power: unknown("power_meter"),
        feedback: { last_ir: null, sent_at: null, phase: "idle" },
        mains: unknown("switch"),
      },
      screen: unknown("switch"),
    },
    audio: { channels: { mic: unknown("mixer"), pc: unknown("mixer") }, muted_all: unknown("mixer"), saved_levels: { mic: null, pc: null } },
    environment: {
      lights: { front: unknown("switch"), rear: unknown("switch") },
      ac: { power: unknown("ir"), setpoint_c: unknown("ir"), available_setpoints: [...input.acSetpoints] }, // R3 "Unknown"
      sensors: {
        temperature: reading("temperature"),
        humidity: reading("humidity"),
        occupancy: reading("occupancy"),
        contact: reading("contact"),
        reporting: { count: 0, of: 0 },
      },
    },
    plug: { on: unknown("switch"), reading: unknown("power_meter"), online: false }, // D-34
    zigbee: {
      coordinator: placeholderCoordinator(coordinator?.model ?? null, coordinator?.hw_ref ?? null),
      mesh: { paired: 0, routers: 0, end_devices: 0, joining: { state: "closed" } },
      nodes: [],
    },
    ir_blaster: {
      id: blaster?.name ?? "ZS06",
      topic: blaster?.hw_ref ?? "",
      lqi: null,
      coverage: BLASTER_COVERAGE,
      power: "mains",
      online: unknown("ir"),
    },
    interlock: { status: "armed", rule_text: INTERLOCK_RULE_TEXT },
    devices: [],
  };
  return {
    state,
    facts: {
      audio_muted: { mic: null, pc: null },
      energy_kwh_total: null,
      kwh_baseline: input.kwhBaseline,
      hw_down_since: input.now,
      joining_until: null,
      interlock_bypassed: input.interlockBypassed,
    },
    registry: input.registry,
  };
}
