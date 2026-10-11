import { Skeleton } from "@/ui/skeleton";
import { cn } from "@/lib/utils";
import { StateDot } from "./StateDot";
import { STALE_TEXT_CLASS, TEXT_CLASS, type StateTone } from "./state-styles";

export interface ObservedLineProps {
  tone: StateTone;
  /** e.g. "On · confirmed by draw", "On · assumed", "Switch offline · last known state". */
  text: string;
  /** H10: e.g. "14 min ago" → rendered as "… · 14 min ago" with a 40% dot. */
  staleAgo?: string | null;
  /** H1: no snapshot yet. */
  loading?: boolean;
  /** Show the dot (card headers put the dot beside the title instead). */
  showDot?: boolean;
  className?: string;
}

/** A state line: optional dot + caption text coloured by tone (SPEC §3.2 card subtitle, §3.4). */
export function ObservedLine({ tone, text, staleAgo = null, loading = false, showDot = true, className }: ObservedLineProps) {
  if (loading) return <Skeleton className={cn("h-4 w-32", className)} />;
  const stale = staleAgo !== null;
  return (
    <p className={cn("flex items-center gap-2 text-caption", stale ? STALE_TEXT_CLASS : TEXT_CLASS[tone], className)}>
      {showDot && <StateDot tone={tone} stale={stale} />}
      <span>
        {text}
        {stale && ` · ${staleAgo}`}
      </span>
    </p>
  );
}
