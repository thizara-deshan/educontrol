import { cn } from "@/lib/utils";
import type { SleepLevel } from "./idle-timer";

/**
 * H23: dim = 80% black (screen at ~20%), blank = black. Sits above everything, PIN overlay and
 * toasts included (sonner uses z-index 999999999). The wake guard swallows the waking tap.
 */
export function SleepOverlay({ level }: { level: SleepLevel }) {
  if (level === "awake") return null;
  return (
    <div
      aria-hidden="true"
      data-sleep={level}
      className={cn("fixed inset-0 z-[1000000000]", level === "dim" ? "bg-sleep/80" : "bg-sleep")}
    />
  );
}
