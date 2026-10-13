import type { RoomState, ServerEvent } from "@eduscope/contracts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  FakeRoom, MOCK_COOL_DOWN_MS, MOCK_IR_TO_DRAW_MS, MOCK_LATENCY_MAX_MS, MOCK_NO_DRAW_CHANGE_MS, MOCK_SCREEN_TRAVEL_MS,
  MOCK_WARM_UP_MS,
} from "./fake-room";

// Time scale 0.1, latency 600 ms (random = 1).
const SCALE = 0.1;
let seq = 0;
const nextId = () => `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`;

function connected() {
  const room = new FakeRoom({ random: () => 1, timeScale: SCALE });
  const events: ServerEvent[] = [];
  room.connect("phone", { onOpen: vi.fn(), onEvent: (e: ServerEvent) => events.push(e), onClose: vi.fn() });
  vi.advanceTimersByTime(MOCK_LATENCY_MAX_MS);
  const last = (): RoomState => {
    const found = events.findLast((e) => e.type === "state" || e.type === "snapshot");
    if (found === undefined || (found.type !== "state" && found.type !== "snapshot")) throw new Error("no state");
    return found.state;
  };
  return { room, last };
}

describe("FakeRoom timed behaviour", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("projector off: waiting for draw → cooling down (interlock holding) → standby (R1, H7b, H14, R11)", async () => {
    const { room, last } = connected();
    void room.sendCommand({ client_cmd_id: nextId(), body: { kind: "projector.power", on: false } });
    await vi.advanceTimersByTimeAsync(2 * MOCK_LATENCY_MAX_MS);
    expect(last().display.projector.feedback.phase).toBe("waiting_for_draw");
    expect(last().display.projector.state.value).toBe("running");
    await vi.advanceTimersByTimeAsync(MOCK_IR_TO_DRAW_MS * SCALE + 1000 * SCALE);
    expect(last().display.projector.state.value).toBe("cooling_down");
    expect(last().interlock.status).toBe("holding");
    await vi.advanceTimersByTimeAsync(MOCK_COOL_DOWN_MS * SCALE + 1000 * SCALE);
    expect(last().display.projector.state.value).toBe("standby");
    expect(last().display.projector.power.value?.watts).toBe(3);
    expect(last().interlock.status).toBe("armed");
  });

  it("projector on from standby warms up, then runs at 287 W", async () => {
    const { room, last } = connected();
    void room.sendCommand({ client_cmd_id: nextId(), body: { kind: "projector.power", on: false } });
    await vi.advanceTimersByTimeAsync(2 * MOCK_LATENCY_MAX_MS + (MOCK_IR_TO_DRAW_MS + MOCK_COOL_DOWN_MS) * SCALE + 200);
    void room.sendCommand({ client_cmd_id: nextId(), body: { kind: "projector.power", on: true } });
    await vi.advanceTimersByTimeAsync(2 * MOCK_LATENCY_MAX_MS + MOCK_IR_TO_DRAW_MS * SCALE + 200);
    expect(last().display.projector.state.value).toBe("warming_up");
    await vi.advanceTimersByTimeAsync(MOCK_WARM_UP_MS * SCALE);
    expect(last().display.projector.state.value).toBe("running");
    expect(last().display.projector.power.value?.watts).toBe(287);
  });

  it("no draw change next: the phase turns no_change after 90 s scaled (H7b)", async () => {
    const { room, last } = connected();
    room.noDrawChangeNextCommand();
    void room.sendCommand({ client_cmd_id: nextId(), body: { kind: "projector.power", on: false } });
    await vi.advanceTimersByTimeAsync(2 * MOCK_LATENCY_MAX_MS + MOCK_NO_DRAW_CHANGE_MS * SCALE - 100);
    expect(last().display.projector.feedback.phase).toBe("waiting_for_draw");
    await vi.advanceTimersByTimeAsync(200);
    expect(last().display.projector.feedback.phase).toBe("no_change");
    expect(last().display.projector.state.value).toBe("running");
  });

  it("power on while already running needs no draw change", async () => {
    const { room, last } = connected();
    void room.sendCommand({ client_cmd_id: nextId(), body: { kind: "projector.power", on: true } });
    await vi.advanceTimersByTimeAsync(2 * MOCK_LATENCY_MAX_MS);
    expect(last().display.projector.feedback.phase).toBe("idle");
  });

  it("screen moves, then arrives", async () => {
    const { room, last } = connected();
    void room.sendCommand({ client_cmd_id: nextId(), body: { kind: "screen.move", to: "raise" } });
    await vi.advanceTimersByTimeAsync(2 * MOCK_LATENCY_MAX_MS);
    expect(last().display.screen.value).toBe("moving");
    await vi.advanceTimersByTimeAsync(MOCK_SCREEN_TRAVEL_MS * SCALE);
    expect(last().display.screen.value).toBe("raised");
  });
});
