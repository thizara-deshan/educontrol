import type { DeviceKind, Output, RoomState, Transport } from "@eduscope/contracts";

// The store's whole world: the RoomState every client sees plus the raw hardware facts the rules
// need but RoomState does not carry (ARCHITECTURE §6.4).

export interface KwhBaseline {
  /** Local date "YYYY-MM-DD" the baseline belongs to. */
  date: string;
  kwh_total: number;
}

export interface HwFacts {
  /** Per-channel mute flags from the mixer; `muted_all` is derived from both (R9). */
  audio_muted: { mic: boolean | null; pc: boolean | null };
  /** Last `energy_kwh_total` from the power meter. */
  energy_kwh_total: number | null;
  /** kWh-today baseline (persisted in `settings`). */
  kwh_baseline: KwhBaseline | null;
  /** When the hw link went down; null while up (§6.7). */
  hw_down_since: string | null;
  /** Permit-join deadline from hw (`zigbee.mesh`). */
  joining_until: string | null;
  /** Shutdown interlock bypass (`settings.interlock_bypass`, R11). */
  interlock_bypassed: boolean;
}

export interface RoomModel {
  state: RoomState;
  facts: HwFacts;
  /** Device registry rows (DB `devices`), in sort order. */
  registry: readonly DeviceInfo[];
}

/** Registry data of one device (a `devices` row without the sort column). */
export interface DeviceInfo {
  id: string;
  name: string;
  kind: DeviceKind;
  transport: Transport;
  brand: string | null;
  model: string | null;
  hw_ref: string | null;
}

/** Rule parameters that come from config (R13, §6.7). */
export interface RuleConfig {
  climateIntervalS: number;
  powerIntervalS: number;
  hwDownGraceMs: number;
}

/** Controllable endpoints per seeded device id (equal to fixtures/state/room-normal.json). */
export const OUTPUTS: Readonly<Record<string, readonly Output[]>> = {
  projector: [{ id: "projector.ir", name: "Projector power", kind: "momentary" }],
  hdmi_switch: [{ id: "display.source", name: "Source", kind: "select" }],
  projection_screen: [{ id: "screen", name: "Projection screen", kind: "position" }],
  lights: [
    { id: "lights.front", name: "Front of room", kind: "switch" },
    { id: "lights.rear", name: "Rear of room", kind: "switch" },
  ],
  ac: [{ id: "ac", name: "Air conditioning", kind: "momentary" }],
  audio: [
    { id: "audio.mic", name: "Lecturer microphone", kind: "level" },
    { id: "audio.pc", name: "PC audio", kind: "level" },
  ],
  projector_socket: [{ id: "projector.mains", name: "Mains to projector", kind: "switch" }],
};
