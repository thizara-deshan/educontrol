import { createStore, type Store } from "@/lib/store";

// Kiosk idle behaviour (SPEC §2.3, §2.6, H23; ARCHITECTURE §4.7): 2 min → back to S1 and drop
// technician; 5 min → dim; 15 min → black. Timings are injectable (`?idle-scale=`, tests).

export type SleepLevel = "awake" | "dim" | "blank";

export interface IdleTimings {
  returnHomeMs: number;
  dimMs: number;
  blankMs: number;
}

export const KIOSK_IDLE_TIMINGS: IdleTimings = { returnHomeMs: 2 * 60_000, dimMs: 5 * 60_000, blankMs: 15 * 60_000 };

export function scaleTimings(timings: IdleTimings, scale: number): IdleTimings {
  return {
    returnHomeMs: Math.round(timings.returnHomeMs * scale),
    dimMs: Math.round(timings.dimMs * scale),
    blankMs: Math.round(timings.blankMs * scale),
  };
}

export interface IdleTimer {
  level: Store<SleepLevel>;
  /** Starts counting from now. */
  start(): void;
  /** Any touch/key while awake, a wake tap, or occupancy: awake again and restart all timers. */
  activity(): void;
  stop(): void;
}

export function createIdleTimer(options: { timings: IdleTimings; onReturnHome: () => void }): IdleTimer {
  const level = createStore<SleepLevel>("awake");
  let timers: ReturnType<typeof setTimeout>[] = [];

  const clear = (): void => {
    for (const timer of timers) clearTimeout(timer);
    timers = [];
  };
  const schedule = (): void => {
    clear();
    const { returnHomeMs, dimMs, blankMs } = options.timings;
    timers = [
      setTimeout(options.onReturnHome, returnHomeMs),
      setTimeout(() => level.set("dim"), dimMs),
      setTimeout(() => level.set("blank"), blankMs),
    ];
  };

  return {
    level,
    start: schedule,
    activity() {
      level.set("awake");
      schedule();
    },
    stop() {
      clear();
      level.set("awake");
    },
  };
}
