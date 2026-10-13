import type { RoomState } from "@eduscope/contracts";
import type { Clock } from "../clock.ts";
import { derive } from "./derive.ts";
import type { RoomModel, RuleConfig } from "./model.ts";

// ARCHITECTURE §6.4: the single in-memory RoomState. Every change goes through update(): apply a
// pure mutation, re-derive, bump `rev`, schedule ONE broadcast per 50 ms (D-02).

export const BROADCAST_COALESCE_MS = 50;

export interface StateStore {
  /** The current state, stamped with the server time. */
  get(): RoomState;
  model(): RoomModel;
  /** Applies `fn`, re-derives and bumps `rev` when anything changed. Returns the new state. */
  update(fn: (model: RoomModel, now: string) => RoomModel): RoomState;
  /** Re-derives with the current time (staleness, H7b, hw grace); broadcasts only on change. */
  tick(): void;
  /** Listeners get the coalesced state (each broadcast). */
  subscribe(listener: (state: RoomState) => void): () => void;
  /** Sends a pending broadcast now (before a `command`/`activity` event that refers to it). */
  flush(): void;
  /** Cancels a pending broadcast timer (shutdown). */
  close(): void;
}

/** Comparison key: everything except the fields that change on their own. */
const fingerprint = (state: RoomState): string => JSON.stringify({ ...state, rev: 0, server_time: "" });

export function createStateStore(options: { initial: RoomModel; clock: Clock; rules: RuleConfig; coalesceMs?: number }): StateStore {
  const { clock, rules } = options;
  const coalesceMs = options.coalesceMs ?? BROADCAST_COALESCE_MS;
  let model = derive(options.initial, clock.now(), rules);
  let timer: ReturnType<typeof setTimeout> | null = null;
  const listeners = new Set<(state: RoomState) => void>();

  const get = (): RoomState => ({ ...model.state, server_time: clock.now().toISOString() });

  const emit = (): void => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
    const state = get();
    for (const listener of listeners) listener(state);
  };

  const commit = (next: RoomModel): void => {
    if (fingerprint(next.state) === fingerprint(model.state)) {
      model = next; // facts may still have changed
      return;
    }
    model = { ...next, state: { ...next.state, rev: model.state.rev + 1 } };
    if (timer === null) timer = setTimeout(emit, coalesceMs);
  };

  return {
    get,
    model: () => model,
    update(fn) {
      const now = clock.now();
      commit(derive(fn(model, now.toISOString()), now, rules));
      return get();
    },
    tick() {
      commit(derive(model, clock.now(), rules));
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    flush() {
      if (timer !== null) emit();
    },
    close() {
      if (timer !== null) clearTimeout(timer);
      timer = null;
    },
  };
}
