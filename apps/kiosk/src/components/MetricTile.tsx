import { Skeleton } from "@/ui/skeleton";
import { cn } from "@/lib/utils";
import { STALE_TEXT_CLASS, VALUE_TONE_CLASS, type ValueTone } from "./state-styles";

/** S2 power metrics (POWER 287 W, VOLTAGE 231 V …). `value` null = H11; `staleAgo` = H10 ("14 min ago"). */
export function MetricTile({ label, value, tone = "default", staleAgo = null, loading = false }: {
  label: string;
  value: string | null;
  tone?: ValueTone;
  staleAgo?: string | null;
  loading?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <p className="text-sensor-label font-bold uppercase text-text-2">{label}</p>
      {loading ? (
        <Skeleton className="h-7 w-20" />
      ) : value === null ? (
        <p className="flex flex-col">
          <span className="font-mono text-value font-semibold text-text-3">—</span>
          <span className="text-caption text-text-3">No reading yet</span>
        </p>
      ) : (
        <p className="flex flex-col">
          <span className={cn("font-mono text-value font-semibold", staleAgo !== null ? STALE_TEXT_CLASS : VALUE_TONE_CLASS[tone])}>
            {value}
          </span>
          {staleAgo !== null && <span className="text-caption text-text-3">{staleAgo}</span>}
        </p>
      )}
    </div>
  );
}
