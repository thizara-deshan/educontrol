import { Card } from "@/components/Card";
import { KeyValueRow } from "@/components/KeyValueRow";
import { SectionLabel } from "@/components/SectionLabel";
import { StateDot } from "@/components/StateDot";
import { VALUE_TONE_CLASS } from "@/components/state-styles";
import { useRoomState } from "@/data/hooks";
import { useServerNow } from "@/lib/server-time";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/ui/skeleton";
import { blasterView } from "./remote.view";

/** S3.E10. Online: green dot, `LQI 196`. Offline (H25): red dot + "Offline · last seen …", red card border. */
export function BlasterCard() {
  const blaster = useRoomState((state) => state.ir_blaster);
  const now = useServerNow();
  const view = blaster === undefined || now === null ? null : blasterView(blaster, now);
  return (
    <Card variant={view !== null && !view.online ? "danger" : "solid"} className="flex flex-col gap-2">
      <SectionLabel>Blaster</SectionLabel>
      {view === null ? (
        <Skeleton className="h-20 w-full" />
      ) : (
        <>
          <div className="flex min-h-8 items-center gap-2">
            <StateDot tone={view.online ? "confirmed" : "offline"} />
            <span className="flex-1 text-card-title text-text-1">{view.id}</span>
            <span className={cn("font-mono text-caption", VALUE_TONE_CLASS[view.link.tone])}>{view.link.text}</span>
          </div>
          <KeyValueRow label="Topic" value={view.topic} />
          <KeyValueRow label="Coverage" value={view.coverage} />
          <p className="text-caption text-text-2">Mains powered, so it also routes for the battery sensors.</p>
        </>
      )}
    </Card>
  );
}
