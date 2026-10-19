import { z } from "zod";
import { Level, Timestamp } from "../common.ts";
import { HdmiInput } from "../domain/display.ts";
import {
  HwCoordinator, HwIrBlasterData, HwPlugStateData, HwScreenPosition, HwSensorReadingData, HwZigbeeNode,
} from "./data.ts";

export const HwPowerSample = z.strictObject({
  at: Timestamp,
  watts: z.number().nonnegative(),
  volts: z.number().nonnegative(),
  energy_kwh_total: z.number().nonnegative(),
});
export const HwSensorSample = z.strictObject({ at: Timestamp, reading: HwSensorReadingData });
export const HwAudioChannelState = z.strictObject({ level: Level, muted: z.boolean() });
/** GET /v1/snapshot and the first SSE event. null = not known yet. */
export const HwSnapshot = z.strictObject({
  lights: z.strictObject({ front: z.boolean().nullable(), rear: z.boolean().nullable() }),
  projector_power: z.strictObject({ relay: z.boolean().nullable(), reading: HwPowerSample.nullable() }),
  hdmi: z.strictObject({ input: HdmiInput.nullable() }),
  projection_screen: z.strictObject({ position: HwScreenPosition }),
  audio: z.strictObject({ mic: HwAudioChannelState.nullable(), pc: HwAudioChannelState.nullable() }),
  sensors: z.array(HwSensorSample), // latest reading per (node, kind)
  zigbee: z.strictObject({
    coordinator: HwCoordinator.nullable(),
    nodes: z.array(HwZigbeeNode),
    joining_until: Timestamp.nullable(),
  }),
  ir: z.strictObject({ blaster: HwIrBlasterData.nullable() }),
  plug: HwPlugStateData.nullable(),
});

export type HwPowerSample = z.infer<typeof HwPowerSample>;
export type HwSensorSample = z.infer<typeof HwSensorSample>;
export type HwAudioChannelState = z.infer<typeof HwAudioChannelState>;
export type HwSnapshot = z.infer<typeof HwSnapshot>;
