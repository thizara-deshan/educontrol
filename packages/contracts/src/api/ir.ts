import { z } from "zod";
import { IrCommandRole, IrDevice, IrDeviceKind, IrSetpoint, IrTransport } from "../domain/ir.ts";

/** GET /api/ir/devices */
export const IrDeviceList = z.array(IrDevice);
/** POST /api/ir/devices (S3.E9 sheet) */
export const IrDeviceCreate = z.object({
  name: z.string().trim().min(1).max(40),
  brand: z.string().trim().min(1).max(40),
  kind: IrDeviceKind,
  transport: IrTransport,
});
/** PATCH /api/ir/devices/:id */
export const IrDeviceUpdate = IrDeviceCreate.partial();
/** POST /api/ir/devices/:id/commands (S3.E16 sheet) — setpoint given exactly when role is setpoint. */
export const IrCommandCreate = z
  .object({
    name: z.string().trim().min(1).max(40),
    role: IrCommandRole,
    setpoint: IrSetpoint.nullable(),
  })
  .refine((cmd) => (cmd.role === "setpoint") === (cmd.setpoint !== null), {
    message: "setpoint is required exactly when role is setpoint",
    path: ["setpoint"],
  });
/** POST /api/ir/commands/:id/test-result (R5) */
export const IrTestResultRequest = z.object({ reacted: z.boolean() });

export type IrDeviceList = z.infer<typeof IrDeviceList>;
export type IrDeviceCreate = z.infer<typeof IrDeviceCreate>;
export type IrDeviceUpdate = z.infer<typeof IrDeviceUpdate>;
export type IrCommandCreate = z.infer<typeof IrCommandCreate>;
export type IrTestResultRequest = z.infer<typeof IrTestResultRequest>;
