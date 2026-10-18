import type { Device, ZigbeeNode } from "@eduscope/contracts";
import type { StateTone } from "@/components/state-styles";
import { formatAgo } from "@/lib/format";

// PLAN-H05 D3: "Pair devices" — which room Zigbee devices the Pi's coordinator has heard, and how to
// reset each one so it rejoins. A fresh message is the only proof a device is back: zigbee2mqtt keeps a
// battery device "online" for up to 25 h after it moved to another coordinator.

/** A message within this long counts as "Heard just now". */
export const HEARD_JUST_NOW_MS = 60_000;

const RESET_BUTTON = "Hold the button about 5 s until the LED flashes.";
/** Reset steps by model [ASSUMED] until PLAN-H05 T5 confirms them on the devices. */
const RESET_STEPS: Readonly<Record<string, string>> = {
  "SNZB-02P": RESET_BUTTON,
  "SNZB-03P": RESET_BUTTON,
  "SNZB-04PR2": RESET_BUTTON,
  ZS06: "Hold the reset pin about 5 s until the LED flashes fast.",
};
const RESET_UNKNOWN = "See the device manual.";

export interface PairingRow {
  id: string;
  name: string;
  model: string;
  hwRef: string;
  resetSteps: string;
  tone: StateTone;
  status: string;
}

function status(node: ZigbeeNode, now: Date): Pick<PairingRow, "tone" | "status"> {
  const seenMs = node.last_seen === null ? null : now.getTime() - Date.parse(node.last_seen);
  if (seenMs !== null && seenMs <= HEARD_JUST_NOW_MS) return { tone: "confirmed", status: "Heard just now" };
  if (!node.online) return { tone: "offline", status: "Offline" };
  if (node.last_seen === null) return { tone: "unknown", status: "Not heard yet" };
  return { tone: "off", status: `Last heard ${formatAgo(node.last_seen, now)}` };
}

function row(id: string, name: string, node: ZigbeeNode, now: Date): PairingRow {
  return {
    id, name, model: node.model, hwRef: node.friendly_name,
    resetSteps: RESET_STEPS[node.model] ?? RESET_UNKNOWN, ...status(node, now),
  };
}

/**
 * Every device the coordinator reports: registry Zigbee devices first (registry name and order), then
 * paired devices with no registry entry under their zigbee2mqtt name, so removing a registry row
 * never hides a device that still has to be paired.
 */
export function pairingRows(devices: readonly Device[], nodes: readonly ZigbeeNode[], now: Date): PairingRow[] {
  const inRegistry = new Set<string>();
  const registered = devices.flatMap((device) => {
    if (device.transport !== "zigbee" || device.hw_ref === null) return [];
    const node = nodes.find((candidate) => candidate.friendly_name === device.hw_ref);
    if (node === undefined) return [];
    inRegistry.add(node.friendly_name);
    return [row(device.id, device.name, node, now)];
  });
  const unregistered = nodes
    .filter((node) => !inRegistry.has(node.friendly_name))
    .map((node) => row(node.ieee, node.friendly_name, node, now));
  return [...registered, ...unregistered];
}
