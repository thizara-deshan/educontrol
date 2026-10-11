import { z } from "zod";
import { CommandBody } from "./command.ts";

export const Weekday = z.enum(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]);
/** Local wall-clock time "HH:MM", 24 h. */
export const ClockTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM (24 h)");

/** Shared with ClassBlockInput (api/schedule.ts): zod v4 cannot .omit() a refined object. */
export const classBlockShape = {
  days: z.array(Weekday).min(1),
  start: ClockTime,
  end: ClockTime,
};
export const startBeforeEnd = (block: { start: string; end: string }): boolean => block.start < block.end;

export const ClassBlock = z
  .object({ id: z.string(), ...classBlockShape })
  .refine(startBeforeEnd, { message: "end must be after start", path: ["end"] });
export const TimedAction = z.object({
  id: z.string(),
  name: z.string().trim().min(1).max(40),
  time: ClockTime,
  days: z.array(Weekday).min(1),
  enabled: z.boolean(),
  steps: z.array(CommandBody).min(1),
});
export const Schedule = z.object({ class_blocks: z.array(ClassBlock), actions: z.array(TimedAction) });

export type Weekday = z.infer<typeof Weekday>;
export type ClockTime = z.infer<typeof ClockTime>;
export type ClassBlock = z.infer<typeof ClassBlock>;
export type TimedAction = z.infer<typeof TimedAction>;
export type Schedule = z.infer<typeof Schedule>;
