import type { SensorReading } from "@eduscope/contracts";
import { z } from "zod";

// Dev knobs and small rules for the kiosk behaviour (H23).

const IdleScale = z.coerce.number().positive().max(1);

/** `?idle-scale=0.01` shortens every idle step (dev builds only); anything invalid → 1. */
export function readIdleScale(search: string, dev: boolean): number {
  if (!dev) return 1;
  const raw = new URLSearchParams(search).get("idle-scale");
  if (raw === null) return 1;
  const parsed = IdleScale.safeParse(raw);
  return parsed.success ? parsed.data : 1;
}

type Occupancy = Extract<SensorReading, { kind: "occupancy" }>["value"];

/** Occupancy wakes the kiosk on the transition to `detected` only (H23). */
export function occupancyWakes(prev: Occupancy | undefined, next: Occupancy | undefined): boolean {
  return next === "detected" && prev !== undefined && prev !== "detected";
}
