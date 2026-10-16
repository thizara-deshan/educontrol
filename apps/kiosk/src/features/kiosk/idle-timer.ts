import { createStore, type Store } from "@/lib/store";

// Kiosk idle behaviour (SPEC §2.3, §2.6, H23; ARCHITECTURE §4.7): 2 min → back to S1 and drop
// technician; 5 min → dim; 15 min → black. Timings are injectable (`?idle-scale=`, tests).
// D-29: R-101's kiosk never dims or blanks (dimMs/blankMs null); returning home is unchanged.

export type SleepLevel = "awake" | "dim" | "blank";

export interface IdleTimings {
  returnHomeMs: number;
  /** null: never dims. */
  dimMs: number | null;
  /** null: never blanks. */
  blankMs: number | null;
}

export const KIOSK_IDLE_TIMINGS: IdleTimings = { returnHomeMs: 2 * 60_000, dimMs: null, blankMs: null };

export function scaleTimings(timings: IdleTimings, scale: number): IdleTimings {
  return {
    returnHomeMs: Math.round(timings.returnHomeMs * scale),
    dimMs: timings.dimMs === null ? null : Math.round(timings.dimMs * scale),
    blankMs: timings.blankMs === null ? null : Math.round(timings.blankMs * scale),
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
    timers = [setTimeout(options.onReturnHome, returnHomeMs)];
    if (dimMs !== null) timers.push(setTimeout(() => level.set("dim"), dimMs));
    if (blankMs !== null) timers.push(setTimeout(() => level.set("blank"), blankMs));
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
