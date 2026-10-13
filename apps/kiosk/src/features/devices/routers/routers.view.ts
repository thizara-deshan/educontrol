import type { Device, Observed, ZigbeeNode } from "@eduscope/contracts";
import { stateTone, type ActiveVariant, type StateTone } from "@/components/state-styles";
import { formatAgo } from "@/lib/format";

// S2.E5–E13: the two mains-powered routers (H8, H10, H11).

export interface RouterHeaderView {
  title: string;
  /** `ZBM5-2C-86W · r101_lights` (mono). */
  ids: string;
  online: boolean;
  tone: StateTone;
  /** Online: `LQI 214`. Offline: `Offline · last seen 5 min ago` in its place (S2.E6). */
  link: string;
}

/** `device` = the registry entry ("lights", "projector_socket"); `node` = its Zigbee node by friendly name. */
export function routerHeaderView(device: Device, node: ZigbeeNode | undefined, now: Date): RouterHeaderView {
  const online = node?.online === true;
  const lastSeen = node?.last_seen ?? null;
  return {
    title: device.name,
    ids: `${node?.model ?? device.model ?? "—"} · ${node?.friendly_name ?? device.hw_ref ?? "—"}`,
    online,
    tone: online ? "confirmed" : "offline",
    link: online
      ? `LQI ${node.lqi === null ? "—" : String(node.lqi)}`
      : lastSeen === null
        ? "Offline"
        : `Offline · last seen ${formatAgo(lastSeen, now)}`,
  };
}

export interface GangTileView {
  tone: StateTone;
  text: "On" | "Off" | "Unknown";
  /** Tile fill: green for confirmed On (screenshot 02), amber for an assumed On, neutral otherwise. */
  fill: ActiveVariant | null;
}

/** S2.E7/E8/E11: a read-only On/Off tile (Q11). */
export function gangTileView(state: Observed<boolean>): GangTileView {
  const tone = stateTone({ confidence: state.confidence, active: state.value === true, hasValue: state.value !== null });
  if (state.value === null) return { tone, text: "Unknown", fill: null };
  if (!state.value) return { tone, text: "Off", fill: null };
  return { tone, text: "On", fill: tone === "assumed" ? "assumed" : "confirmed" };
}
