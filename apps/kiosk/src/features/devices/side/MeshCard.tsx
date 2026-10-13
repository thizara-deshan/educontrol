import { Card } from "@/components/Card";
import { KeyValueRow } from "@/components/KeyValueRow";
import { VALUE_TONE_CLASS } from "@/components/state-styles";
import { useRoomState } from "@/data/hooks";
import { useServerNow } from "@/lib/server-time";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/ui/skeleton";
import { meshView } from "./side.view";

const LABELS = ["Routers", "End devices", "Joining"] as const;

/** S2.E21. "Open · 4:12 left" counts down every second on server time (shared ticker). */
export function MeshCard() {
  const now = useServerNow();
  const data = useRoomState((s) => ({ mesh: s.zigbee.mesh, status: s.zigbee.coordinator.status, serverTime: s.server_time }));
  const view = data === undefined ? null : meshView(data.mesh, data.status, now ?? new Date(data.serverTime));
  return (
    <Card className="flex flex-col gap-2">
      <h3 className="text-section font-bold uppercase text-text-2">Mesh</h3>
      {view === null ? (
        <Skeleton className="h-7 w-32" />
      ) : (
        <p className="flex items-baseline gap-2">
          <span className={cn("font-mono text-value font-semibold", VALUE_TONE_CLASS[view.greyed ? "faint" : "default"])}>{view.paired}</span>
          <span className="text-caption text-text-2">devices paired</span>
        </p>
      )}
      <div className="flex flex-col">
        {view === null
          ? LABELS.map((label) => <KeyValueRow key={label} label={label} value={null} loading />)
          : view.rows.map((row) => <KeyValueRow key={row.label} label={row.label} value={row.value} tone={row.tone} />)}
      </div>
    </Card>
  );
}
