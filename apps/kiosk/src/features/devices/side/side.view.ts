import type { Coordinator } from "@eduscope/contracts";
import type { ValueTone } from "@/components/state-styles";

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
