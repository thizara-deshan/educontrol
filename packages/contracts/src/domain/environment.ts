import { z } from "zod";
import { observed, Timestamp } from "../common.ts";

export const LightGang = z.enum(["front", "rear"]);
export const AcState = z.object({ // R3: never "confirmed"
  power: observed(z.enum(["on", "off"])),
  setpoint_c: observed(z.number().int()),
  available_setpoints: z.array(z.number().int()), // R4: captured frames only, ascending
});

export const SensorKind = z.enum(["temperature", "humidity", "occupancy", "contact"]);
export const SensorReading = z
  .discriminatedUnion("kind", [
    z.object({ kind: z.literal("temperature"), value: z.number().nullable() }),
    z.object({ kind: z.literal("humidity"), value: z.number().int().nullable() }),
    z.object({ kind: z.literal("occupancy"), value: z.enum(["detected", "clear"]).nullable() }),
    z.object({ kind: z.literal("contact"), value: z.enum(["open", "closed"]).nullable() }),
  ])
  .and(z.object({ node: z.string(), at: Timestamp.nullable(), stale: z.boolean() }));

export type LightGang = z.infer<typeof LightGang>;
export type AcState = z.infer<typeof AcState>;
export type SensorKind = z.infer<typeof SensorKind>;
export type SensorReading = z.infer<typeof SensorReading>;
