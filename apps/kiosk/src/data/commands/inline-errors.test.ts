import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createInlineErrorStore, INLINE_ERROR_MS } from "./inline-errors";

describe("inline error store", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows a message for 6 s", () => {
    const store = createInlineErrorStore();
    store.show("lights.front", "Switch didn't respond");
    expect(store.errors.get().get("lights.front")).toBe("Switch didn't respond");
    vi.advanceTimersByTime(INLINE_ERROR_MS - 1);
    expect(store.errors.get().has("lights.front")).toBe(true);
    vi.advanceTimersByTime(1);
    expect(store.errors.get().has("lights.front")).toBe(false);
  });

  it("restarts the 6 s window when shown again", () => {
    const store = createInlineErrorStore();
    store.show("a", "first");
    vi.advanceTimersByTime(4000);
    store.show("a", "second");
    vi.advanceTimersByTime(4000);
    expect(store.errors.get().get("a")).toBe("second");
    vi.advanceTimersByTime(2000);
    expect(store.errors.get().has("a")).toBe(false);
  });

  it("dismiss clears immediately", () => {
    const store = createInlineErrorStore();
    store.show("a", "x");
    store.dismiss("a");
    expect(store.errors.get().size).toBe(0);
  });
});
