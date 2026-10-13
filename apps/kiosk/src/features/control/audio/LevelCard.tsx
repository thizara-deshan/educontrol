import type { AudioChannel } from "@eduscope/contracts";
import { useEffect, useRef } from "react";
import { Card } from "@/components/Card";
import { InlineError } from "@/components/InlineError";
import { LevelSlider } from "@/components/LevelSlider";
import { LockBadge } from "@/components/LockBadge";
import { ObservedLine } from "@/components/ObservedLine";
import { gateDisablesControl } from "@/data/gate";
import { useCommand, useRoomState, useViewOnly } from "@/data/hooks";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/ui/skeleton";
import { levelView } from "./audio.view";

const DEVICE_ID = "audio";
const TITLES: Record<AudioChannel, string> = { mic: "Lecturer microphone", pc: "PC audio" };

/** S1.E21 / S1.E22: title + value, full-width slider (SPEC §2.4, H18). */
export function LevelCard({ channel }: { channel: AudioChannel }) {
  const view = useRoomState((state) => {
    const device = state.devices.find((d) => d.id === DEVICE_ID);
    const { audio } = state;
    return levelView(audio.channels[channel], audio.muted_all, audio.saved_levels[channel], device?.online.value, device?.name ?? "Audio mixer");
  });
  const locked = useViewOnly();
  const level = useCommand(`audio.${channel}`, DEVICE_ID);
  const muteAll = useCommand("audio.mute_all", DEVICE_ID);
  // H18 / Q8b: the first drag update while muted unmutes all first (once per mute).
  const unmuteSent = useRef(false);
  const muted = view?.muted === true;
  useEffect(() => {
    if (!muted) unmuteSent.current = false;
  }, [muted]);

  return (
    <Card className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <h3 className="flex-1 text-card-title font-semibold text-text-1">{TITLES[channel]}</h3>
        {locked && <LockBadge />}
        {view === undefined ? (
          <Skeleton className="h-7 w-10" />
        ) : (
          <span className={cn("font-mono text-value font-semibold", view.muted ? "text-text-2" : "text-text-1")}>{view.valueText}</span>
        )}
      </div>
      <LevelSlider
        label={TITLES[channel]}
        value={view?.sliderValue ?? null}
        muted={muted}
        pending={level.pending}
        disabled={view === undefined || gateDisablesControl(level.gate)}
        onPressLocked={level.gate.reason === "locked" ? level.unlock : undefined}
        onChange={(next, final) => {
          if (muted && !unmuteSent.current) {
            unmuteSent.current = true;
            muteAll.send({ kind: "audio.mute_all", muted: false });
          }
          level.send({ kind: "audio.level", channel, level: next, final }, { supersede: true });
        }}
      />
      {view?.offlineLine != null && <ObservedLine tone="offline" text={view.offlineLine} />}
      <InlineError message={level.error} />
    </Card>
  );
}
