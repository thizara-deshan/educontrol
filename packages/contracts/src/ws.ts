import { z } from "zod";
import { ChangedBy, ClientLabel, Timestamp } from "./common.ts";
import { Command } from "./domain/command.ts";
import { IrCaptureStatus } from "./domain/ir.ts";
import { ClientSession } from "./domain/session.ts";
import { RoomState } from "./state.ts";

/** Server → client. The WS is receive-only for commands (D-03). */
export const ServerEvent = z.discriminatedUnion("type", [
  z.object({ type: z.literal("snapshot"), state: RoomState }),
  z.object({ type: z.literal("state"), state: RoomState }),
  z.object({ type: z.literal("command"), command: Command }),
  z.object({ type: z.literal("activity"), text: z.string(), by: ChangedBy, public_id: z.string().nullable() }),
  z.object({
    type: z.literal("ir_capture"),
    command_id: z.string(),
    status: IrCaptureStatus,
    deadline: Timestamp.nullable(),
  }),
  z.object({ type: z.literal("invalidate"), keys: z.array(z.array(z.string()).min(1)) }),
  z.object({ type: z.literal("session"), session: ClientSession }),
  z.object({ type: z.literal("ping") }),
]);

/** Client → server. Anything else is dropped by core-api. */
export const ClientMessage = z.discriminatedUnion("type", [
  z.object({ type: z.literal("hello"), label: ClientLabel }),
  z.object({ type: z.literal("pong") }),
]);

export type ServerEvent = z.infer<typeof ServerEvent>;
export type ClientMessage = z.infer<typeof ClientMessage>;
