import { describe, expect, it, vi } from "vitest";
import { createPendingStore, PENDING_SAFETY_MS, type PendingEntry } from "./pending-store";

const entry = (key: string, clientCmdId: string, startedAt = 0): PendingEntry => ({
  key, clientCmdId, status: "pending", startedAt,
});

describe("pending store", () => {
  it("marks a key pending after add", () => {
    const store = createPendingStore();
    store.add(entry("lights.front", "c1"));
    expect(store.isPending("lights.front")).toBe(true);
    expect(store.isPending("lights.rear")).toBe(false);
  });

  it("markSent keeps the entry and updates its status", () => {
    const store = createPendingStore();
    store.add(entry("lights.front", "c1"));
    expect(store.markSent("c1")).toBe(true);
    expect(store.entries.get().get("lights.front")?.status).toBe("sent");
    expect(store.isPending("lights.front")).toBe(true);
  });

  it("markSent ignores commands that are not ours", () => {
    expect(createPendingStore().markSent("other")).toBe(false);
  });

  it("remove returns and clears the entry by client_cmd_id", () => {
    const store = createPendingStore();
    store.add(entry("lights.front", "c1"));
    store.add(entry("audio.mic", "c2"));
    expect(store.remove("c1")?.key).toBe("lights.front");
    expect(store.isPending("lights.front")).toBe(false);
    expect(store.isPending("audio.mic")).toBe(true);
    expect(store.remove("c1")).toBeUndefined();
  });

  it("clear drops every entry and notifies once", () => {
    const store = createPendingStore();
    store.add(entry("a", "c1"));
    store.add(entry("b", "c2"));
    const listener = vi.fn();
    store.entries.subscribe(listener);
    store.clear();
    expect(store.entries.get().size).toBe(0);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("sweep removes only entries older than the safety window", () => {
    const store = createPendingStore();
    store.add(entry("old", "c1", 0));
    store.add(entry("new", "c2", 10_000));
    const expired = store.sweep(PENDING_SAFETY_MS + 1);
    expect(expired.map((e) => e.key)).toEqual(["old"]);
    expect(store.isPending("old")).toBe(false);
    expect(store.isPending("new")).toBe(true);
  });

  it("publishes a new map on every change (useSyncExternalStore safe)", () => {
    const store = createPendingStore();
    const before = store.entries.get();
    store.add(entry("a", "c1"));
    expect(store.entries.get()).not.toBe(before);
  });
});
