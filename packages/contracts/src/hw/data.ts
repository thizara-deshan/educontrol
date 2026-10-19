import { z } from "zod";
import { Level, Timestamp } from "../common.ts";
import { AudioChannel } from "../domain/audio.ts";
import { HdmiInput } from "../domain/display.ts";
import { LightGang } from "../domain/environment.ts";
import { HwErrorCode, HwModule } from "./common.ts";

export const HwScreenPosition = z.enum(["raised", "lowered", "moving", "unknown"]);
export const HwLightsStateData = z.strictObject({ gang: LightGang, on: z.boolean() });
export const HwRelayStateData = z.strictObject({ on: z.boolean() });
export const HwPowerReadingData = z.strictObject({
  watts: z.number().nonnegative(),
  volts: z.number().nonnegative(),
  energy_kwh_total: z.number().nonnegative(), // core-api derives kwh_today
});
export const HwHdmiStateData = z.strictObject({ input: HdmiInput });
export const HwScreenStateData = z.strictObject({ position: HwScreenPosition });
export const HwAudioStateData = z.strictObject({ channel: AudioChannel, level: Level, muted: z.boolean() });
export const HwSensorReadingData = z.discriminatedUnion("kind", [
  z.strictObject({ node: z.string(), kind: z.literal("temperature"), value: z.number() }),
  z.strictObject({ node: z.string(), kind: z.literal("humidity"), value: z.number().int().min(0).max(100) }),
  z.strictObject({ node: z.string(), kind: z.literal("occupancy"), value: z.enum(["detected", "clear"]) }),
  z.strictObject({ node: z.string(), kind: z.literal("contact"), value: z.enum(["open", "closed"]) }),
]);
export const HwZigbeeNode = z.strictObject({
  ieee: z.string(),
  friendly_name: z.string(),
  model: z.string(),
  role: z.enum(["router", "end_device"]),
  power_source: z.enum(["mains", "battery"]),
  lqi: z.number().int().min(0).max(255).nullable(),
  battery_pct: z.number().int().min(0).max(100).nullable(),
  last_seen: Timestamp.nullable(),
  online: z.boolean(),
});
export const HwCoordinator = z.strictObject({
  model: z.string(),
  chipset: z.string(),
  firmware: z.string(),
  channel: z.number().int().min(11).max(26),
  tx_power_dbm: z.number(),
  port: z.string(),
  antenna: z.string(),
  status: z.enum(["online", "offline", "starting"]),
});
/** Counts are derived by core-api from the node list. */
export const HwMeshData = z.strictObject({ joining_until: Timestamp.nullable() });
export const HwIrBlasterData = z.strictObject({ online: z.boolean(), lqi: z.number().int().min(0).max(255).nullable() });
export const HwIrLearnStateData = z.strictObject({ status: z.enum(["listening", "captured", "timeout", "cancelled"]) });
/** D-34: the smart plug's full state as last reported; null = not reported yet. */
export const HwPlugStateData = z.strictObject({
  online: z.boolean(),
  on: z.boolean().nullable(),
  watts: z.number().nonnegative().nullable(),
  volts: z.number().nonnegative().nullable(),
  amps: z.number().nonnegative().nullable(),
  kwh_today: z.number().nonnegative().nullable(),
});
export const HwErrorData = z.strictObject({ module: HwModule, code: HwErrorCode, message: z.string() });
export const HwHeartbeatData = z.strictObject({});

export type HwScreenPosition = z.infer<typeof HwScreenPosition>;
export type HwLightsStateData = z.infer<typeof HwLightsStateData>;
export type HwRelayStateData = z.infer<typeof HwRelayStateData>;
export type HwPowerReadingData = z.infer<typeof HwPowerReadingData>;
export type HwHdmiStateData = z.infer<typeof HwHdmiStateData>;
export type HwScreenStateData = z.infer<typeof HwScreenStateData>;
export type HwAudioStateData = z.infer<typeof HwAudioStateData>;
export type HwSensorReadingData = z.infer<typeof HwSensorReadingData>;
export type HwZigbeeNode = z.infer<typeof HwZigbeeNode>;
export type HwCoordinator = z.infer<typeof HwCoordinator>;
export type HwMeshData = z.infer<typeof HwMeshData>;
export type HwIrBlasterData = z.infer<typeof HwIrBlasterData>;
export type HwIrLearnStateData = z.infer<typeof HwIrLearnStateData>;
export type HwPlugStateData = z.infer<typeof HwPlugStateData>;
export type HwErrorData = z.infer<typeof HwErrorData>;
export type HwHeartbeatData = z.infer<typeof HwHeartbeatData>;
