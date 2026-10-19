import { z } from "zod";

/** D-34: the general-purpose smart plug's meter, as last reported; null = not reported yet. */
export const PlugReading = z.object({
  watts: z.number().nullable(),
  volts: z.number().nullable(),
  amps: z.number().nullable(),
  kwh_today: z.number().nullable(),
});

export type PlugReading = z.infer<typeof PlugReading>;
