import type { ServerEvent } from "@eduscope/contracts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RealtimeHandlers } from "@/data/api-client";
import { roomState } from "@/data/test/room-state";
import {
  BACK_ONLINE_MS, backoffDelay, createConnectionManager, DEAD_AFTER_MS, UNREACHABLE_AFTER_MS,
} from "./connection";

/** A scripted transport: every open() records its handlers. */
function fakeTransport() {
  const sockets: { handlers: RealtimeHandlers; closed: boolean }[] = [];
  return {
    sockets,
    open(handlers: RealtimeHandlers) {
      const socket = { handlers, closed: false };
      sockets.push(socket);
      return { close: () => { socket.closed = true; } };
    },
    last() {
      const socket = sockets.at(-1);
      if (socket === undefined) throw new Error("no socket opened");
      return socket;
    },
  };
}

const snapshot: ServerEvent = { type: "snapshot", state: roomState() };
const ping: ServerEvent = { type: "ping" };

function setup() {
  const transport = fakeTransport();
  const onEvent = vi.fn();
  // random() = 0.5 → no jitter, so delays equal BACKOFF_MS exactly.
  const manager = createConnectionManager({ open: transport.open, onEvent, random: () => 0.5 });
  return { transport, onEvent, manager };
}

describe("backoffDelay", () => {
  it("follows 0.5, 1, 2, 4, 8 s and caps at 8 s", () => {
    expect([0, 1, 2, 3, 4, 5, 9].map((n) => backoffDelay(n, () => 0.5))).toEqual([
      500, 1000, 2000, 4000, 8000, 8000, 8000,
    ]);
  });
  it("applies ±20% jitter", () => {
    expect(backoffDelay(0, () => 0)).toBe(400);
    expect(backoffDelay(0, () => 1)).toBe(600);
  });
});

describe("connection manager", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts in connecting and goes live on the first snapshot (H1)", () => {
    const { transport, manager, onEvent } = setup();
    manager.start();
    expect(manager.status.get()).toBe("connecting");
    transport.last().handlers.onOpen();
    expect(manager.status.get()).toBe("connecting");
    transport.last().handlers.onEvent(snapshot);
    expect(onEvent).toHaveBeenCalledWith(snapshot);
    expect(manager.status.get()).toBe("live");
  });

  it("goes reconnecting on close and retries with the backoff sequence (H3)", () => {
    const { transport, manager } = setup();
    manager.start();
    transport.last().handlers.onEvent(snapshot);
    transport.last().handlers.onClose();
    expect(manager.status.get()).toBe("reconnecting");
    expect(transport.sockets).toHaveLength(1);

    for (const delay of [500, 1000, 2000, 4000]) {
      vi.advanceTimersByTime(delay - 1);
      const before = transport.sockets.length;
      expect(transport.sockets).toHaveLength(before);
      vi.advanceTimersByTime(1);
      expect(transport.sockets).toHaveLength(before + 1);
      transport.last().handlers.onClose(); // attempt fails
    }
  });

  it("turns unreachable 10 s after the drop (H2)", () => {
    const { transport, manager } = setup();
    manager.start();
    transport.last().handlers.onEvent(snapshot);
    transport.last().handlers.onClose();
    vi.advanceTimersByTime(UNREACHABLE_AFTER_MS - 1);
    expect(manager.status.get()).toBe("reconnecting");
    vi.advanceTimersByTime(1);
    expect(manager.status.get()).toBe("unreachable");
  });

  it("shows back_online for 2 s after a resync, then live (H4)", () => {
    const { transport, manager } = setup();
    manager.start();
    transport.last().handlers.onEvent(snapshot);
    transport.last().handlers.onClose();
    vi.advanceTimersByTime(500);
    transport.last().handlers.onEvent(snapshot);
    expect(manager.status.get()).toBe("back_online");
    vi.advanceTimersByTime(BACK_ONLINE_MS);
    expect(manager.status.get()).toBe("live");
  });

  it("resets the backoff after a successful snapshot", () => {
    const { transport, manager } = setup();
    manager.start();
    transport.last().handlers.onEvent(snapshot);
    transport.last().handlers.onClose();
    vi.advanceTimersByTime(500);
    transport.last().handlers.onClose();
    vi.advanceTimersByTime(1000);
    transport.last().handlers.onEvent(snapshot); // back online
    transport.last().handlers.onClose();
    const before = transport.sockets.length;
    vi.advanceTimersByTime(500);
    expect(transport.sockets).toHaveLength(before + 1);
  });

  it("treats 25 s without any frame as a drop", () => {
    const { transport, manager } = setup();
    manager.start();
    transport.last().handlers.onEvent(snapshot);
    vi.advanceTimersByTime(DEAD_AFTER_MS - 1);
    transport.last().handlers.onEvent(ping); // keeps it alive
    vi.advanceTimersByTime(DEAD_AFTER_MS - 1);
    expect(manager.status.get()).toBe("live");
    vi.advanceTimersByTime(1);
    expect(manager.status.get()).toBe("reconnecting");
    expect(transport.sockets[0]?.closed).toBe(true);
  });

  it("retry from unreachable reconnects immediately and restarts the 10 s window", () => {
    const { transport, manager } = setup();
    manager.start();
    transport.last().handlers.onEvent(snapshot);
    transport.last().handlers.onClose();
    vi.advanceTimersByTime(UNREACHABLE_AFTER_MS);
    expect(manager.status.get()).toBe("unreachable");
    const before = transport.sockets.length;
    manager.retry();
    expect(transport.sockets).toHaveLength(before + 1);
    expect(manager.status.get()).toBe("reconnecting");
    vi.advanceTimersByTime(UNREACHABLE_AFTER_MS);
    expect(manager.status.get()).toBe("unreachable");
  });

  it("resume while reconnecting reconnects immediately (visibility resync)", () => {
    const { transport, manager } = setup();
    manager.start();
    transport.last().handlers.onEvent(snapshot);
    transport.last().handlers.onClose();
    vi.advanceTimersByTime(500);
    transport.last().handlers.onClose(); // next attempt is 1 s away
    const before = transport.sockets.length;
    manager.resume();
    expect(transport.sockets).toHaveLength(before + 1);
    transport.last().handlers.onEvent(snapshot);
    expect(manager.status.get()).toBe("back_online");
  });

  it("resume when live but silent for >15 s closes and reconnects", () => {
    const { transport, manager } = setup();
    manager.start();
    transport.last().handlers.onEvent(snapshot);
    vi.advanceTimersByTime(16_000); // e.g. a phone asleep: timers frozen, frames missed
    manager.resume();
    expect(transport.sockets[0]?.closed).toBe(true);
    expect(transport.sockets).toHaveLength(2);
    expect(manager.status.get()).toBe("reconnecting");
  });

  it("resume when live and fresh does nothing", () => {
    const { transport, manager } = setup();
    manager.start();
    transport.last().handlers.onEvent(snapshot);
    vi.advanceTimersByTime(5000);
    manager.resume();
    expect(transport.sockets).toHaveLength(1);
    expect(manager.status.get()).toBe("live");
  });

  it("ignores callbacks from a replaced socket", () => {
    const { transport, manager, onEvent } = setup();
    manager.start();
    const first = transport.last();
    first.handlers.onEvent(snapshot);
    vi.advanceTimersByTime(16_000);
    manager.resume(); // replaces the socket
    onEvent.mockClear();
    first.handlers.onEvent(snapshot);
    first.handlers.onClose();
    expect(onEvent).not.toHaveBeenCalled();
    expect(transport.sockets).toHaveLength(2);
  });

  it("stop closes the socket and cancels reconnects", () => {
    const { transport, manager } = setup();
    manager.start();
    transport.last().handlers.onEvent(snapshot);
    transport.last().handlers.onClose();
    manager.stop();
    vi.advanceTimersByTime(60_000);
    expect(transport.sockets).toHaveLength(1);
  });
});
