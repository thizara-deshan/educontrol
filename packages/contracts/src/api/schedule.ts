import { z } from "zod";
import { classBlockShape, Schedule, startBeforeEnd, TimedAction } from "../domain/schedule.ts";

/** GET /api/schedule */
export const GetScheduleResponse = Schedule;
/** POST/PUT /api/schedule/blocks */
export const ClassBlockInput = z
  .object(classBlockShape)
  .refine(startBeforeEnd, { message: "end must be after start", path: ["end"] });
/** POST/PUT /api/schedule/actions */
export const TimedActionInput = TimedAction.omit({ id: true });

export type GetScheduleResponse = z.infer<typeof GetScheduleResponse>;
export type ClassBlockInput = z.infer<typeof ClassBlockInput>;
export type TimedActionInput = z.infer<typeof TimedActionInput>;
