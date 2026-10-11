import { z } from "zod";
import { ClientLabel } from "../common.ts";
import { ClientSession } from "../domain/session.ts";

/** GET /api/session */
export const GetSessionResponse = ClientSession;
/** POST /api/session/login — room PIN has 4 digits, technician PIN has 6. */
export const LoginRequest = z
  .object({
    level: z.enum(["control", "technician"]),
    pin: z.string().regex(/^\d+$/, "PIN must be digits only"),
    label: ClientLabel,
  })
  .refine((req) => req.pin.length === (req.level === "control" ? 4 : 6), {
    message: "Room PIN has 4 digits, technician PIN has 6",
    path: ["pin"],
  });
export const PinError = z.object({
  reason: z.enum(["wrong", "locked"]),
  retry_after_s: z.number().int().nonnegative().nullable(),
  attempts_left: z.number().int().nonnegative().nullable(),
});
export const LoginResult = z.union([ClientSession, PinError]);
/** POST /api/session/lock */
export const LockResponse = ClientSession;

export type GetSessionResponse = z.infer<typeof GetSessionResponse>;
export type LoginRequest = z.infer<typeof LoginRequest>;
export type PinError = z.infer<typeof PinError>;
export type LoginResult = z.infer<typeof LoginResult>;
export type LockResponse = z.infer<typeof LockResponse>;
