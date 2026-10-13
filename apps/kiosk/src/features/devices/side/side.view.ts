import type { Coordinator, Mesh } from "@eduscope/contracts";
import type { ValueTone } from "@/components/state-styles";
import { formatCountdown } from "@/lib/format";

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
