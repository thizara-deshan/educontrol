import { Card } from "@/components/Card";
import { ObservedLine } from "@/components/ObservedLine";
import { useRoomState } from "@/data/hooks";
import { interlockView } from "./side.view";

/** S2.E23 (R11, H15, Q7): Armed (green) + rule; Holding (amber) + "Waiting for projector to cool · 112 W"; Bypassed (amber). */
export function InterlockCard() {
  const data = useRoomState((s) => ({ interlock: s.interlock, watts: s.display.projector.power.value?.watts ?? null }));
  const view = data === undefined ? null : interlockView(data.interlock, data.watts);
  return (
    <Card className="flex flex-col gap-2">
      <h3 className="text-section font-bold uppercase text-text-2">Shutdown interlock</h3>
      <ObservedLine tone={view?.tone ?? "unknown"} text={view?.status ?? ""} loading={view === null} className="font-semibold" />
      {view !== null && <p className="text-caption text-text-2">{view.body}</p>}
    </Card>
  );
}
