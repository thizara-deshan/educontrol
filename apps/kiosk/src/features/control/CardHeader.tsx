import type { ReactNode } from "react";
import { LockBadge } from "@/components/LockBadge";
import { StateDot } from "@/components/StateDot";
import { HEADER_LINE_CLASS, type StateTone } from "@/components/state-styles";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/ui/skeleton";

export interface CardHeaderProps {
  title: string;
  /** `null` while loading (H1): skeleton instead of dot and line. */
  tone: StateTone | null;
  line: string | null;
  /** Right side: wattage, tag ("ZBM5", "IR REMOTE"). */
  aside?: ReactNode;
  /** H12 padlock. */
  locked: boolean;
  className?: string;
}

/** S1 card header: dot · title over state line · aside · padlock (SPEC §3.2 card title/subtitle). */
export function CardHeader({ title, tone, line, aside, locked, className }: CardHeaderProps) {
  return (
    <div className={cn("flex min-w-0 items-start gap-3", className)}>
      {tone === null ? <Skeleton className="mt-1.5 size-2.5 rounded-full" /> : <StateDot tone={tone} className="mt-1.5" />}
      <div className="flex min-w-0 flex-1 flex-col">
        <h3 className="text-card-title font-semibold text-text-1">{title}</h3>
        {tone === null || line === null ? (
          <Skeleton className="mt-0.5 h-4 w-32" />
        ) : (
          <p className={cn("text-caption", HEADER_LINE_CLASS[tone])}>{line}</p>
        )}
      </div>
      {aside}
      {locked && <LockBadge />}
    </div>
  );
}
