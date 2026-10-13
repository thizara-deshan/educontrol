import type { Device, RoomState, SensorKind } from "@eduscope/contracts";
import { sensorReadingDisplay } from "@/components/sensor-reading";
import type { StateTone, ValueTone } from "@/components/state-styles";
import { formatAgo } from "@/lib/format";

// S1.E41–E45 (R13, H8/H9, H10, H11). Counts devices, not tiles: climate = 1 device, 2 tiles.

export interface SensorTileView {
  kind: SensorKind;
  label: string;
  /** Formatted value, or null = no reading ever (H11). */
  value: string | null;
  /** Model from the device registry, e.g. `SNZB-02P`. */
  caption: string;
  tone: ValueTone;
  /** Numbers in mono 24px; words ("Detected", "Closed") in sans 18px. */
  numeric: boolean;
  /** Caption suffix: `14 min ago` (H10) or `offline` (H8/H9); null when fresh. */
  suffix: string | null;
}

export interface SensorsView {
  reportingTone: StateTone;
  reportingText: string;
  tiles: SensorTileView[];
}

type Sensors = RoomState["environment"]["sensors"];

const LABELS: Record<SensorKind, string> = {
  temperature: "Temperature",
  humidity: "Humidity",
  occupancy: "Occupancy",
  contact: "Door",
};

export function reportingLine({ count, of }: Sensors["reporting"]): { tone: StateTone; text: string } {
  if (of > 0 && count >= of) return { tone: "confirmed", text: `${count} reporting` };
  if (count === 0) return { tone: "offline", text: "No sensors reporting" };
  return { tone: "warning", text: `${count} of ${of} reporting` };
}

export function sensorsView(sensors: Sensors, devices: readonly Device[], now: Date): SensorsView {
  const reporting = reportingLine(sensors.reporting);
  const tiles = [sensors.temperature, sensors.humidity, sensors.occupancy, sensors.contact].map((reading): SensorTileView => {
    const device = devices.find((d) => d.hw_ref === reading.node);
    const { value, tone } = sensorReadingDisplay(reading);
    const suffix =
      device?.online.value === false ? "offline" : reading.stale && reading.at !== null ? formatAgo(reading.at, now) : null;
    const numeric = reading.kind === "temperature" || reading.kind === "humidity";
    return { kind: reading.kind, label: LABELS[reading.kind], value, caption: device?.model ?? reading.node, tone, numeric, suffix };
  });
  return { reportingTone: reporting.tone, reportingText: reporting.text, tiles };
}
