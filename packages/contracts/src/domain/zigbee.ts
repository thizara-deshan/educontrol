import { z } from "zod";
import { Timestamp } from "../common.ts";

export const ZigbeeNode = z.object({
  ieee: z.string(),
  friendly_name: z.string(),
  model: z.string(),
  role: z.enum(["router", "end_device"]),
  power_source: z.enum(["mains", "battery"]),
  lqi: z.number().int().min(0).max(255).nullable(),
  battery_pct: z.number().int().min(0).max(100).nullable(),
  last_seen: Timestamp.nullable(),
  online: z.boolean(),
});
export const Coordinator = z.object({
  model: z.string(),
  chipset: z.string(),
  firmware: z.string(),
  channel: z.number().int(),
  tx_power_dbm: z.number(),
  port: z.string(),
  antenna: z.string(),
  status: z.enum(["online", "offline", "starting"]),
});
export const Mesh = z.object({
  paired: z.number().int(),
  routers: z.number().int(),
  end_devices: z.number().int(),
  joining: z.discriminatedUnion("state", [
    z.object({ state: z.literal("closed") }),
    z.object({ state: z.literal("open"), until: Timestamp }),
  ]),
});

export type ZigbeeNode = z.infer<typeof ZigbeeNode>;
export type Coordinator = z.infer<typeof Coordinator>;
export type Mesh = z.infer<typeof Mesh>;
