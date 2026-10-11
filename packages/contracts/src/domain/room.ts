import { z } from "zod";

export const RoomStatus = z.object({
  level: z.enum(["normal", "degraded", "fault"]),
  text: z.string(), // "All systems normal"
});
export const Room = z.object({
  id: z.string(), // "R-101"
  hostname: z.string(), // "r-101.local"
  status: RoomStatus,
});

export type RoomStatus = z.infer<typeof RoomStatus>;
export type Room = z.infer<typeof Room>;
