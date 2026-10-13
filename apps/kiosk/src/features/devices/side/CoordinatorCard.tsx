import { Card } from "@/components/Card";
import { KeyValueRow } from "@/components/KeyValueRow";
import { VALUE_TONE_CLASS } from "@/components/state-styles";
import { useRoomState } from "@/data/hooks";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/ui/skeleton";
import { coordinatorView } from "./side.view";

const LABELS = ["Chipset", "Firmware", "Channel", "Transmit", "Port", "Antenna"] as const;

/** S2.E20. Offline → every value text-3 (H9). */
export function CoordinatorCard() {
  const coordinator = useRoomState((s) => s.zigbee.coordinator);
  const view = coordinator === undefined ? null : coordinatorView(coordinator);
  return (
    <Card className="flex flex-col gap-2">
      <h3 className="text-section font-bold uppercase text-text-2">Coordinator</h3>
      {view === null ? (
        <Skeleton className="h-6 w-24" />
      ) : (
        <p className={cn("font-mono text-card-title font-semibold", VALUE_TONE_CLASS[view.greyed ? "faint" : "default"])}>{view.model}</p>
      )}
      <div className="flex flex-col">
        {view === null
          ? LABELS.map((label) => <KeyValueRow key={label} label={label} value={null} loading />)
          : view.rows.map((row) => <KeyValueRow key={row.label} label={row.label} value={row.value} tone={row.tone} />)}
      </div>
    </Card>
  );
}
