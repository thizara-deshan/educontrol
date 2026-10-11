import { z } from "zod";
import { ClientLabel, Level, Timestamp } from "../common.ts";
import { AudioChannel } from "./audio.ts";
import { HdmiInput } from "./display.ts";
import { LightGang } from "./environment.ts";

export const CommandBody = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("source.select"), input: HdmiInput }),
  z.object({ kind: z.literal("projector.power"), on: z.boolean() }),
  z.object({ kind: z.literal("projector.mains"), on: z.boolean() }), // technician, R11
  z.object({ kind: z.literal("screen.move"), to: z.enum(["raise", "lower"]) }),
  z.object({ kind: z.literal("audio.level"), channel: AudioChannel, level: Level, final: z.boolean() }),
  z.object({ kind: z.literal("audio.mute_all"), muted: z.boolean() }),
  z.object({ kind: z.literal("lights.set"), gang: LightGang, on: z.boolean() }),
  z.object({ kind: z.literal("ac.power"), on: z.boolean() }),
  z.object({ kind: z.literal("ac.step"), direction: z.enum(["down", "up"]) }),
]);
export const CommandRequest = z.object({ client_cmd_id: z.uuid(), body: CommandBody });
export const CommandStatus = z.enum(["pending", "sent", "confirmed", "assumed", "failed", "timed_out"]);
export const Command = z.object({
  id: z.string(),
  client_cmd_id: z.uuid(),
  body: CommandBody,
  issued_by: z.object({ public_id: z.string(), label: ClientLabel }).nullable(), // null = schedule
  status: CommandStatus,
  error: z.string().nullable(),
  at: Timestamp,
});

export type CommandBody = z.infer<typeof CommandBody>;
export type CommandRequest = z.infer<typeof CommandRequest>;
export type CommandStatus = z.infer<typeof CommandStatus>;
export type Command = z.infer<typeof Command>;
