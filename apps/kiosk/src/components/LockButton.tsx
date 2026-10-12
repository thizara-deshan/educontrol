import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePressed } from "@/lib/use-pressed";
import { PENDING_CONTROL_CLASS } from "./state-styles";

/**
 * S1.E8 / S3.E3 "Lock": padlock + label; icon-only (48×48) below `lg` (SPEC §2.2). Looks like
 * the header's Devices/Settings buttons.
 */
export function LockButton({ onPress, pending = false }: { onPress: () => void; pending?: boolean }) {
  const pressed = usePressed();
  return (
    <button
      type="button"
      aria-label="Lock"
      aria-busy={pending}
      {...pressed}
      onClick={() => {
        if (!pending) onPress();
      }}
      className={cn(
        "flex h-12 min-w-12 shrink-0 items-center justify-center gap-2 rounded-btn border border-border-strong bg-control text-button font-semibold text-text-1 active:brightness-125 data-[pressed=true]:brightness-125 lg:px-4",
        pending && PENDING_CONTROL_CLASS,
      )}
    >
      <Lock aria-hidden="true" className="size-5 shrink-0" />
      <span className="hidden lg:inline">Lock</span>
    </button>
  );
}
