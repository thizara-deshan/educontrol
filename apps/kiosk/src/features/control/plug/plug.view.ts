import type { RoomState } from "@eduscope/contracts";
import type { StateTone } from "@/components/state-styles";
import { formatAgo } from "@/lib/format";

// D-34: the general-purpose smart plug on S1 — its relay (confirmed by the plug's report) and its meter.

export interface PlugMetric {
  label: string;
  /** `42.5`; null = never reported (H11). */
  value: string | null;
  unit: string;
}

export interface PlugView {
  tone: StateTone;
  line: string;
  online: boolean;
  metrics: PlugMetric[];
  /** H10: `14 min ago` when the meter is stale, else null. */
  staleAgo: string | null;
}

const metric = (label: string, value: number | null, digits: number, unit: string): PlugMetric => ({
  label, value: value === null ? null : value.toFixed(digits), unit,
});

export function plugView(plug: RoomState["plug"], now: Date | null): PlugView {
  const meter = plug.reading.value;
  const tone: StateTone = !plug.online ? "offline" : plug.on.value === null ? "unknown" : "confirmed";
  const line = !plug.online
    ? "Plug offline · last known state"
    : plug.on.value === null
      ? "Waiting for the plug"
      : "Confirmed by the plug";
  const staleAgo = plug.reading.stale && plug.reading.updated_at !== null && now !== null ? formatAgo(plug.reading.updated_at, now) : null;
  return {
    tone, line, online: plug.online, staleAgo,
    metrics: [
      metric("Power", meter?.watts ?? null, 1, "W"),
      metric("Voltage", meter?.volts ?? null, 0, "V"),
      metric("Current", meter?.amps ?? null, 2, "A"),
      metric("Today", meter?.kwh_today ?? null, 2, "kWh"),
    ],
  };
}

/** A tap sends the opposite of the server value; unknown (null) turns it on. */
export function nextPlugOn(value: boolean | null): boolean {
  return value !== true;
}
