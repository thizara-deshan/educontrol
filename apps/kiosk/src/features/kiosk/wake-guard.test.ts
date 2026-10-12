import { describe, expect, it, vi } from "vitest";
import { createWakeGuard, type GuardedEventType } from "./wake-guard";

const TAP: GuardedEventType[] = ["pointerdown", "pointerup", "click"];

function guard(asleep: boolean) {
  const state = { asleep };
  const wake = vi.fn(() => {
    state.asleep = false;
  });
  return { state, wake, guard: createWakeGuard({ isAsleep: () => state.asleep, wake }) };
}

describe("wake-tap guard", () => {
  it("passes every event while awake", () => {
    const { guard: g, wake } = guard(false);
    expect(TAP.map((t) => g.handle(t))).toEqual([false, false, false]);
    expect(wake).not.toHaveBeenCalled();
  });

  it("swallows exactly the waking tap, then passes the next one", () => {
    const { guard: g, wake } = guard(true);
    expect(TAP.map((t) => g.handle(t))).toEqual([true, true, true]);
    expect(wake).toHaveBeenCalledTimes(1);
    expect(TAP.map((t) => g.handle(t))).toEqual([false, false, false]);
  });

  it("a tap whose click never comes does not swallow the next tap", () => {
    const { guard: g } = guard(true);
    expect(g.handle("pointerdown")).toBe(true);
    expect(g.handle("pointerup")).toBe(true);
    // No click (finger slid off). The next tap starts fresh.
    expect(TAP.map((t) => g.handle(t))).toEqual([false, false, false]);
  });

  it("swallows again if the screen went back to sleep", () => {
    const { guard: g, state, wake } = guard(true);
    TAP.forEach((t) => g.handle(t));
    state.asleep = true;
    expect(TAP.map((t) => g.handle(t))).toEqual([true, true, true]);
    expect(wake).toHaveBeenCalledTimes(2);
  });
});
