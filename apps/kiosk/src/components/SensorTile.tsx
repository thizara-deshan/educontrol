import { Skeleton } from "@/ui/skeleton";
import { cn } from "@/lib/utils";
import { STALE_TEXT_CLASS, VALUE_TONE_CLASS, type ValueTone } from "./state-styles";

export interface SensorTileProps {
  /** "TEMPERATURE" (rendered uppercase). */
  label: string;
  /** Formatted value ("26.4°", "61%", "Detected"); `null` = no reading ever (H11). */
  value: string | null;
  /** Model caption, e.g. "SNZB-02P". */
  caption: string;
  tone?: ValueTone;
  /** H10: e.g. "14 min ago" (or "offline", H8). */
  staleAgo?: string | null;
  loading?: boolean;
  /** `false` for word values ("Detected", "Closed"): sans 18px so four tiles fit at 1280. */
  numeric?: boolean;
}

/** S1.E42–E45. */
export function SensorTile({
  label, value, caption, tone = "default", staleAgo = null, loading = false, numeric = true,
}: SensorTileProps) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <p className="text-sensor-label font-bold uppercase text-text-2">{label}</p>
      {loading ? (
        <Skeleton className="h-7 w-16" />
      ) : value === null ? (
        <p className="flex flex-col">
          <span className="font-mono text-value font-semibold text-text-3">—</span>
          <span className="text-caption text-text-3">No reading yet</span>
        </p>
      ) : (
        <p
          className={cn(
            "font-semibold",
            numeric ? "font-mono text-value" : "font-sans text-value-word",
            staleAgo !== null ? STALE_TEXT_CLASS : VALUE_TONE_CLASS[tone],
          )}
        >
          {value}
        </p>
      )}
      <p className="font-mono text-caption text-text-3">
        {caption}
        {staleAgo !== null && !loading && value !== null && <span className="font-sans"> · {staleAgo}</span>}
      </p>
    </div>
  );
}
