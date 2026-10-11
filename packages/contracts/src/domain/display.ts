import { z } from "zod";
import { Timestamp } from "../common.ts";

export const HdmiInput = z.enum(["podium_pc", "smart_board"]);
export const ProjectorState = z.enum(["standby", "warming_up", "running", "cooling_down", "unknown"]);
export const ScreenPosition = z.enum(["raised", "lowered", "moving", "unknown"]);
export const PowerReading = z.object({
  watts: z.number(),
  volts: z.number(),
  kwh_today: z.number(),
  rating_a: z.number(),
  at: Timestamp,
});
export const ProjectorFeedback = z.object({ // H7b
  last_ir: z.enum(["power_on", "power_off"]).nullable(),
  sent_at: Timestamp.nullable(),
  phase: z.enum(["idle", "waiting_for_draw", "no_change"]),
});

export type HdmiInput = z.infer<typeof HdmiInput>;
export type ProjectorState = z.infer<typeof ProjectorState>;
export type ScreenPosition = z.infer<typeof ScreenPosition>;
export type PowerReading = z.infer<typeof PowerReading>;
export type ProjectorFeedback = z.infer<typeof ProjectorFeedback>;
