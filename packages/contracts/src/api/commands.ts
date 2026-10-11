import type { z } from "zod";
import { Command } from "../domain/command.ts";

/** POST /api/commands (body: CommandRequest) → 202 */
export const PostCommandResponse = Command;
export type PostCommandResponse = z.infer<typeof PostCommandResponse>;
