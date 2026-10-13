import type { Device, RoomState, ZigbeeNode } from "@eduscope/contracts";
import { sensorReadingDisplay } from "@/components/sensor-reading";
import type { ValueTone } from "@/components/state-styles";
import { formatAgo } from "@/lib/format";

// S2.E14–E19: battery end devices (H8, H10, H11, H16, R13).

export type BatterySeverity = "ok" | "low" | "critical" | "unknown";

/** H16: ≤20% low (amber), ≤10% critical (red). */
export function batterySeverity(pct: number | null): BatterySeverity {
  if (pct === null) return "unknown";
  if (pct <= 10) return "critical";
  if (pct <= 20) return "low";
  return "ok";
}

/** S2.E16 LAST SEEN: `12s ago` (server time), `Offline · 5 min ago`, `Offline`, `—`. */
export function lastSeenText(lastSeen: string | null, online: boolean, now: Date): string {
  if (!online) return lastSeen === null ? "Offline" : `Offline · ${formatAgo(lastSeen, now)}`;
  return lastSeen === null ? "—" : formatAgo(lastSeen, now);
}

export interface BatteryRowView {
  key: string;
  /** Device name from the registry ("Room climate"), else the friendly name. */
  name: string;
  /** `SNZB-02P · r101_temp` (mono). */
  ids: string;
  /** `26.4° · 61%`, "Detected", "Closed"; null = no reading ever (H11). */
  reading: string | null;
  readingTone: ValueTone;
  battery: string;
  batteryTone: ValueTone;
  link: string;
  lastSeen: string;
  lastSeenTone: ValueTone;
}

type Sensors = RoomState["environment"]["sensors"];

const BATTERY_TONE: Record<BatterySeverity, ValueTone> = { ok: "muted", low: "warn", critical: "danger", unknown: "faint" };

/** One row per battery node, in the coordinator's order. Empty = S2.E19 "No battery devices paired". */
export function batteryRows(nodes: readonly ZigbeeNode[], devices: readonly Device[], sensors: Sensors, now: Date): BatteryRowView[] {
  const readings = [sensors.temperature, sensors.humidity, sensors.occupancy, sensors.contact];
  return nodes
    .filter((node) => node.power_source === "battery")
    .map((node): BatteryRowView => {
      const own = readings.filter((reading) => reading.node === node.friendly_name);
      const shown = own.map(sensorReadingDisplay);
      const values = shown.flatMap((item) => (item.value === null ? [] : [item.value]));
      const stale = own.some((reading) => reading.stale);
      const dim = stale || !node.online; // H10 / H8: the last value stays, in text-3
      const single = shown.length === 1 ? shown[0] : undefined;
      return {
        key: node.ieee,
        name: devices.find((device) => device.hw_ref === node.friendly_name)?.name ?? node.friendly_name,
        ids: `${node.model} · ${node.friendly_name}`,
        reading: values.length === 0 ? null : values.join(" · "),
        readingTone: dim ? "faint" : (single?.tone ?? "default"),
        battery: node.battery_pct === null ? "—" : `${node.battery_pct}%`,
        batteryTone: BATTERY_TONE[batterySeverity(node.battery_pct)],
        link: !node.online || node.lqi === null ? "—" : String(node.lqi),
        lastSeen: lastSeenText(node.last_seen, node.online, now),
        lastSeenTone: !node.online ? "danger" : stale ? "warn" : "muted",
      };
    });
}
