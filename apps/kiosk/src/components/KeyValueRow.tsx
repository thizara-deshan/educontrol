import { Skeleton } from "@/ui/skeleton";
import { cn } from "@/lib/utils";
import { VALUE_TONE_CLASS, type ValueTone } from "./state-styles";

/** S2 side cards: "Chipset … CC2652P1". Label text-2 left, value right (mono by default). */
export function KeyValueRow({ label, value, mono = true, tone = "default", loading = false }: {
  label: string;
  value: string | null;
  mono?: boolean;
  tone?: ValueTone;
  loading?: boolean;
}) {
  return (
    <div className="flex min-h-8 items-center justify-between gap-4">
      <span className="text-caption text-text-2">{label}</span>
      {loading ? (
        <Skeleton className="h-4 w-16" />
      ) : (
        <span className={cn("text-right text-caption", mono && "font-mono", value === null ? "text-text-3" : VALUE_TONE_CLASS[tone])}>
          {value ?? "—"}
        </span>
      )}
    </div>
  );
}
