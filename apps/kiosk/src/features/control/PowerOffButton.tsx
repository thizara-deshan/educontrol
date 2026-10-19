import { useMutation } from "@tanstack/react-query";
import { Power } from "lucide-react";
import { useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { DISABLED_CONTROL_CLASS } from "@/components/state-styles";
import { useApiClient } from "@/data/api-context";
import { useConnectionStatus, useRequireAccess } from "@/data/hooks";
import { usePressed } from "@/lib/use-pressed";
import { cn } from "@/lib/utils";

/**
 * D-32 "Power off": power icon + label; icon-only (48×48) below `lg`, like the header's other buttons.
 * `view` → S4 (room PIN) first; then confirm → the Pi shuts down and every screen shows the banner.
 */
export function PowerOffButton() {
  const pressed = usePressed();
  const [confirming, setConfirming] = useState(false);
  const api = useApiClient();
  const status = useConnectionStatus();
  const writable = status === "live" || status === "back_online";
  const { ensure } = useRequireAccess("control");
  const shutdown = useMutation({ mutationFn: () => api.system.shutdown() });
  return (
    <>
      <button
        type="button"
        aria-label="Power off"
        disabled={!writable}
        {...pressed}
        onClick={() => {
          void ensure().then((granted) => {
            if (granted) setConfirming(true);
          });
        }}
        className={cn(
          "flex h-12 min-w-12 shrink-0 items-center justify-center gap-2 rounded-btn border border-danger bg-control text-button font-semibold text-danger active:brightness-125 data-[pressed=true]:brightness-125 lg:px-4",
          !writable && DISABLED_CONTROL_CLASS,
        )}
      >
        <Power aria-hidden="true" className="size-5 shrink-0" />
        <span className="hidden whitespace-nowrap lg:inline">Power off</span>
      </button>
      <ConfirmDialog
        open={confirming}
        onOpenChange={(open) => {
          setConfirming(open);
          if (!open) shutdown.reset();
        }}
        title="Power off the controller?"
        description="Every screen in the room disconnects. The controller stays off until its power is switched off and on again."
        confirmLabel="Power off"
        pending={shutdown.isPending}
        error={shutdown.isError ? "Couldn't power off · try again" : null}
        onConfirm={() => shutdown.mutate(undefined, { onSuccess: () => setConfirming(false) })}
      />
    </>
  );
}
