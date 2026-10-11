import { z } from "zod";
import { AccessLevel, ClientLabel, Timestamp } from "../common.ts";

export const ClientType = z.enum(["kiosk", "remote"]);
export const ClientSession = z.object({
  public_id: z.string(), // safe to broadcast; never the cookie id
  client_type: ClientType,
  label: ClientLabel,
  access: AccessLevel,
  unlocked_at: Timestamp.nullable(),
  last_activity: Timestamp.nullable(),
  expires_at: Timestamp.nullable(),
});

export type ClientType = z.infer<typeof ClientType>;
export type ClientSession = z.infer<typeof ClientSession>;
