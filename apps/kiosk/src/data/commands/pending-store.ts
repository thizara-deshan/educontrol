import { createStore, type Store } from "@/lib/store";

// H5 / ARCHITECTURE §4.6: the pending overlay is the ONLY optimistic thing in the UI.
// Keyed by a control key: an OutputId ("lights.front") or "<OutputId>:<variant>"
// ("projector.ir:on") when one output has several buttons.
export type ControlKey = string;

export interface PendingEntry {
  key: ControlKey;
  clientCmdId: string;
  status: "pending" | "sent";
  startedAt: number;
}

/** Transport timeout (Q12, [ASSUMED] 10 s) + 5 s safety margin (ARCHITECTURE §4.6 step 5). */
export const PENDING_SAFETY_MS = 15_000;

export interface PendingStore {
  entries: Store<ReadonlyMap<ControlKey, PendingEntry>>;
  isPending(key: ControlKey): boolean;
  add(entry: PendingEntry): void;
  /** `sent` keeps the overlay. Returns false when the command is not ours. */
  markSent(clientCmdId: string): boolean;
  /** Removes and returns the entry for a terminal status or an HTTP error. */
  remove(clientCmdId: string): PendingEntry | undefined;
  /** Snapshot (H4) clears every overlay. */
  clear(): void;
  /** Removes entries older than `maxAgeMs` and returns them. */
  sweep(now: number, maxAgeMs?: number): PendingEntry[];
}

export function createPendingStore(): PendingStore {
  const entries = createStore<ReadonlyMap<ControlKey, PendingEntry>>(new Map());

  const findByCmdId = (clientCmdId: string): PendingEntry | undefined => {
    for (const entry of entries.get().values()) {
      if (entry.clientCmdId === clientCmdId) return entry;
    }
    return undefined;
  };
  const without = (keys: ControlKey[]): void => {
    const next = new Map(entries.get());
    for (const key of keys) next.delete(key);
    entries.set(next);
  };

  return {
    entries,
    isPending: (key) => entries.get().has(key),
    add(entry) {
      const next = new Map(entries.get());
      next.set(entry.key, entry);
      entries.set(next);
    },
    markSent(clientCmdId) {
      const entry = findByCmdId(clientCmdId);
      if (entry === undefined) return false;
      const next = new Map(entries.get());
      next.set(entry.key, { ...entry, status: "sent" });
      entries.set(next);
      return true;
    },
    remove(clientCmdId) {
      const entry = findByCmdId(clientCmdId);
      if (entry !== undefined) without([entry.key]);
      return entry;
    },
    clear() {
      if (entries.get().size > 0) entries.set(new Map());
    },
    sweep(now, maxAgeMs = PENDING_SAFETY_MS) {
      const expired = [...entries.get().values()].filter((entry) => now - entry.startedAt > maxAgeMs);
      if (expired.length > 0) without(expired.map((entry) => entry.key));
      return expired;
    },
  };
}

export const pendingStore = createPendingStore();
