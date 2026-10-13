import type { AudioChannel, AudioState } from "@eduscope/contracts";
import type { HwFacts, RoomModel } from "./model.ts";
import { reported } from "./observed.ts";

// R9: mute all saves each channel's level; unmute restores them; levels are read back.

/** `muted_all` is true only when the mixer reports both channels muted. */
export function mutedAll(muted: HwFacts["audio_muted"]): boolean | null {
  if (muted.mic === null || muted.pc === null) return null;
  return muted.mic && muted.pc;
}

/** One `audio.state` report. Leaving "all muted" clears the saved levels (unmute restores them). */
export function applyAudioReport(model: RoomModel, data: { channel: AudioChannel; level: number; muted: boolean }, at: string): RoomModel {
  const { audio } = model.state;
  const audioMuted = { ...model.facts.audio_muted, [data.channel]: data.muted };
  const all = mutedAll(audioMuted);
  const nextAudio: AudioState = {
    channels: { ...audio.channels, [data.channel]: reported(audio.channels[data.channel], data.level, at) },
    muted_all: all === null ? audio.muted_all : reported(audio.muted_all, all, at),
    saved_levels: audio.muted_all.value === true && all === false ? { mic: null, pc: null } : audio.saved_levels,
  };
  return { ...model, state: { ...model.state, audio: nextAudio }, facts: { ...model.facts, audio_muted: audioMuted } };
}

/** Before "Mute all" is sent: remember the current levels (R9). Already muted ⇒ keep the saved ones. */
export function saveLevels(audio: AudioState): AudioState {
  if (audio.muted_all.value === true) return audio;
  return { ...audio, saved_levels: { mic: audio.channels.mic.value, pc: audio.channels.pc.value } };
}
