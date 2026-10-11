import { z } from "zod";
import { Device } from "../domain/device.ts";

/** GET /api/devices (PATCH body: DevicePatch) */
export const DeviceList = z.array(Device);
/** POST /api/zigbee/permit-join — always 4 minutes (S3d). */
export const PermitJoinRequest = z.object({ seconds: z.literal(240) });

export type DeviceList = z.infer<typeof DeviceList>;
export type PermitJoinRequest = z.infer<typeof PermitJoinRequest>;
