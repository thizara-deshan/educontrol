import type { Observed } from "@eduscope/contracts";
import type { ActiveVariant, StateTone } from "@/components/state-styles";

// S1.E21–E23: level cards and the mute-all bar (R9, H18).

export interface LevelView {
  /** `62`, `Muted` (H18) or `—`. */
  valueText: string;
  /** Thumb position: the saved level while muted (H18), else the server level. */
  sliderValue: number | null;
  muted: boolean;
  /** H8 line, or null. */
  offlineLine: string | null;
}

export function levelView(
  level: Observed<number>, mutedAll: Observed<boolean>, saved: number | null, online: boolean | null | undefined, deviceName: string,
): LevelView {
  const muted = mutedAll.value === true;
  return {
    valueText: muted ? "Muted" : level.value === null ? "—" : String(level.value),
    sliderValue: muted ? (saved ?? level.value) : level.value,
    muted,
    offlineLine: online === false ? `${deviceName} offline · last known state` : null,
  };
}

export interface MuteBarView {
  label: "Mute all audio" | "Unmute all audio";
  dotTone: StateTone;
  active: ActiveVariant | null;
  /** The `muted` value a tap sends. */
  nextMuted: boolean;
}

export function muteBarView(mutedAll: Observed<boolean>): MuteBarView {
  return mutedAll.value === true
    ? { label: "Unmute all audio", dotTone: "warning", active: "assumed", nextMuted: false }
    : { label: "Mute all audio", dotTone: "off", active: null, nextMuted: true };
}
