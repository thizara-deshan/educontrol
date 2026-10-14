import type { Device, Observed, RoomState, Source, Transport } from "@eduscope/contracts";
import { isIrTransport } from "./ir.ts";
import type { DeviceInfo } from "./model.ts";
import { OUTPUTS } from "./model.ts";

// H8/H9: each device's `online` from the facts that prove it [ASSUMED until intake].
//   zigbee devices → their node; ir_* devices → the ZS06 (ir_mcu → the hw link); the blaster and
//   the coordinator → their own reports; local devices → the hw link. hw down past the grace ⇒ all offline.

function sourceFor(info: DeviceInfo): Source {
  switch (info.kind) {
    case "lights":
    case "projection_screen":
      return "switch";
    case "power_socket":
      return "power_meter";
    case "sensor":
      return "sensor";
    case "hdmi_switch":
      return "hdmi_switch";
    case "audio":
      return "mixer";
    case "projector":
    case "ac":
    case "ir_blaster":
      return "ir";
    case "coordinator":
    case "other":
      return "none";
  }
}

function factOnline(info: DeviceInfo, state: RoomState): boolean | null {
  if (info.kind === "ir_blaster") return state.ir_blaster.online.value;
  if (info.kind === "coordinator") {
    const status = state.zigbee.coordinator.status;
    return status === "starting" ? null : status === "online";
  }
  if (info.transport === "ir_zs06") return state.ir_blaster.online.value;
  if (info.transport === "zigbee") {
    return state.zigbee.nodes.find((node) => node.friendly_name === info.hw_ref)?.online ?? null;
  }
  return true; // local and ir_mcu: reachable while hw-service is
}

function onlineValue(prev: Observed<boolean> | undefined, info: DeviceInfo, value: boolean | null, stale: boolean, now: string): Observed<boolean> {
  const confidence = value === null ? "unknown" : info.kind === "ac" ? "assumed" : "confirmed";
  if (prev !== undefined && prev.value === value && prev.confidence === confidence && prev.stale === stale) return prev;
  const changed = prev === undefined || prev.value !== value;
  return {
    value,
    confidence,
    source: sourceFor(info),
    updated_at: changed ? (value === null ? null : now) : (prev?.updated_at ?? null),
    stale,
    changed_by: null,
  };
}

/**
 * The `devices` array. `hwDown`: link down (keep last values); `hwOffline`: down past the grace
 * (every device offline, last values greyed, §6.7).
 */
export function deriveDevices(
  infos: readonly DeviceInfo[],
  state: RoomState,
  link: { hwDown: boolean; hwOffline: boolean },
  now: string,
): Device[] {
  return infos.map((info) => {
    const prev = state.devices.find((device) => device.id === info.id)?.online;
    const value = link.hwOffline ? false : link.hwDown ? (prev?.value ?? null) : factOnline(info, state);
    return { ...info, online: onlineValue(prev, info, value, link.hwOffline, now), outputs: [...(OUTPUTS[info.id] ?? [])] };
  });
}

/** S3d/R8: only IR devices switch transport, and only between ZS06 and MCU. Null = allowed. */
export function transportChangeError(current: Transport, next: Transport | undefined): string | null {
  if (next === undefined || next === current) return null;
  if (isIrTransport(current) && isIrTransport(next)) return null;
  return "Only IR devices change transport (ZS06 or MCU)";
}
