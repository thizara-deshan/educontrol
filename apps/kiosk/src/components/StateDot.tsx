import { cn } from "@/lib/utils";
import { DOT_CLASS, STALE_DOT_CLASS, type StateTone } from "./state-styles";

/** SPEC §3.4 dot: solid, hollow ring, or 40% when stale. 10px, decorative. */
export function StateDot({ tone, stale = false, className }: { tone: StateTone; stale?: boolean; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("inline-block size-2.5 shrink-0 rounded-full", DOT_CLASS[tone], stale && STALE_DOT_CLASS, className)}
    />
  );
}
