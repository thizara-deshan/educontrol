import type { z } from "zod";
import { AboutInfo, NetworkInfo } from "../domain/system.ts";

/** GET /api/system/network */
export const GetNetworkResponse = NetworkInfo;
/** GET /api/system/about */
export const GetAboutResponse = AboutInfo;

export type GetNetworkResponse = z.infer<typeof GetNetworkResponse>;
export type GetAboutResponse = z.infer<typeof GetAboutResponse>;
