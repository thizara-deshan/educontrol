import { z } from "zod";
import { observed, Timestamp } from "../common.ts";

export const IrBlaster = z.object({
  id: z.string(),
  topic: z.string(),
  lqi: z.number().int().nullable(),
  coverage: z.string(),
  power: z.literal("mains"),
  online: observed(z.boolean()),
});

export const IrTestStatus = z.enum(["untested", "reacted", "no_reaction"]);
/** One captured AC state frame (R4): power + mode + temperature + fan. */
export const IrSetpoint = z.object({
  temp_c: z.number().int(),
  mode: z.string().min(1),
  fan: z.string().min(1),
});
export const IrCommandRole = z.enum(["power_on", "power_off", "setpoint", "other"]);
export const IrCommand = z.object({
  id: z.string(),
  device_id: z.string(),
  name: z.string(),
  role: IrCommandRole,
  setpoint: IrSetpoint.nullable(),
  code_format: z.literal("tuya"),
  captured: z.boolean(), // the code itself is technician-only (IrCommandDetail)
  captured_at: Timestamp.nullable(),
  test: IrTestStatus,
  tested_at: Timestamp.nullable(),
});
/** Technician-only view of a command, including the opaque code. Never sent over WS. */
export const IrCommandDetail = IrCommand.extend({ code: z.string().nullable() });

export const IrDeviceKind = z.enum(["projector", "ac", "other"]);
export const IrTransport = z.enum(["ir_zs06", "ir_mcu"]);
export const IrDevice = z.object({ // a Device whose transport is ir_*
  device_id: z.string(),
  name: z.string(),
  brand: z.string(),
  kind: IrDeviceKind,
  transport: IrTransport,
  commands: z.array(IrCommand),
});

/** Capture flow states pushed over WS as `ir_capture` (H21). */
export const IrCaptureStatus = z.enum(["listening", "captured", "timeout", "cancelled", "failed"]);

export type IrBlaster = z.infer<typeof IrBlaster>;
export type IrTestStatus = z.infer<typeof IrTestStatus>;
export type IrSetpoint = z.infer<typeof IrSetpoint>;
export type IrCommandRole = z.infer<typeof IrCommandRole>;
export type IrCommand = z.infer<typeof IrCommand>;
export type IrCommandDetail = z.infer<typeof IrCommandDetail>;
export type IrDeviceKind = z.infer<typeof IrDeviceKind>;
export type IrTransport = z.infer<typeof IrTransport>;
export type IrDevice = z.infer<typeof IrDevice>;
export type IrCaptureStatus = z.infer<typeof IrCaptureStatus>;
