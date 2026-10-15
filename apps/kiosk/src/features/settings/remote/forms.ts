import { type IrCommand, IrCommandCreate, IrDeviceCreate, type IrDeviceKind, type IrSetpoint, type IrTransport } from "@eduscope/contracts";
import type { Choice } from "../shared/ChoiceGroup";
import type { FormResult } from "../shared/form-result";

// S3.E9 "+ Add device" and S3.E16 "+ Add a command" sheets: form → contract input or field errors.

export const TRANSPORT_CHOICES: readonly Choice<IrTransport>[] = [
  { value: "ir_zs06", label: "ZS06" },
  { value: "ir_mcu", label: "MCU" },
];
export const KIND_CHOICES: readonly Choice<IrDeviceKind>[] = [
  { value: "projector", label: "Projector" },
  { value: "ac", label: "Air conditioning" },
  { value: "other", label: "Other" },
];

export interface DeviceForm {
  name: string;
  brand: string;
  transport: IrTransport;
  kind: IrDeviceKind;
}
export const EMPTY_DEVICE_FORM: DeviceForm = { name: "", brand: "", transport: "ir_zs06", kind: "projector" };

const lengthMessage = (field: string, code: string): string => (code === "too_big" ? "40 characters at most" : `Enter a ${field}`);

export function validateDeviceForm(form: DeviceForm): FormResult<IrDeviceCreate, "name" | "brand"> {
  const parsed = IrDeviceCreate.safeParse(form);
  if (parsed.success) return { ok: true, value: parsed.data };
  const errors: Partial<Record<"name" | "brand", string>> = {};
  for (const issue of parsed.error.issues) {
    const field = issue.path[0];
    if ((field === "name" || field === "brand") && errors[field] === undefined) errors[field] = lengthMessage(field, issue.code);
  }
  return { ok: false, errors };
}

/** Q23 / Q24: °C, the range a Panasonic handheld offers `[ASSUMED]`. */
export const AC_TEMP_MIN = 16;
export const AC_TEMP_MAX = 30;
export const AC_MODE_CHOICES: readonly Choice<string>[] = [
  { value: "cool", label: "Cool" },
  { value: "heat", label: "Heat" },
  { value: "dry", label: "Dry" },
  { value: "fan", label: "Fan" },
  { value: "auto", label: "Auto" },
];
export const AC_FAN_CHOICES: readonly Choice<string>[] = [
  { value: "auto", label: "Auto" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];
export const DEFAULT_SETPOINT: IrSetpoint = { temp_c: 24, mode: "cool", fan: "auto" };

/** AC rows are named like the seeded ones ("24°"); a non-default mode or fan is spelled out. */
export function acCommandName(setpoint: IrSetpoint): string {
  const base = `${setpoint.temp_c}°`;
  return setpoint.mode === "cool" && setpoint.fan === "auto" ? base : `${base} · ${setpoint.mode} · ${setpoint.fan}`;
}

export function clampTemp(tempC: number): number {
  return Math.min(AC_TEMP_MAX, Math.max(AC_TEMP_MIN, tempC));
}

/** An AC command is a setpoint frame (R4) or, once, the remote's own Power on button (D-26). */
export type AcCommandKind = "setpoint" | "power_on";
export const AC_KIND_CHOICES: readonly Choice<AcCommandKind>[] = [
  { value: "setpoint", label: "Setpoint" },
  { value: "power_on", label: "Power on" },
];

/** D-26: "Power on" is offered only while the AC has none (a deleted row can be re-created). */
export function acKindsOffered(commands: readonly Pick<IrCommand, "role">[]): readonly AcCommandKind[] {
  return commands.some((command) => command.role === "power_on") ? ["setpoint"] : ["setpoint", "power_on"];
}

/** AC → a setpoint frame (R4) or Power on; any other device → a named command. */
export function commandInput(
  kind: IrDeviceKind, name: string, setpoint: IrSetpoint, acKind: AcCommandKind = "setpoint",
): FormResult<IrCommandCreate, "name"> {
  const candidate: IrCommandCreate =
    kind === "ac"
      ? acKind === "power_on"
        ? { name: "Power on", role: "power_on", setpoint: null }
        : { name: acCommandName(setpoint), role: "setpoint", setpoint }
      : { name, role: "other", setpoint: null };
  const parsed = IrCommandCreate.safeParse(candidate);
  if (parsed.success) return { ok: true, value: parsed.data };
  const issue = parsed.error.issues.find((candidateIssue) => candidateIssue.path[0] === "name");
  return { ok: false, errors: { name: lengthMessage("name", issue?.code ?? "too_small") } };
}
