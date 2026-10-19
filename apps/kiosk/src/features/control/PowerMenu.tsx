import { useMutation } from "@tanstack/react-query";
import { Power, RotateCcw } from "lucide-react";
import { useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { DISABLED_CONTROL_CLASS } from "@/components/state-styles";
import { useApiClient } from "@/data/api-context";
import { useConnectionStatus, useRequireAccess } from "@/data/hooks";
import { usePressed } from "@/lib/use-pressed";
import { cn } from "@/lib/utils";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/ui/dropdown-menu";

type PowerAction = "reboot" | "shutdown";

const CONFIRM: Record<PowerAction, { title: string; description: string; confirmLabel: string; error: string }> = {
  reboot: {
    title: "Restart the controller?",
    description: "Every screen in the room disconnects for about a minute while the controller restarts, then reconnects by itself.",
    confirmLabel: "Restart",
    error: "Couldn't restart · try again",
  },
  shutdown: {
    title: "Shut down the controller?",
    description: "Every screen in the room disconnects. The controller stays off until its power is switched off and on again.",
    confirmLabel: "Shut down",
    error: "Couldn't shut down · try again",
  },
};

/**
 * D-32/D-35 power menu: power icon (label from `lg`, icon-only 48×48 below) → Restart · Shut down.
 * Either item asks for the room PIN first on a `view` session, then confirms before it runs.
 */
export function PowerMenu() {
  const pressed = usePressed();
  const [confirming, setConfirming] = useState<PowerAction | null>(null);
  /** The last choice: keeps the dialog's text while it fades out after Cancel. */
  const [chosen, setChosen] = useState<PowerAction>("shutdown");
  const api = useApiClient();
  const status = useConnectionStatus();
  const writable = status === "live" || status === "back_online";
  const { ensure } = useRequireAccess("control");
  const action = useMutation({ mutationFn: (kind: PowerAction) => (kind === "reboot" ? api.system.reboot() : api.system.shutdown()) });
  const choose = (kind: PowerAction) => {
    void ensure().then((granted) => {
      if (!granted) return;
      setChosen(kind);
      setConfirming(kind);
    });
  };
  const copy = CONFIRM[chosen];
  return (
    <>
      {/* Not modal: a modal menu closing while the confirm dialog opens can leave the page inert. */}
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild disabled={!writable}>
          <button
            type="button"
            aria-label="Power"
            {...pressed}
            className={cn(
              "flex h-12 min-w-12 shrink-0 items-center justify-center gap-2 rounded-btn border border-danger bg-control text-button font-semibold text-danger active:brightness-125 data-[pressed=true]:brightness-125 lg:px-4",
              !writable && DISABLED_CONTROL_CLASS,
            )}
          >
            <Power aria-hidden="true" className="size-5 shrink-0" />
            <span className="hidden whitespace-nowrap lg:inline">Power</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => choose("reboot")}>
            <RotateCcw aria-hidden="true" />
            Restart
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => choose("shutdown")} className="text-danger">
            <Power aria-hidden="true" />
            Shut down
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDialog
        open={confirming !== null}
        onOpenChange={(open) => {
          if (open) return;
          setConfirming(null);
          action.reset();
        }}
        title={copy.title}
        description={copy.description}
        confirmLabel={copy.confirmLabel}
        pending={action.isPending}
        error={action.isError ? copy.error : null}
        onConfirm={() => {
          if (confirming !== null) action.mutate(confirming, { onSuccess: () => setConfirming(null) });
        }}
      />
    </>
  );
}
