import { z } from "zod";

export const Timestamp = z.iso.datetime({ offset: true });

export const Confidence = z.enum(["confirmed", "assumed", "unknown"]);
export const Source = z.enum([
  "switch", "power_meter", "hdmi_switch", "mixer", "ir", "sensor", "manual", "none",
]);
export const ClientLabel = z.enum(["room screen", "phone", "tablet", "laptop", "podium PC"]);
export const ChangedBy = z.union([ClientLabel, z.literal("by hand"), z.literal("schedule")]);

/** Wraps every hardware value: what the server believes and how sure it is. */
export const observed = <T extends z.ZodType>(value: T) =>
  z.object({
    value: value.nullable(),
    confidence: Confidence,
    source: Source,
    updated_at: Timestamp.nullable(), // null = never reported (H11)
    stale: z.boolean(), // computed by core-api (R13)
    changed_by: ChangedBy.nullable(),
  });

/** Hand-written twin of z.infer<ReturnType<typeof observed>> so components can be generic. */
export type Observed<T> = {
  value: T | null;
  confidence: z.infer<typeof Confidence>;
  source: z.infer<typeof Source>;
  updated_at: string | null;
  stale: boolean;
  changed_by: z.infer<typeof ChangedBy> | null;
};

export const AccessLevel = z.enum(["view", "control", "technician"]);
export const Level = z.number().int().min(0).max(100);

export type Timestamp = z.infer<typeof Timestamp>;
export type Confidence = z.infer<typeof Confidence>;
export type Source = z.infer<typeof Source>;
export type ClientLabel = z.infer<typeof ClientLabel>;
export type ChangedBy = z.infer<typeof ChangedBy>;
export type AccessLevel = z.infer<typeof AccessLevel>;
export type Level = z.infer<typeof Level>;
