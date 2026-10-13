import { LockBadge } from "@/components/LockBadge";
import {
  ACTIVE_CONTROL_CLASS, DISABLED_CONTROL_CLASS, INACTIVE_CONTROL_CLASS, PENDING_CONTROL_CLASS, TEXT_CLASS,
} from "@/components/state-styles";
import { usePressed } from "@/lib/use-pressed";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/ui/skeleton";
import type { SourceTileView } from "./source-tiles.view";

export interface SourceTileProps {
  label: string;
  /** `null` while loading (H1). */
  view: SourceTileView | null;
  pending: boolean;
  disabled: boolean;
  locked: boolean;
  onPress: () => void;
}

/** S1.E11 / S1.E12: title over caption, left aligned; the whole tile is the target. */
export function SourceTile({ label, view, pending, disabled, locked, onPress }: SourceTileProps) {
  const pressed = usePressed();
  return (
    <button
      type="button"
      {...pressed}
      disabled={disabled}
      aria-pressed={view?.selected === true}
      aria-busy={pending}
      onClick={() => {
        if (!pending) onPress();
      }}
      className={cn(
        "flex min-h-18 min-w-0 flex-col items-start justify-center gap-0.5 rounded-btn border-2 px-4 py-3 text-left",
        "transition-[filter] active:brightness-125 data-[pressed=true]:brightness-125",
        view?.active ? ACTIVE_CONTROL_CLASS[view.active] : INACTIVE_CONTROL_CLASS,
        pending && PENDING_CONTROL_CLASS,
        disabled && DISABLED_CONTROL_CLASS,
      )}
    >
      <span className="flex w-full items-center justify-between gap-2">
        <span className="truncate text-card-title font-semibold text-text-1">{label}</span>
        {locked && <LockBadge />}
      </span>
      {view === null ? (
        <Skeleton className="h-4 w-24" />
      ) : (
        <span className={cn("text-caption", view.captionTone === null ? "text-text-2" : TEXT_CLASS[view.captionTone])}>
          {view.caption}
        </span>
      )}
    </button>
  );
}
