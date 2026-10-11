import { z } from "zod";
import { AccessLevel, ClientLabel } from "../common.ts";
import { ClientType } from "./session.ts";

export const NetworkConnection = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("ethernet") }),
  z.object({ kind: z.literal("wifi"), ssid: z.string(), signal_pct: z.number().int().min(0).max(100).nullable() }),
  z.object({ kind: z.literal("none") }),
]);
export const ConnectedClient = z.object({
  public_id: z.string().nullable(), // null = socket without a session (view)
  label: ClientLabel,
  client_type: ClientType,
  access: AccessLevel,
});
export const NetworkInfo = z.object({ // S3b
  hostname: z.string(),
  address: z.string().nullable(),
  connection: NetworkConnection,
  controller: z.object({ hw: z.enum(["up", "down"]) }),
  clients: z.array(ConnectedClient),
});
export const AboutInfo = z.object({ // S3e
  room: z.string(),
  version: z.string(),
  uptime_s: z.number().int().nonnegative(),
  pi_model: z.string().nullable(),
  url: z.url(),
});

export type NetworkConnection = z.infer<typeof NetworkConnection>;
export type ConnectedClient = z.infer<typeof ConnectedClient>;
export type NetworkInfo = z.infer<typeof NetworkInfo>;
export type AboutInfo = z.infer<typeof AboutInfo>;
