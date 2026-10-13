import type { Coordinator, Device, Interlock, Mesh, ZigbeeNode } from "@eduscope/contracts";
import type { CalloutVariant, StateTone, ValueTone } from "@/components/state-styles";
import { formatCountdown, formatWatts } from "@/lib/format";

// S2.E20–E23: the side column (H9, H15, R7, R11).

export interface SideRow {
  label: string;
  value: string;
  tone: ValueTone;
}

export interface CoordinatorView {
  model: string;
  /** H9: values greyed while the coordinator is offline. */
  greyed: boolean;
  rows: SideRow[];
}

/** S2.E20: `ZG-808Z`, Chipset … Antenna (values mono, right-aligned). */
export function coordinatorView(coordinator: Coordinator): CoordinatorView {
  const greyed = coordinator.status === "offline";
  const tone: ValueTone = greyed ? "faint" : "default";
  const tx = coordinator.tx_power_dbm;
  return {
    model: coordinator.model,
    greyed,
    rows: [
      { label: "Chipset", value: coordinator.chipset, tone },
      { label: "Firmware", value: coordinator.firmware, tone },
      { label: "Channel", value: String(coordinator.channel), tone },
      { label: "Transmit", value: `${tx >= 0 ? "+" : ""}${tx} dBm`, tone },
      { label: "Port", value: coordinator.port, tone },
      { label: "Antenna", value: coordinator.antenna, tone },
    ],
  };
}

/** S2.E21 Joining: "Closed", or "Open · 4:12 left" (amber) counting down on server time. */
export function joiningText(joining: Mesh["joining"], now: Date): { text: string; tone: ValueTone } {
  if (joining.state === "closed") return { text: "Closed", tone: "default" };
  const leftS = (Date.parse(joining.until) - now.getTime()) / 1000;
  return { text: `Open · ${formatCountdown(leftS)} left`, tone: "warn" };
}

export interface MeshView {
  paired: string;
  greyed: boolean;
  rows: SideRow[];
}

/** S2.E21: `5` devices paired; Routers `2` (accent), End devices `3`, Joining. Greyed when the coordinator is offline (H9). */
export function meshView(mesh: Mesh, coordinatorStatus: Coordinator["status"], now: Date): MeshView {
  const greyed = coordinatorStatus === "offline";
  const tone = (normal: ValueTone): ValueTone => (greyed ? "faint" : normal);
  const joining = joiningText(mesh.joining, now);
  return {
    paired: String(mesh.paired),
    greyed,
    rows: [
      { label: "Routers", value: String(mesh.routers), tone: tone("accent") },
      { label: "End devices", value: String(mesh.end_devices), tone: tone("default") },
      { label: "Joining", value: joining.text, tone: tone(joining.tone) },
    ],
  };
}

export interface CalloutView {
  variant: CalloutVariant;
  title: string;
  body: string;
}

const REDUNDANT_BODY =
  "Battery sensors can reach the coordinator through either the lighting switch or the projector socket. Losing one still leaves the room reporting.";

/** S2.E22 (R7): routers = mains nodes with role `router`; names from the device registry, lower-cased in the copy. */
export function calloutView(nodes: readonly ZigbeeNode[], devices: readonly Device[]): CalloutView {
  const routers = nodes
    .filter((node) => node.role === "router")
    .map((node) => ({
      name: (devices.find((device) => device.hw_ref === node.friendly_name)?.name ?? node.friendly_name).toLowerCase(),
      online: node.online,
    }));
  const online = routers.filter((router) => router.online).length;
  const offline = routers.filter((router) => !router.online).map((router) => router.name);
  if (online >= 2) return { variant: "redundant", title: "TWO ROUTERS, NO SINGLE PATH", body: REDUNDANT_BODY };
  if (online === 1) {
    const restore = offline.length === 0 ? "" : ` Restore the ${offline.join(" and the ")} soon.`;
    return { variant: "one_left", title: "ONE ROUTER LEFT", body: `Battery sensors are relying on a single path.${restore}` };
  }
  // [INFERRED] SPEC defines only the two variants above; this covers both routers (or the coordinator) down.
  const restore = offline.length === 0 ? "" : ` Restore the ${offline.join(" or the ")}.`;
  return { variant: "none", title: "NO ROUTERS ONLINE", body: `Battery sensors can't reach the coordinator.${restore}` };
}

export interface InterlockView {
  tone: StateTone;
  status: "Armed" | "Holding" | "Bypassed";
  body: string;
}

/** S2.E23 (R11, H15, Q7). `watts` = live projector draw (null = no reading). */
export function interlockView(interlock: Interlock, watts: number | null): InterlockView {
  switch (interlock.status) {
    case "armed":
      return { tone: "confirmed", status: "Armed", body: interlock.rule_text };
    case "holding":
      return { tone: "warning", status: "Holding", body: `Waiting for projector to cool · ${formatWatts(watts)}` };
    case "bypassed":
      // [INFERRED] SPEC names the state only (Q7).
      return { tone: "warning", status: "Bypassed", body: "Projector mains can be switched off at any draw." };
  }
}
