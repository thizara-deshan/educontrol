import { Card } from "@/components/Card";
import { InlineError } from "@/components/InlineError";
import { ToggleRow } from "@/components/ToggleRow";
import { CARD_VARIANT_FOR_TONE, STALE_TEXT_CLASS } from "@/components/state-styles";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/ui/skeleton";
import { gateDisablesControl } from "@/data/gate";
import { useCommand, useRoomState, useViewOnly } from "@/data/hooks";
import { useServerNow } from "@/lib/server-time";
import { CardHeader } from "../CardHeader";
import { nextPlugOn, plugView, type PlugMetric } from "./plug.view";

/** One meter value: number in mono, unit small beside it, so four fit one row of a 1280-wide column. */
function PlugMetricTile({ metric, stale, loading }: { metric: PlugMetric; stale: boolean; loading: boolean }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <p className="text-sensor-label font-bold uppercase text-text-2">{metric.label}</p>
      {loading ? (
        <Skeleton className="h-7 w-14" />
      ) : (
        <p className="flex items-baseline gap-1 whitespace-nowrap">
          <span className={cn("font-mono text-value-word font-semibold", metric.value === null || stale ? STALE_TEXT_CLASS : "text-text-1")}>
            {metric.value ?? "—"}
          </span>
          <span className="text-caption text-text-3">{metric.unit}</span>
        </p>
      )}
    </div>
  );
}

/** D-34: the smart plug — on/off row (≥56px, like the lights) and its meter. */
export function PlugCard() {
  const plug = useRoomState((state) => state.plug);
  const locked = useViewOnly();
  const now = useServerNow();
  const command = useCommand("plug");
  const view = plug === undefined ? null : plugView(plug, now);

  return (
    <Card variant={view === null ? "solid" : CARD_VARIANT_FOR_TONE[view.tone]} className="@container flex flex-col gap-3">
      <CardHeader
        title="Smart plug"
        tone={view?.tone ?? null}
        line={view?.line ?? null}
        locked={locked}
        aside={<span className="mt-1 font-mono text-caption font-semibold text-text-3">S60</span>}
      />
      <ToggleRow
        label="Power"
        on={plug?.on.value ?? null}
        pending={command.pending}
        disabled={view === null || !view.online || gateDisablesControl(command.gate)}
        onToggle={() => command.send({ kind: "plug.set", on: nextPlugOn(plug?.on.value ?? null) })}
      />
      <div className="grid grid-cols-2 gap-3 @min-[20rem]:grid-cols-4">
        {(view?.metrics ?? []).map((metric) => (
          <PlugMetricTile key={metric.label} metric={metric} stale={view?.staleAgo != null} loading={view === null} />
        ))}
      </div>
      {view?.staleAgo != null && <p className="text-caption text-text-3">Last reading {view.staleAgo}</p>}
      <InlineError message={command.error} />
    </Card>
  );
}
