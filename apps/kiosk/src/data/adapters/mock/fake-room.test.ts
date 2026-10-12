import type { ServerEvent } from "@eduscope/contracts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FakeRoom, MOCK_COMMAND_TIMEOUT_MS, MOCK_LATENCY_MAX_MS, MOCK_PING_MS } from "./fake-room";

const CMD_ID = "00000000-0000-4000-8000-000000000001";

function connected() {
  const room = new FakeRoom({ random: () => 1 }); // latency = 600 ms, deterministic
  const events: ServerEvent[] = [];
  const handlers = { onOpen: vi.fn(), onEvent: vi.fn((e: ServerEvent) => events.push(e)), onClose: vi.fn() };
  const connection = room.connect("phone", handlers);
  vi.advanceTimersByTime(MOCK_LATENCY_MAX_MS);
  return { room, events, handlers, connection };
}
const types = (events: ServerEvent[]) => events.map((e) => e.type);

describe("FakeRoom", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("opens and sends a snapshot of room-normal first", () => {
    const { events, handlers } = connected();
    expect(handlers.onOpen).toHaveBeenCalled();
    const first = events[0];
    expect(first?.type).toBe("snapshot");
    if (first?.type === "snapshot") expect(first.state.room.id).toBe("R-101");
  });

  it("pings every 10 s", () => {
    const { events } = connected();
    vi.advanceTimersByTime(MOCK_PING_MS);
    expect(types(events)).toContain("ping");
  });

  it("a command goes pending → sent → state → confirmed → activity", async () => {
    const { room, events } = connected();
    const accepted = room.sendCommand({ client_cmd_id: CMD_ID, body: { kind: "lights.set", gang: "rear", on: true } });
    await vi.advanceTimersByTimeAsync(MOCK_LATENCY_MAX_MS);
    expect((await accepted).status).toBe("pending");
    await vi.advanceTimersByTimeAsync(MOCK_LATENCY_MAX_MS);
    expect(types(events).slice(1)).toEqual(["command", "state", "command", "activity"]);
    const state = events[2];
    if (state?.type !== "state") throw new Error("expected state");
    expect(state.state.rev).toBe(2);
    expect(state.state.environment.lights.rear.value).toBe(true);
    expect(state.state.environment.lights.rear.changed_by).toBe("phone"); // the hello label
  });

  it("fail next command emits failed and leaves state alone (H6a)", async () => {
    const { room, events } = connected();
    room.failNextCommand();
    void room.sendCommand({ client_cmd_id: CMD_ID, body: { kind: "lights.set", gang: "rear", on: true } });
    await vi.advanceTimersByTimeAsync(2 * MOCK_LATENCY_MAX_MS);
    const last = events.at(-1);
    expect(last?.type === "command" && last.command.status).toBe("failed");
    expect(types(events)).not.toContain("state");
  });

  it("time out next command emits timed_out after the mock timeout (H6b)", async () => {
    const { room, events } = connected();
    room.timeOutNextCommand();
    void room.sendCommand({ client_cmd_id: CMD_ID, body: { kind: "lights.set", gang: "rear", on: true } });
    await vi.advanceTimersByTimeAsync(MOCK_LATENCY_MAX_MS + MOCK_COMMAND_TIMEOUT_MS);
    const last = events.at(-1);
    expect(last?.type === "command" && last.command.status).toBe("timed_out");
  });

  it("change from phone pushes state and an attributed activity (H13)", () => {
    const { room, events } = connected();
    room.changeFromPhone();
    expect(events.at(-1)).toEqual({ type: "activity", text: "Rear of room turned on", by: "phone", public_id: "mock-phone" });
  });

  it("change by hand toggles Front of room with by hand", () => {
    const { room, events } = connected();
    room.changeByHand();
    expect(events.at(-1)).toMatchObject({ type: "activity", text: "Front of room turned off", by: "by hand", public_id: null });
  });

  it("toggling a device offline degrades the room status (H8)", () => {
    const { room } = connected();
    room.toggleDeviceOffline("lights");
    expect(room.peek().devices.find((d) => d.id === "lights")?.online.value).toBe(false);
    expect(room.peek().room.status).toEqual({ level: "degraded", text: "Lighting switch offline" });
    room.toggleDeviceOffline("lights");
    expect(room.peek().room.status.level).toBe("normal");
  });

  it("drop closes sockets and refuses reconnects until restore", () => {
    const { room, handlers } = connected();
    room.dropConnection();
    expect(handlers.onClose).toHaveBeenCalledTimes(1);
    const retry = { onOpen: vi.fn(), onEvent: vi.fn(), onClose: vi.fn() };
    room.connect("phone", retry);
    vi.advanceTimersByTime(1000);
    expect(retry.onClose).toHaveBeenCalled();
    expect(retry.onEvent).not.toHaveBeenCalled();
  });

  it("changes made while dropped arrive in the next snapshot (resync)", () => {
    const { room } = connected();
    room.dropConnection();
    room.changeByHand();
    room.restore();
    const events: ServerEvent[] = [];
    room.connect("phone", { onOpen: vi.fn(), onEvent: (e) => events.push(e), onClose: vi.fn() });
    vi.advanceTimersByTime(MOCK_LATENCY_MAX_MS);
    const snapshot = events[0];
    if (snapshot?.type !== "snapshot") throw new Error("expected snapshot");
    expect(snapshot.state.environment.lights.front.value).toBe(false);
  });

  it("make unreachable goes silent without closing", () => {
    const { room, events, handlers } = connected();
    room.makeUnreachable();
    const before = events.length;
    room.changeFromPhone();
    vi.advanceTimersByTime(MOCK_PING_MS * 3);
    expect(events).toHaveLength(before);
    expect(handlers.onClose).not.toHaveBeenCalled();
  });
});

/** login() waits one mock latency (600 ms with random = 1). */
async function login(room: FakeRoom, level: "control" | "technician", pin: string) {
  const result = room.login({ level, pin, label: "phone" });
  await vi.advanceTimersByTimeAsync(MOCK_LATENCY_MAX_MS);
  return result;
}
const sessionEvents = (events: ServerEvent[]) => events.flatMap((e) => (e.type === "session" ? [e.session] : []));

describe("FakeRoom sessions", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts as a remote view session labelled from hello", async () => {
    const { room } = connected();
    const session = room.getSession();
    await vi.advanceTimersByTimeAsync(MOCK_LATENCY_MAX_MS);
    expect(await session).toMatchObject({ client_type: "remote", label: "phone", access: "view" });
  });

  it("room PIN 1234 gives control, technician PIN 123456 gives technician", async () => {
    const { room } = connected();
    expect(await login(room, "control", "1234")).toMatchObject({ access: "control" });
    expect(await login(room, "technician", "123456")).toMatchObject({ access: "technician" });
  });

  it("counts wrong PINs down, locks for 60 s on the fifth, then accepts again (H17)", async () => {
    const { room } = connected();
    for (const left of [4, 3, 2, 1]) {
      expect(await login(room, "control", "0000")).toEqual({ reason: "wrong", retry_after_s: null, attempts_left: left });
    }
    expect(await login(room, "control", "0000")).toEqual({ reason: "locked", retry_after_s: 60, attempts_left: 0 });
    // The right PIN is refused while locked; the remaining time counts down.
    await vi.advanceTimersByTimeAsync(9_400);
    expect(await login(room, "control", "1234")).toEqual({ reason: "locked", retry_after_s: 50, attempts_left: 0 });
    // The other level has its own counter.
    expect(await login(room, "technician", "123456")).toMatchObject({ access: "technician" });
    await vi.advanceTimersByTimeAsync(60_000);
    expect(await login(room, "control", "1234")).toMatchObject({ access: "control" });
  });

  it("lock drops a remote session to view and pushes it", async () => {
    const { room, events } = connected();
    await login(room, "control", "1234");
    const locked = room.lock();
    await vi.advanceTimersByTimeAsync(MOCK_LATENCY_MAX_MS);
    expect(await locked).toMatchObject({ access: "view", unlocked_at: null });
    expect(sessionEvents(events).at(-1)).toMatchObject({ access: "view" });
  });
});
