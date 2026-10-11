import { z } from "zod";

/** PUT /api/settings/pins/room */
export const RoomPinRequest = z.object({ pin: z.string().regex(/^\d{4}$/, "Room PIN is 4 digits") });
/** PUT /api/settings/pins/technician */
export const TechnicianPinRequest = z.object({ pin: z.string().regex(/^\d{6}$/, "Technician PIN is 6 digits") });

export type RoomPinRequest = z.infer<typeof RoomPinRequest>;
export type TechnicianPinRequest = z.infer<typeof TechnicianPinRequest>;
