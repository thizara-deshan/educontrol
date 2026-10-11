import { z } from "zod";
import { Level, observed } from "../common.ts";

export const AudioChannel = z.enum(["mic", "pc"]);
export const AudioState = z.object({
  channels: z.object({ mic: observed(Level), pc: observed(Level) }),
  muted_all: observed(z.boolean()),
  saved_levels: z.object({ mic: Level.nullable(), pc: Level.nullable() }), // R9
});

export type AudioChannel = z.infer<typeof AudioChannel>;
export type AudioState = z.infer<typeof AudioState>;
