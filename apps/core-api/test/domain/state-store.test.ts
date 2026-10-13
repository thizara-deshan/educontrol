import type { RoomState } from "@eduscope/contracts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fixedClock } from "../../src/clock.ts";
import { applyHwEvent } from "../../src/domain/hw-events.ts";
import { createStateStore } from "../../src/domain/state-store.ts";
import { bootModel, hwEvent, RULES, snapshotEvent, T0 } from "../helpers.ts";

describe("state store", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const setup = () => {
    const clock = fixedClock(T0);
    const store = createStateStore({ initial: bootModel(), clock, rules: RULES });
    const seen: RoomState[] = [];
    store.subscribe((state) => seen.push(state));
    return { clock, store, seen };
  };

  it("starts derived at rev 0 with the link down", () => {
    const { store } = setup();
    expect(store.get().rev).toBe(0);
    expect(store.get().room.status.text).toBe("Hardware service offline");
    expect(store.get().devices).toHaveLength(12);
  });

  it("bumps rev on every change and coalesces broadcasts to one per 50 ms", () => {
    const { store, seen } = setup();
    store.update((m) => applyHwEvent(m, snapshotEvent()));
    store.update((m) => applyHwEvent(m, hwEvent("lights.state", { gang: "rear", on: true })));
    expect(store.get().rev).toBe(2);
    expect(seen).toHaveLength(0);
    vi.advanceTimersByTime(50);
    expect(seen.map((s) => s.rev)).toEqual([2]);
  });

  it("an update that changes nothing keeps rev and sends nothing", () => {
    const { store, seen } = setup();
    store.update((m) => applyHwEvent(m, snapshotEvent()));
    vi.advanceTimersByTime(50);
    store.update((m) => applyHwEvent(m, hwEvent("heartbeat", {})));
    vi.advanceTimersByTime(50);
    expect(store.get().rev).toBe(1);
    expect(seen).toHaveLength(1);
  });

  it("rev is monotonic across many updates and flush() sends at once", () => {
    const { store, seen } = setup();
    for (let i = 0; i < 5; i += 1) {
      store.update((m) => applyHwEvent(m, hwEvent("lights.state", { gang: "front", on: i % 2 === 0 })));
      store.flush();
    }
    const revs = seen.map((s) => s.rev);
    expect(revs).toEqual([...revs].sort((a, b) => a - b));
    expect(new Set(revs).size).toBe(revs.length);
  });

  it("tick re-derives with the current time (hw grace) and server_time follows the clock", () => {
    const { store, clock } = setup();
    clock.advance(10_000);
    store.tick();
    expect(store.get().devices.every((d) => d.online.value === false)).toBe(true);
    expect(store.get().server_time).toBe("2026-10-05T10:42:10.000Z");
  });
});
