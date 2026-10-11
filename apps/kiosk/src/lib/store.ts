import { useSyncExternalStore } from "react";

/** A tiny external store (ARCHITECTURE §4.5). Snapshots are replaced, never mutated. */
export interface Store<T> {
  get(): T;
  set(next: T): void;
  update(fn: (prev: T) => T): void;
  subscribe(listener: () => void): () => void;
}

export function createStore<T>(initial: T): Store<T> {
  let value = initial;
  const listeners = new Set<() => void>();
  const set = (next: T): void => {
    if (Object.is(next, value)) return;
    value = next;
    for (const listener of listeners) listener();
  };
  return {
    get: () => value,
    set,
    update: (fn) => set(fn(value)),
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/**
 * Subscribe a component to part of a store. The selector must return a primitive or an object
 * that is already part of the snapshot (never a new object), or React re-renders forever.
 */
export function useStore<T, S>(store: Store<T>, selector: (value: T) => S): S {
  const read = (): S => selector(store.get());
  return useSyncExternalStore(store.subscribe, read, read);
}
