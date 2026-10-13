import type { ServerEvent } from "@eduscope/contracts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FakeRoom, MOCK_LATENCY_MAX_MS } from "./fake-room";

function connected() {
  const room = new FakeRoom({ random: () => 1 });
  const events: ServerEvent[] = [];
  room.connect("laptop", { onOpen: vi.fn(), onEvent: (e: ServerEvent) => events.push(e), onClose: vi.fn() });
  vi.advanceTimersByTime(MOCK_LATENCY_MAX_MS);
  const settle = async <T>(promise: Promise<T>): Promise<T> => {
    await vi.advanceTimersByTimeAsync(MOCK_LATENCY_MAX_MS);
    return promise;
  };
  return { room, events, settle };
}

describe("FakeSchedule (S3c)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("seeded blocks and one action; add, toggle and delete persist", async () => {
    const { room, events, settle } = connected();
    const seeded = await settle(room.schedule.get());
    expect(seeded.class_blocks).toHaveLength(3);
    expect(seeded.actions.map((a) => [a.name, a.time, a.enabled])).toEqual([["All off", "18:00", true]]);

    const block = await settle(room.schedule.createBlock({ days: ["fri"], start: "15:30", end: "17:00" }));
    const action = seeded.actions[0];
    if (action === undefined) throw new Error("no action");
    const { id, ...input } = action;
    await settle(room.schedule.updateAction(id, { ...input, enabled: false }));
    await settle(room.schedule.deleteBlock("blk-1"));

    const after = await settle(room.schedule.get());
    expect(after.class_blocks.map((b) => b.id)).toEqual(["blk-2", "blk-3", block.id]);
    expect(after.actions[0]?.enabled).toBe(false);
    expect(events).toContainEqual({ type: "invalidate", keys: [["schedule"]] });
  });

  it("an end before the start is refused", async () => {
    const { room } = connected();
    await expect(room.schedule.createBlock({ days: ["mon"], start: "10:00", end: "09:00" })).rejects.toThrow();
  });
});
