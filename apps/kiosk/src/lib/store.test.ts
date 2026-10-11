import { describe, expect, it, vi } from "vitest";
import { createStore } from "./store";

describe("createStore", () => {
  it("returns the initial value", () => {
    expect(createStore(1).get()).toBe(1);
  });

  it("notifies subscribers on set and update", () => {
    const store = createStore(1);
    const listener = vi.fn();
    store.subscribe(listener);
    store.set(2);
    store.update((n) => n + 1);
    expect(store.get()).toBe(3);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("does not notify when the value is identical", () => {
    const store = createStore("a");
    const listener = vi.fn();
    store.subscribe(listener);
    store.set("a");
    expect(listener).not.toHaveBeenCalled();
  });

  it("stops notifying after unsubscribe", () => {
    const store = createStore(0);
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    unsubscribe();
    store.set(1);
    expect(listener).not.toHaveBeenCalled();
  });
});
