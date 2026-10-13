import { useSyncExternalStore } from "react";
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

/**
 * One shared interval for every clock and "12s ago" on screen (M05: not one interval per row).
 * It runs only while something is subscribed; `get()` is a tick count that changes every period.
 */
export interface Ticker {
  get(): number;
  subscribe(listener: () => void): () => void;
}

export function createTicker(periodMs: number): Ticker {
  let tick = 0;
  let id: ReturnType<typeof setInterval> | null = null;
  const listeners = new Set<() => void>();
  return {
    get: () => tick,
    subscribe(listener) {
      listeners.add(listener);
      if (id === null) {
        id = setInterval(() => {
          tick += 1;
          for (const l of listeners) l();
        }, periodMs);
      }
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0 && id !== null) {
          clearInterval(id);
          id = null;
        }
      };
    },
  };
}

export const secondTicker = createTicker(1000);

/** Server "now", re-rendered every second by the shared ticker; `null` before the first snapshot. */
export function useServerNow(clock: ServerClock = serverClock, ticker: Ticker = secondTicker): Date | null {
  const offset = useStore(clock.offset, (value) => value);
  useSyncExternalStore(ticker.subscribe, ticker.get, ticker.get);
  return offset === null ? null : clock.now();
}
