import { InlineError } from "@/components/InlineError";
import { LockBadge } from "@/components/LockBadge";
import { StateDot } from "@/components/StateDot";
import {
  ACTIVE_CONTROL_CLASS, DISABLED_CONTROL_CLASS, INACTIVE_CONTROL_CLASS, PENDING_CONTROL_CLASS,
} from "@/components/state-styles";
import { gateDisablesControl } from "@/data/gate";
import { useCommand, useRoomState, useViewOnly } from "@/data/hooks";
import { usePressed } from "@/lib/use-pressed";
import { cn } from "@/lib/utils";
import { muteBarView } from "./audio.view";

/** S1.E23: full column width, dot + label centred (R9, H18). */
export function MuteAllBar() {
  const view = useRoomState((state) => muteBarView(state.audio.muted_all));
  const locked = useViewOnly();
  const mute = useCommand("audio.mute_all", "audio");
  const pressed = usePressed();

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        {...pressed}
        disabled={view === undefined || gateDisablesControl(mute.gate)}
        aria-pressed={view?.nextMuted === false}
        aria-busy={mute.pending}
        onClick={() => {
          if (view !== undefined && !mute.pending) mute.send({ kind: "audio.mute_all", muted: view.nextMuted });
        }}
        className={cn(
          "relative flex h-14 w-full items-center justify-center gap-3 rounded-card border-2 px-4 text-button font-semibold",
          "transition-[filter] active:brightness-125 data-[pressed=true]:brightness-125",
          view?.active ? ACTIVE_CONTROL_CLASS[view.active] : INACTIVE_CONTROL_CLASS,
          mute.pending && PENDING_CONTROL_CLASS,
          (view === undefined || gateDisablesControl(mute.gate)) && DISABLED_CONTROL_CLASS,
        )}
      >
        <StateDot tone={view?.dotTone ?? "unknown"} />
        {view?.label ?? "Mute all audio"}
        {locked && (
          <span className="absolute right-4">
            <LockBadge />
          </span>
        )}
      </button>
      <InlineError message={mute.error} />
    </div>
  );
}
