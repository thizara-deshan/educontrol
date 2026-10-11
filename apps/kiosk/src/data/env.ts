import { z } from "zod";

// zod at the env boundary (CLAUDE.md). `.env.development` sets mock; a production build
// without the variable talks to core-api.
const KioskEnv = z.object({
  VITE_API_MODE: z.enum(["mock", "http"]).default("http"),
  /** Shown before the first snapshot (H1: "Header shows R-101"). */
  VITE_ROOM_ID: z.string().min(1).default("R-101"),
});
export type KioskEnv = z.infer<typeof KioskEnv>;
export type ApiMode = KioskEnv["VITE_API_MODE"];

export function readEnv(env: Record<string, unknown> = import.meta.env): KioskEnv {
  return KioskEnv.parse(env);
}

export const kioskEnv = readEnv();
