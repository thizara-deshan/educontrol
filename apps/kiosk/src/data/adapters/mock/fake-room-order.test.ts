import type { ServerEvent } from "@eduscope/contracts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FakeRoom, MOCK_LATENCY_MAX_MS } from "./fake-room";

let seq = 0;
const nextId = () => `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`;

describe("FakeRoom command order", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("commands land in arrival order even with random latency (unmute, then level)", async () => {
    // connect 600 · mute 200+200 · unmute 600+600 (slow) · level 200+200 (fast)
    const draws = [1, 0, 0, 1, 1, 0, 0];
    const room = new FakeRoom({ random: () => draws.shift() ?? 1 });
    const events: ServerEvent[] = [];
    room.connect("phone", { onOpen: vi.fn(), onEvent: (e: ServerEvent) => events.push(e), onClose: vi.fn() });
    await vi.advanceTimersByTimeAsync(MOCK_LATENCY_MAX_MS);
    void room.sendCommand({ client_cmd_id: nextId(), body: { kind: "audio.mute_all", muted: true } });
    await vi.advanceTimersByTimeAsync(2 * MOCK_LATENCY_MAX_MS);
    void room.sendCommand({ client_cmd_id: nextId(), body: { kind: "audio.mute_all", muted: false } }); // slow
    void room.sendCommand({ client_cmd_id: nextId(), body: { kind: "audio.level", channel: "mic", level: 10, final: true } }); // fast
    await vi.advanceTimersByTimeAsync(4 * MOCK_LATENCY_MAX_MS);
    const state = events.findLast((e) => e.type === "state");
    if (state?.type !== "state") throw new Error("no state");
    expect(state.state.audio.muted_all.value).toBe(false);
    expect(state.state.audio.channels.mic.value).toBe(10);
    expect(state.state.audio.channels.pc.value).toBe(38);
  });

  it("every change re-derives the room status (S1.E4)", () => {
    const room = new FakeRoom({ random: () => 1 });
    const events: ServerEvent[] = [];
    room.connect("phone", { onOpen: vi.fn(), onEvent: (e: ServerEvent) => events.push(e), onClose: vi.fn() });
    vi.advanceTimersByTime(MOCK_LATENCY_MAX_MS);
    room.toggleDeviceOffline("audio");
    const state = events.at(-1);
    if (state?.type !== "state") throw new Error("no state");
    expect(state.state.room.status).toEqual({ level: "degraded", text: "Audio mixer offline" });
  });
});
