import { z } from "zod";

export const HwModule = z.enum([
  "lights", "projector_power", "ir", "hdmi", "projection_screen", "audio", "sensors", "zigbee_status",
]);
export const HwDriverKind = z.enum(["fake", "real"]);
export const HwErrorCode = z.enum(["device_offline", "timeout", "transport", "invalid"]);
export const HwError = z.strictObject({ code: HwErrorCode, message: z.string() });
/** "Accepted by the transport", not "state changed". State changes arrive only as events. */
export const HwAck = z.discriminatedUnion("ok", [
  z.strictObject({ ok: z.literal(true) }),
  z.strictObject({ ok: z.literal(false), error: HwError }),
]);
/** GET /v1/health */
export const HwHealth = z.strictObject({
  ok: z.boolean(),
  mode: HwDriverKind,
  modules: z.strictObject({
    lights: HwDriverKind,
    projector_power: HwDriverKind,
    ir: HwDriverKind,
    hdmi: HwDriverKind,
    projection_screen: HwDriverKind,
    audio: HwDriverKind,
    sensors: HwDriverKind,
    zigbee_status: HwDriverKind,
  }),
});

export type HwModule = z.infer<typeof HwModule>;
export type HwDriverKind = z.infer<typeof HwDriverKind>;
export type HwErrorCode = z.infer<typeof HwErrorCode>;
export type HwError = z.infer<typeof HwError>;
export type HwAck = z.infer<typeof HwAck>;
export type HwHealth = z.infer<typeof HwHealth>;
