/** Injectable time source (ARCHITECTURE §6.1 `deps.clock`). Timers stay real; tests fake them with vi. */
export interface Clock {
  now(): Date;
}

export const systemClock: Clock = { now: () => new Date() };

/** A clock that only moves when told to (tests). */
export interface FixedClock extends Clock {
  set(iso: string): void;
  advance(ms: number): void;
}

export function fixedClock(iso: string): FixedClock {
  let current = new Date(iso).getTime();
  return {
    now: () => new Date(current),
    set: (next) => {
      current = new Date(next).getTime();
    },
    advance: (ms) => {
      current += ms;
    },
  };
}
