import type { DeviceKind, IrCommand, IrDevice, IrDeviceKind, IrTestStatus, IrTransport, Transport } from "@eduscope/contracts";

// S3 Remote configuration rules (ARCHITECTURE §6.9, H20–H22, R4, R5). Pure.

/** H21: how long the blaster listens; also the `timeout_s` sent to hw-service. */
export const IR_CAPTURE_WINDOW_S = 20;

/** An IR device is a registry device whose transport is ir_* (S3.E7). */
export function isIrTransport(transport: Transport): transport is IrTransport {
  return transport === "ir_zs06" || transport === "ir_mcu";
}

/** S3.E9 kinds: projector, AC, anything else is "other". */
export function irKind(kind: DeviceKind): IrDeviceKind {
  return kind === "projector" || kind === "ac" ? kind : "other";
}

/** S3 list order: by name (screenshot 03: Air conditioning, Projector). */
export function sortIrDevices(devices: readonly IrDevice[]): IrDevice[] {
  return [...devices].sort((a, b) => a.name.localeCompare(b.name));
}

/** Columns a successful capture writes. R5: a new code is untested. A failed capture writes nothing (H21). */
export function captureFields(code: string, at: string): { code: string; captured_at: string; test: IrTestStatus; tested_at: null } {
  return { code, captured_at: at, test: "untested", tested_at: null };
}

/** Columns the technician's answer writes (H22). */
export function testResultFields(reacted: boolean, at: string): { test: IrTestStatus; tested_at: string } {
  return { test: reacted ? "reacted" : "no_reaction", tested_at: at };
}

/** R4: each setpoint is one frame, so two commands may not claim the same temperature on one device. */
export function duplicateSetpoint(existing: readonly IrCommand[], tempC: number): string | null {
  return existing.some((command) => command.setpoint?.temp_c === tempC) ? `A ${tempC}° setpoint already exists` : null;
}
