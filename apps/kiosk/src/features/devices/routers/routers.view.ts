import type { Device, ZigbeeNode } from "@eduscope/contracts";
import type { StateTone } from "@/components/state-styles";
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
