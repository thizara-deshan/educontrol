import { CALLOUT_BOX_CLASS, CALLOUT_TITLE_CLASS } from "@/components/state-styles";
import { useRoomState } from "@/data/hooks";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/ui/skeleton";
import { calloutView } from "./side.view";

/** S2.E22 (R7): green "TWO ROUTERS, NO SINGLE PATH"; amber "ONE ROUTER LEFT"; red "NO ROUTERS ONLINE" [INFERRED]. */
export function RedundancyCallout() {
  const data = useRoomState((s) => ({ nodes: s.zigbee.nodes, devices: s.devices }));
  if (data === undefined) return <Skeleton className="h-28 rounded-card" />;
  const view = calloutView(data.nodes, data.devices);
  return (
    <section className={cn("flex flex-col gap-2 rounded-card border p-4", CALLOUT_BOX_CLASS[view.variant])}>
      <h3 className={cn("text-section font-bold uppercase", CALLOUT_TITLE_CLASS[view.variant])}>{view.title}</h3>
      <p className="text-caption text-text-1">{view.body}</p>
    </section>
  );
}
