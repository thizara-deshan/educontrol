import type { SensorReading } from "@eduscope/contracts";
import { formatCelsius, formatPercent } from "@/lib/format";
import type { ValueTone } from "./state-styles";

/**
 * One sensor reading as shown on S1 tiles (S1.E42–E45) and S2 battery rows (S2.E16–E18):
 * `26.4°`, `61%`, "Detected" (accent), "Clear", "Open" (warn), "Closed". `value` null = H11.
 */
export function sensorReadingDisplay(reading: SensorReading): { value: string | null; tone: ValueTone } {
  switch (reading.kind) {
    case "temperature":
      return { value: reading.value === null ? null : formatCelsius(reading.value, 1), tone: "default" };
    case "humidity":
      return { value: reading.value === null ? null : formatPercent(reading.value), tone: "default" };
    case "occupancy":
      if (reading.value === null) return { value: null, tone: "default" };
      return reading.value === "detected" ? { value: "Detected", tone: "accent" } : { value: "Clear", tone: "default" };
    case "contact":
      if (reading.value === null) return { value: null, tone: "default" };
      return reading.value === "open" ? { value: "Open", tone: "warn" } : { value: "Closed", tone: "default" };
  }
}
