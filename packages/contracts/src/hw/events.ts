import { z } from "zod";
import { Timestamp } from "../common.ts";
import {
  HwAudioStateData, HwCoordinator, HwErrorData, HwHdmiStateData, HwHeartbeatData, HwIrBlasterData,
  HwIrLearnStateData, HwLightsStateData, HwMeshData, HwPlugStateData, HwPowerReadingData, HwRelayStateData,
  HwScreenStateData, HwSensorReadingData, HwZigbeeNode,
} from "./data.ts";
import { HwSnapshot } from "./snapshot.ts";

// Not exported: hw/index.ts must export zod schemas only.
const event = <T extends string, D extends z.ZodType>(type: T, data: D) =>
  z.strictObject({ type: z.literal(type), at: Timestamp, data });

/** One SSE event from GET /v1/events. SSE `event:` equals `type`. */
export const HwEvent = z.discriminatedUnion("type", [
  event("snapshot", HwSnapshot),
  event("lights.state", HwLightsStateData),
  event("projector_power.relay", HwRelayStateData),
  event("projector_power.reading", HwPowerReadingData),
  event("hdmi.state", HwHdmiStateData),
  event("projection_screen.state", HwScreenStateData),
  event("audio.state", HwAudioStateData),
  event("sensors.reading", HwSensorReadingData),
  event("zigbee.node", HwZigbeeNode),
  event("zigbee.coordinator", HwCoordinator),
  event("zigbee.mesh", HwMeshData),
  event("ir.blaster", HwIrBlasterData),
  event("ir.learn", HwIrLearnStateData),
  event("plug.state", HwPlugStateData),
  event("hw.error", HwErrorData),
  event("heartbeat", HwHeartbeatData),
]);

export type HwEvent = z.infer<typeof HwEvent>;
