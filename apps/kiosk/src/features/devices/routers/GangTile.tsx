import type { Observed } from "@eduscope/contracts";
import { StateDot } from "@/components/StateDot";
import { ACTIVE_CONTROL_CLASS, GREYED_CLASS, INACTIVE_CONTROL_CLASS, TEXT_CLASS } from "@/components/state-styles";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/ui/skeleton";
import { gangTileView } from "./routers.view";

/**
 * S2.E7/E8/E11: read-only On/Off tile (Q11: no control on S2, so no pressed state and no 48px rule).
 * On = green fill + border, green dot, "On". Off = neutral, grey dot, "Off" text-3. `greyed` = the
 * router is offline: last known state, greyed (H8). `state` undefined = no snapshot (H1).
 */
export function GangTile({ label, state, greyed }: { label: string; state: Observed<boolean> | undefined; greyed: boolean }) {
  if (state === undefined) return <Skeleton className="h-12 rounded-btn" />;
  const view = gangTileView(state);
  return (
    <div
      className={cn(
        "flex min-h-12 items-center gap-3 rounded-btn border-2 px-4 py-2",
        view.fill === null ? INACTIVE_CONTROL_CLASS : ACTIVE_CONTROL_CLASS[view.fill],
        greyed && GREYED_CLASS,
      )}
    >
      <StateDot tone={view.tone} />
      <span className="min-w-0 flex-1 text-card-title font-semibold text-text-1">{label}</span>
      <span className={cn("text-caption font-semibold", TEXT_CLASS[view.tone])}>{view.text}</span>
    </div>
  );
}
