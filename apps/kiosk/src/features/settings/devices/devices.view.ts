import { DevicePatch, type Device, type DeviceKind, type Mesh, type Transport } from "@eduscope/contracts";
import { formatCountdown } from "@/lib/format";
import type { Choice } from "../shared/ChoiceGroup";

// S3d: the device registry, its edit sheet and "Permit joining".

const KIND_LABEL: Record<DeviceKind, string> = {
  projector: "Projector", hdmi_switch: "HDMI switch", projection_screen: "Projection screen", lights: "Lights",
  ac: "Air conditioning", audio: "Audio", power_socket: "Power socket", sensor: "Sensor", ir_blaster: "IR blaster",
  coordinator: "Coordinator", other: "Other",
};
/** SPEC S3d: `zigbee` / `ZS06` / `mcu` / `local`. */
export const TRANSPORT_NAME: Record<Transport, string> = { zigbee: "Zigbee", ir_zs06: "ZS06", ir_mcu: "MCU", local: "Local" };

export interface RegistryRow {
  id: string;
  name: string;
  kind: string;
  transport: string;
  /** Hardware ID or friendly name: `r101_lights`, `ZG-808Z`, or "—". */
  hardwareId: string;
}

export function registryRow(device: Device): RegistryRow {
  return {
    id: device.id, name: device.name, kind: KIND_LABEL[device.kind], transport: TRANSPORT_NAME[device.transport],
    hardwareId: device.hw_ref ?? device.model ?? "—",
  };
}

/**
 * Which transports the edit sheet offers. Only an IR device can move (R8: ZS06 ↔ MCU); a
 * Zigbee or local device's transport is its hardware, so it is shown, not chosen `[INFERRED]`.
 */
export function transportChoices(transport: Transport): readonly Choice<Transport>[] | null {
  return transport === "ir_zs06" || transport === "ir_mcu"
    ? [{ value: "ir_zs06", label: "ZS06" }, { value: "ir_mcu", label: "MCU" }]
    : null;
}

export interface EditForm {
  name: string;
  transport: Transport;
}

/** Only the changed fields; `null` when nothing changed. */
export function devicePatch(device: Device, form: EditForm): { ok: true; patch: DevicePatch | null } | { ok: false; error: string } {
  const candidate: DevicePatch = {
    ...(form.name.trim() === device.name ? {} : { name: form.name }),
    ...(form.transport === device.transport ? {} : { transport: form.transport }),
  };
  const parsed = DevicePatch.safeParse(candidate);
  if (!parsed.success) return { ok: false, error: form.name.trim() === "" ? "Enter a name" : "40 characters at most" };
  return { ok: true, patch: Object.keys(parsed.data).length === 0 ? null : parsed.data };
}

/** S3d "Permit joining" → while open: "Joining open · 3:59 left" (S2.E21 shows the same countdown). */
export function permitJoinView(joining: Mesh["joining"], now: Date): { label: string; open: boolean } {
  if (joining.state === "closed") return { label: "Permit joining", open: false };
  return { label: `Joining open · ${formatCountdown((Date.parse(joining.until) - now.getTime()) / 1000)} left`, open: true };
}
