import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clampLevel, createLevelThrottle, levelFromPointer, SLIDER_IDLE, sliderDisplayLevel,
  sliderReducer, type SliderState,
} from "./level-slider";

describe("levelFromPointer", () => {
  it("maps the track to 0–100 and clamps", () => {
    expect(levelFromPointer(100, 100, 200)).toBe(0);
    expect(levelFromPointer(200, 100, 200)).toBe(50);
    expect(levelFromPointer(300, 100, 200)).toBe(100);
    expect(levelFromPointer(50, 100, 200)).toBe(0);
    expect(levelFromPointer(400, 100, 200)).toBe(100);
    expect(levelFromPointer(150, 100, 0)).toBe(0);
  });
  it("rounds to integers", () => {
    expect(clampLevel(61.6)).toBe(62);
  });
});

describe("createLevelThrottle", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("sends the first move immediately", () => {
    const send = vi.fn();
    createLevelThrottle(send).move(10);
    expect(send).toHaveBeenCalledWith(10, false);
  });

  it("sends at most once per 200 ms and then the latest value", () => {
    const send = vi.fn();
    const throttle = createLevelThrottle(send);
    throttle.move(10);
    vi.advanceTimersByTime(50);
    throttle.move(20);
    vi.advanceTimersByTime(50);
    throttle.move(30);
    expect(send).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(100); // t = 200
    expect(send).toHaveBeenCalledTimes(2);
    expect(send).toHaveBeenLastCalledWith(30, false);
  });

  it("sends again immediately once 200 ms have passed", () => {
    const send = vi.fn();
    const throttle = createLevelThrottle(send);
    throttle.move(10);
    vi.advanceTimersByTime(250);
    throttle.move(40);
    expect(send).toHaveBeenCalledTimes(2);
    expect(send).toHaveBeenLastCalledWith(40, false);
  });

  it("release cancels the trailing send and sends final once", () => {
    const send = vi.fn();
    const throttle = createLevelThrottle(send);
    throttle.move(10);
    throttle.move(20);
    throttle.release(25);
    vi.advanceTimersByTime(1000);
    expect(send.mock.calls).toEqual([[10, false], [25, true]]);
  });

  it("release without a move sends final only", () => {
    const send = vi.fn();
    createLevelThrottle(send).release(70);
    expect(send.mock.calls).toEqual([[70, true]]);
  });

  it("starts a fresh drag after release", () => {
    const send = vi.fn();
    const throttle = createLevelThrottle(send);
    throttle.move(10);
    throttle.release(10);
    throttle.move(15);
    expect(send).toHaveBeenLastCalledWith(15, false);
  });

  it("cancel drops a pending trailing send", () => {
    const send = vi.fn();
    const throttle = createLevelThrottle(send);
    throttle.move(10);
    throttle.move(20);
    throttle.cancel();
    vi.advanceTimersByTime(1000);
    expect(send).toHaveBeenCalledTimes(1);
  });
});

describe("sliderReducer", () => {
  const dragging: SliderState = { mode: "dragging", level: 40 };

  it("follows the finger while dragging", () => {
    let state = sliderReducer(SLIDER_IDLE, { type: "down", level: 30 });
    state = sliderReducer(state, { type: "move", level: 45 });
    expect(sliderDisplayLevel(state, 62)).toBe(45);
  });

  it("ignores server pushes while dragging", () => {
    expect(sliderReducer(dragging, { type: "server", value: 90 })).toBe(dragging);
  });

  it("ignores moves when not dragging", () => {
    expect(sliderReducer(SLIDER_IDLE, { type: "move", level: 10 })).toBe(SLIDER_IDLE);
  });

  it("holds the released value until the server value changes", () => {
    let state = sliderReducer(dragging, { type: "up", level: 40, server: 62 });
    expect(sliderDisplayLevel(state, 62)).toBe(40);
    state = sliderReducer(state, { type: "server", value: 62 });
    expect(state.mode).toBe("settling");
    state = sliderReducer(state, { type: "server", value: 40 });
    expect(state).toBe(SLIDER_IDLE);
    expect(sliderDisplayLevel(state, 40)).toBe(40);
  });

  it("falls back to the server value after the settle timeout", () => {
    const settling = sliderReducer(dragging, { type: "up", level: 40, server: 62 });
    const state = sliderReducer(settling, { type: "settle-timeout" });
    expect(sliderDisplayLevel(state, 62)).toBe(62);
  });

  it("shows the server value when idle", () => {
    expect(sliderDisplayLevel(SLIDER_IDLE, null)).toBeNull();
    expect(sliderDisplayLevel(SLIDER_IDLE, 38)).toBe(38);
  });
});
