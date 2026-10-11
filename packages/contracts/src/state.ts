import { z } from "zod";
import { observed, Timestamp } from "./common.ts";
import { AudioState } from "./domain/audio.ts";
import { Device } from "./domain/device.ts";
import { HdmiInput, PowerReading, ProjectorFeedback, ProjectorState, ScreenPosition } from "./domain/display.ts";
import { AcState, SensorReading } from "./domain/environment.ts";
import { Interlock } from "./domain/interlock.ts";
import { IrBlaster } from "./domain/ir.ts";
import { Room } from "./domain/room.ts";
import { Coordinator, Mesh, ZigbeeNode } from "./domain/zigbee.ts";

/** The full snapshot pushed to every client. */
export const RoomState = z.object({
  rev: z.number().int().nonnegative(), // monotonic; client drops older revs
  server_time: Timestamp,
  room: Room,
  connection: z.object({ hw: z.enum(["up", "down"]) }),
  display: z.object({
    source: observed(HdmiInput),
    projector: z.object({
      state: observed(ProjectorState),
      power: observed(PowerReading),
      feedback: ProjectorFeedback,
      mains: observed(z.boolean()),
    }),
    screen: observed(ScreenPosition),
  }),
  audio: AudioState,
  environment: z.object({
    lights: z.object({ front: observed(z.boolean()), rear: observed(z.boolean()) }),
    ac: AcState,
    sensors: z.object({
      temperature: SensorReading,
      humidity: SensorReading,
      occupancy: SensorReading,
      contact: SensorReading,
      reporting: z.object({ count: z.number().int(), of: z.number().int() }), // S1.E41
    }),
  }),
  zigbee: z.object({ coordinator: Coordinator, mesh: Mesh, nodes: z.array(ZigbeeNode) }),
  ir_blaster: IrBlaster,
  interlock: Interlock,
  devices: z.array(Device), // online state per device (H8)
});

export type RoomState = z.infer<typeof RoomState>;
