import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createIdleTimer, type IdleTimings, KIOSK_IDLE_TIMINGS, scaleTimings } from "./idle-timer";

const MIN = 60_000;
/** SPEC §2.6 timings with sleep on; the timer still supports them (D-29 turns them off for R-101). */
const SLEEPING: IdleTimings = { returnHomeMs: 2 * MIN, dimMs: 5 * MIN, blankMs: 15 * MIN };

describe("kiosk idle timer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function started(timings: IdleTimings = SLEEPING) {
    const onReturnHome = vi.fn();
    const timer = createIdleTimer({ timings, onReturnHome });
    timer.start();
    return { timer, onReturnHome };
  }

  it("2 min → return home once; 5 min → dim; 15 min → blank", () => {
    const { timer, onReturnHome } = started();
    vi.advanceTimersByTime(2 * MIN - 1);
    expect(onReturnHome).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onReturnHome).toHaveBeenCalledTimes(1);
    expect(timer.level.get()).toBe("awake");
    vi.advanceTimersByTime(3 * MIN);
    expect(timer.level.get()).toBe("dim");
    vi.advanceTimersByTime(10 * MIN - 1);
    expect(timer.level.get()).toBe("dim");
    vi.advanceTimersByTime(1);
    expect(timer.level.get()).toBe("blank");
    vi.advanceTimersByTime(60 * MIN);
    expect(onReturnHome).toHaveBeenCalledTimes(1);
  });

  it("D-29: the kiosk returns home after 2 min but never dims or blanks", () => {
    const { timer, onReturnHome } = started(KIOSK_IDLE_TIMINGS);
    vi.advanceTimersByTime(2 * MIN);
    expect(onReturnHome).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(24 * 60 * MIN);
    expect(timer.level.get()).toBe("awake");
    expect(onReturnHome).toHaveBeenCalledTimes(1);
  });

  it("activity restarts every timer", () => {
    const { timer, onReturnHome } = started();
    vi.advanceTimersByTime(1.5 * MIN);
    timer.activity();
    vi.advanceTimersByTime(1.5 * MIN);
    expect(onReturnHome).not.toHaveBeenCalled();
    vi.advanceTimersByTime(0.5 * MIN);
    expect(onReturnHome).toHaveBeenCalledTimes(1);
  });

  it("activity while dim or blank wakes and starts a new idle period", () => {
    const { timer, onReturnHome } = started();
    vi.advanceTimersByTime(15 * MIN);
    expect(timer.level.get()).toBe("blank");
    timer.activity();
    expect(timer.level.get()).toBe("awake");
    vi.advanceTimersByTime(5 * MIN);
    expect(timer.level.get()).toBe("dim");
    expect(onReturnHome).toHaveBeenCalledTimes(2);
  });

  it("stop cancels everything", () => {
    const { timer, onReturnHome } = started();
    timer.stop();
    vi.advanceTimersByTime(60 * MIN);
    expect(onReturnHome).not.toHaveBeenCalled();
    expect(timer.level.get()).toBe("awake");
  });

  it("scaleTimings shortens every step (?idle-scale=0.01)", () => {
    expect(scaleTimings(SLEEPING, 0.01)).toEqual({ returnHomeMs: 1_200, dimMs: 3_000, blankMs: 9_000 });
    expect(scaleTimings(KIOSK_IDLE_TIMINGS, 0.01)).toEqual({ returnHomeMs: 1_200, dimMs: null, blankMs: null });
  });
});
