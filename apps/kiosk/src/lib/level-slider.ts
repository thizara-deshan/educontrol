// LevelSlider logic (SPEC §2.4, ARCHITECTURE §4.6): throttle while dragging, final value on
// release, server pushes ignored while the finger is down. Pure so it can be unit-tested.

export const LEVEL_THROTTLE_MS = 200;
/** After release the thumb holds the released value until the server pushes, at most this long. */
export const SETTLE_TIMEOUT_MS = 1500;

export const clampLevel = (level: number): number => Math.min(100, Math.max(0, Math.round(level)));

/** Pointer x → level 0–100 on a track starting at `left` with `width` px. */
export function levelFromPointer(clientX: number, left: number, width: number): number {
  if (width <= 0) return 0;
  return clampLevel(((clientX - left) / width) * 100);
}

export interface LevelThrottle {
  /** Finger moved: sends `final:false` at most every LEVEL_THROTTLE_MS (leading + trailing). */
  move(level: number): void;
  /** Finger lifted: cancels the trailing send and sends `final:true` once. */
  release(level: number): void;
  /** Unmount: drop any trailing send. */
  cancel(): void;
}

export function createLevelThrottle(
  send: (level: number, final: boolean) => void,
  now: () => number = Date.now,
  intervalMs: number = LEVEL_THROTTLE_MS,
): LevelThrottle {
  let lastSentAt: number | null = null;
  let lastSentLevel: number | null = null;
  let latest: number | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const clearTimer = (): void => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };
  const sendNow = (level: number): void => {
    lastSentAt = now();
    lastSentLevel = level;
    send(level, false);
  };

  return {
    move(level) {
      latest = level;
      const elapsed = lastSentAt === null ? Infinity : now() - lastSentAt;
      if (elapsed >= intervalMs) {
        clearTimer();
        sendNow(level);
        return;
      }
      if (timer !== null) return;
      timer = setTimeout(() => {
        timer = null;
        if (latest !== null && latest !== lastSentLevel) sendNow(latest);
      }, intervalMs - elapsed);
    },
    release(level) {
      clearTimer();
      lastSentAt = null;
      lastSentLevel = null;
      latest = null;
      send(level, true);
    },
    cancel() {
      clearTimer();
    },
  };
}

/** What the thumb shows: the finger while dragging, the released value while settling, else the server. */
export type SliderState =
  | { mode: "idle" }
  | { mode: "dragging"; level: number }
  | { mode: "settling"; level: number; serverAtRelease: number | null };

export type SliderAction =
  | { type: "down"; level: number }
  | { type: "move"; level: number }
  | { type: "up"; level: number; server: number | null }
  | { type: "server"; value: number | null }
  | { type: "settle-timeout" };

export const SLIDER_IDLE: SliderState = { mode: "idle" };

export function sliderReducer(state: SliderState, action: SliderAction): SliderState {
  switch (action.type) {
    case "down":
      return { mode: "dragging", level: action.level };
    case "move":
      return state.mode === "dragging" ? { mode: "dragging", level: action.level } : state;
    case "up":
      return state.mode === "dragging"
        ? { mode: "settling", level: action.level, serverAtRelease: action.server }
        : state;
    case "server":
      // While dragging, another client's change is ignored (SPEC §2.4); it applies on release.
      if (state.mode === "settling" && action.value !== state.serverAtRelease) return SLIDER_IDLE;
      return state;
    case "settle-timeout":
      return state.mode === "settling" ? SLIDER_IDLE : state;
  }
}

export function sliderDisplayLevel(state: SliderState, server: number | null): number | null {
  return state.mode === "idle" ? server : state.level;
}
