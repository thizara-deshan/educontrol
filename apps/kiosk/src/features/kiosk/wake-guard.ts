// R15 / H23: while the kiosk is dimmed or blank, the first tap only wakes the screen. The guard
// sees the capture-phase pointerdown → pointerup → click of that tap and swallows all three, so
// nothing underneath (a control, the PIN pad, a toast) ever receives it.

export type GuardedEventType = "pointerdown" | "pointerup" | "click";
export const GUARDED_EVENTS: readonly GuardedEventType[] = ["pointerdown", "pointerup", "click"];

export interface WakeGuard {
  /** `true` = swallow this event (preventDefault + stopPropagation). */
  handle(type: GuardedEventType): boolean;
}

export function createWakeGuard(options: { isAsleep: () => boolean; wake: () => void }): WakeGuard {
  /** Inside the waking tap: its pointerup and click are swallowed too. */
  let swallowing = false;
  return {
    handle(type) {
      if (type === "pointerdown") {
        if (options.isAsleep()) {
          swallowing = true;
          options.wake();
          return true;
        }
        swallowing = false; // a new tap after the waking one always passes
        return false;
      }
      if (!swallowing) return false;
      if (type === "click") swallowing = false; // the tap is over
      return true;
    },
  };
}
