import { z } from "zod";

/** GET /api/health — liveness for scripts and systemd checks (no session needed). */
export const HealthResponse = z.object({
  ok: z.literal(true),
  hw: z.enum(["up", "down"]),
  rev: z.number().int().nonnegative(),
});

export type HealthResponse = z.infer<typeof HealthResponse>;
