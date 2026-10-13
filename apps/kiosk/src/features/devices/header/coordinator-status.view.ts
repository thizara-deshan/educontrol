import type { Coordinator } from "@eduscope/contracts";
import type { StateTone } from "@/components/state-styles";

// S2.E3 (H9). `undefined` = no snapshot yet (H1).

export interface CoordinatorStatusView {
  tone: StateTone;
  text: string;
}

export function coordinatorStatusView(status: Coordinator["status"] | undefined): CoordinatorStatusView {
  switch (status) {
    case undefined:
      return { tone: "unknown", text: "Connecting…" };
    case "online":
      return { tone: "confirmed", text: "Coordinator online" };
    case "starting":
      return { tone: "warning", text: "Coordinator starting…" };
    case "offline":
      return { tone: "offline", text: "Coordinator offline" };
  }
}
