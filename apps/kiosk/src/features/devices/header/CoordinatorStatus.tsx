import { StateDot } from "@/components/StateDot";
import { HEADER_LINE_CLASS } from "@/components/state-styles";
import { useRoomState } from "@/data/hooks";
import { cn } from "@/lib/utils";
import { coordinatorStatusView } from "./coordinator-status.view";

/** S2.E3 (not a control). ≥600: dot + text. Phone: the dot only (SPEC §2.2); the text stays for screen readers. */
export function CoordinatorStatus() {
  const view = coordinatorStatusView(useRoomState((state) => state.zigbee.coordinator.status));
  return (
    <p className={cn("flex min-h-12 shrink-0 items-center gap-2 px-2 text-caption", HEADER_LINE_CLASS[view.tone])}>
      <StateDot tone={view.tone} />
      <span className="sr-only whitespace-nowrap sm:not-sr-only">{view.text}</span>
    </p>
  );
}
