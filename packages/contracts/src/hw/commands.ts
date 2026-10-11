import { z } from "zod";
import { Level } from "../common.ts";
import { AudioChannel } from "../domain/audio.ts";
import { HdmiInput } from "../domain/display.ts";
import { LightGang } from "../domain/environment.ts";
import { IrTransport } from "../domain/ir.ts";

export const HwLightsSetRequest = z.strictObject({ gang: LightGang, on: z.boolean() });
export const HwProjectorPowerRelayRequest = z.strictObject({ on: z.boolean() });
export const HwIrSendRequest = z.strictObject({
  transport: IrTransport,
  code_format: z.literal("tuya"),
  code: z.string().min(1),
});
/** Blocks up to timeout_s. POST /v1/ir/learn/cancel has no body. */
export const HwIrLearnRequest = z.strictObject({ transport: IrTransport, timeout_s: z.number().int().min(1).max(60) });
export const HwIrLearnResult = z.discriminatedUnion("status", [
  z.strictObject({ status: z.literal("captured"), code_format: z.literal("tuya"), code: z.string().min(1) }),
  z.strictObject({ status: z.literal("timeout") }),
  z.strictObject({ status: z.literal("cancelled") }),
]);
export const HwHdmiSelectRequest = z.strictObject({ input: HdmiInput });
export const HwProjectionScreenMoveRequest = z.strictObject({ to: z.enum(["raise", "lower"]) });
export const HwAudioLevelRequest = z.strictObject({ channel: AudioChannel, level: Level });
export const HwAudioMuteRequest = z.strictObject({ channel: AudioChannel, muted: z.boolean() });
export const HwZigbeeStatusPermitJoinRequest = z.strictObject({ seconds: z.number().int().min(0).max(254) });

export type HwLightsSetRequest = z.infer<typeof HwLightsSetRequest>;
export type HwProjectorPowerRelayRequest = z.infer<typeof HwProjectorPowerRelayRequest>;
export type HwIrSendRequest = z.infer<typeof HwIrSendRequest>;
export type HwIrLearnRequest = z.infer<typeof HwIrLearnRequest>;
export type HwIrLearnResult = z.infer<typeof HwIrLearnResult>;
export type HwHdmiSelectRequest = z.infer<typeof HwHdmiSelectRequest>;
export type HwProjectionScreenMoveRequest = z.infer<typeof HwProjectionScreenMoveRequest>;
export type HwAudioLevelRequest = z.infer<typeof HwAudioLevelRequest>;
export type HwAudioMuteRequest = z.infer<typeof HwAudioMuteRequest>;
export type HwZigbeeStatusPermitJoinRequest = z.infer<typeof HwZigbeeStatusPermitJoinRequest>;
