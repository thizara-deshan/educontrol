import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createServerClock, createTicker } from "./server-time";

describe("createServerClock", () => {
  it("is null before the first sync", () => {
    expect(createServerClock(() => 0).now()).toBeNull();
  });

  it("applies the server − client offset", () => {
    let client = Date.parse("2026-10-05T10:00:00Z");
    const clock = createServerClock(() => client);
    clock.sync("2026-10-05T10:42:00Z");
    expect(clock.now()?.toISOString()).toBe("2026-10-05T10:42:00.000Z");
    client += 60_000;
    expect(clock.now()?.toISOString()).toBe("2026-10-05T10:43:00.000Z");
  });

  it("re-syncs on every call", () => {
    const clock = createServerClock(() => Date.parse("2026-10-05T10:00:00Z"));
    clock.sync("2026-10-05T10:42:00Z");
    clock.sync("2026-10-05T09:00:00Z");
    expect(clock.offset.get()).toBe(-3_600_000);
  });
});

describe("createTicker (one shared 1 s interval)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("ticks every period and notifies every subscriber from one interval", () => {
    const ticker = createTicker(1000);
    const a = vi.fn();
    const b = vi.fn();
    ticker.subscribe(a);
    ticker.subscribe(b);
    expect(vi.getTimerCount()).toBe(1);
    vi.advanceTimersByTime(3000);
    expect(ticker.get()).toBe(3);
    expect(a).toHaveBeenCalledTimes(3);
    expect(b).toHaveBeenCalledTimes(3);
  });

  it("stops when the last subscriber leaves and restarts on the next one", () => {
    const ticker = createTicker(1000);
    const offA = ticker.subscribe(vi.fn());
    const offB = ticker.subscribe(vi.fn());
    offA();
    expect(vi.getTimerCount()).toBe(1);
    offB();
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(5000);
    expect(ticker.get()).toBe(0);
    ticker.subscribe(vi.fn());
    vi.advanceTimersByTime(1000);
    expect(ticker.get()).toBe(1);
  });
});
