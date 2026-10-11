import { z } from "zod";
import { observed } from "../common.ts";

export const DeviceKind = z.enum([
  "projector", "hdmi_switch", "projection_screen", "lights", "ac", "audio",
  "power_socket", "sensor", "ir_blaster", "coordinator", "other", // "other": S3.E9
]);
export const Transport = z.enum(["zigbee", "ir_zs06", "ir_mcu", "local"]);
export const OutputKind = z.enum(["switch", "level", "select", "position", "momentary"]);
export const OutputId = z.enum([
  "display.source", "projector.ir", "projector.mains", "screen", "audio.mic", "audio.pc",
  "lights.front", "lights.rear", "ac",
]);
export const Output = z.object({ id: OutputId, name: z.string(), kind: OutputKind });
export const Device = z.object({
  id: z.string(),
  name: z.string(),
  kind: DeviceKind,
  transport: Transport,
  brand: z.string().nullable(),
  model: z.string().nullable(),
  hw_ref: z.string().nullable(), // z2m friendly name, port, …
  online: observed(z.boolean()),
  outputs: z.array(Output),
});
/** S3d edit sheet: rename, change transport, change hardware id. Every field is optional. */
export const DevicePatch = z.object({
  name: z.string().trim().min(1).max(40).optional(),
  transport: Transport.optional(),
  hw_ref: z.string().trim().min(1).nullable().optional(),
});

export type DeviceKind = z.infer<typeof DeviceKind>;
export type Transport = z.infer<typeof Transport>;
export type OutputKind = z.infer<typeof OutputKind>;
export type OutputId = z.infer<typeof OutputId>;
export type Output = z.infer<typeof Output>;
export type Device = z.infer<typeof Device>;
export type DevicePatch = z.infer<typeof DevicePatch>;
