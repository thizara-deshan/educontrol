import type { z } from "zod";
import { RoomState } from "../state.ts";

/** GET /api/state */
export const GetStateResponse = RoomState;
export type GetStateResponse = z.infer<typeof GetStateResponse>;
