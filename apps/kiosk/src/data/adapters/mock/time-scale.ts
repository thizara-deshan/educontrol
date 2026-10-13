import { z } from "zod";

const TimeScale = z.coerce.number().positive().max(1);

/**
 * `?time-scale=0.1` speeds up the mock's timed behaviour (projector ramp, H7b 90 s, screen travel)
 * in dev builds; the hw-service fake has `HW_FAKE_TIME_SCALE` for the same purpose. Invalid → 1.
 */
export function readTimeScale(search: string, dev: boolean): number {
  if (!dev) return 1;
  const raw = new URLSearchParams(search).get("time-scale");
  if (raw === null) return 1;
  const parsed = TimeScale.safeParse(raw);
  return parsed.success ? parsed.data : 1;
}
