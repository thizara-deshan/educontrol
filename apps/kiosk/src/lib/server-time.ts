import { useEffect, useState } from "react";
import { createStore, useStore, type Store } from "./store";

// S1.E2: the header shows server time. offset = server − client, updated from every applied
// state frame. `null` until the first snapshot (H1: the clock shows a skeleton).
export interface ServerClock {
  offset: Store<number | null>;
  sync(serverTimeIso: string): void;
  now(): Date | null;
}

export function createServerClock(clientNow: () => number = Date.now): ServerClock {
  const offset = createStore<number | null>(null);
  return {
    offset,
    sync(serverTimeIso) {
      offset.set(new Date(serverTimeIso).getTime() - clientNow());
    },
    now() {
      const current = offset.get();
      return current === null ? null : new Date(clientNow() + current);
    },
  };
}

export const serverClock = createServerClock();

/** Server "now", re-rendered every second; `null` before the first snapshot. */
export function useServerNow(clock: ServerClock = serverClock): Date | null {
  const offset = useStore(clock.offset, (value) => value);
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, []);
  return offset === null ? null : clock.now();
}
