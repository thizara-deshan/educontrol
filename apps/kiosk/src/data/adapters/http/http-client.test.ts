import type { Command, ServerEvent } from "@eduscope/contracts";
import { describe, expect, it, vi } from "vitest";
import { ApiRequestError } from "@/data/api-client";
import { roomState } from "@/data/test/room-state";
import { createHttpApiClient, sameOriginWsUrl, type SocketLike } from "./http-client";

const CMD_ID = "00000000-0000-4000-8000-000000000001";
const json = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

function client(fetchImpl: typeof fetch) {
  return createHttpApiClient({ fetch: fetchImpl, wsUrl: "ws://r-101.local/ws" });
}

class FakeSocket implements SocketLike {
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  sent: string[] = [];
  closed = false;
  send(data: string) { this.sent.push(data); }
  close() { this.closed = true; }
  emit(data: string) { this.onmessage?.(new MessageEvent("message", { data })); }
  /** CloseEvent is not a global before Node 23, so build one structurally. */
  fireClose() { this.onclose?.(Object.assign(new Event("close"), { code: 1006, reason: "", wasClean: false })); }
  fireError() { this.onerror?.(new Event("error")); }
}

describe("http adapter: REST", () => {
  it("getState parses the RoomState", async () => {
    const fetchMock = vi.fn(async () => json(200, roomState()));
    const state = await client(fetchMock).getState();
    expect(state.room.id).toBe("R-101");
    expect(fetchMock).toHaveBeenCalledWith("/api/state", { credentials: "same-origin" });
  });

  it("rejects a response that fails the contract", async () => {
    const fetchMock = vi.fn(async () => json(200, { rev: "nope" }));
    await expect(client(fetchMock).getState()).rejects.toMatchObject({ code: "bad_response" });
  });

  it("maps an ApiError body to ApiRequestError", async () => {
    const fetchMock = vi.fn(async () => json(401, { code: "unauthorized", message: "PIN required" }));
    const error: unknown = await client(fetchMock).getSession().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiRequestError);
    expect(error).toMatchObject({ code: "unauthorized", message: "PIN required", status: 401 });
  });

  it("maps a non-JSON error body to bad_response", async () => {
    const fetchMock = vi.fn(async () => new Response("<html>", { status: 502 }));
    await expect(client(fetchMock).getSession()).rejects.toMatchObject({ code: "bad_response", status: 502 });
  });

  it("maps a fetch rejection to network", async () => {
    const fetchMock = vi.fn(async () => { throw new TypeError("Failed to fetch"); });
    await expect(client(fetchMock).getState()).rejects.toMatchObject({ code: "network", status: null });
  });

  it("sendCommand POSTs JSON and parses the 202 Command", async () => {
    const accepted: Command = {
      id: "cmd-1", client_cmd_id: CMD_ID, body: { kind: "lights.set", gang: "rear", on: true },
      issued_by: { public_id: "p1", label: "laptop" }, status: "pending", error: null,
      at: "2026-10-05T10:42:00Z",
    };
    const fetchMock = vi.fn(async () => json(202, accepted));
    const result = await client(fetchMock).sendCommand({ client_cmd_id: CMD_ID, body: accepted.body });
    expect(result).toEqual(accepted);
    expect(fetchMock).toHaveBeenCalledWith("/api/commands", {
      credentials: "same-origin",
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_cmd_id: CMD_ID, body: accepted.body }),
    });
  });

  it("sendCommand refuses an invalid request before fetching", async () => {
    const fetchMock = vi.fn(async () => json(202, {}));
    await expect(
      client(fetchMock).sendCommand({ client_cmd_id: "not-a-uuid", body: { kind: "ac.power", on: true } }),
    ).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("http adapter: session", () => {
  const session = {
    public_id: "p1", client_type: "remote", label: "phone", access: "control",
    unlocked_at: "2026-10-05T10:42:00Z", last_activity: "2026-10-05T10:42:00Z", expires_at: null,
  };

  it("login POSTs the request and returns the new session", async () => {
    const fetchMock = vi.fn(async () => json(200, session));
    const result = await client(fetchMock).login({ level: "control", pin: "1234", label: "phone" });
    expect(result).toEqual(session);
    expect(fetchMock).toHaveBeenCalledWith("/api/session/login", {
      credentials: "same-origin",
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ level: "control", pin: "1234", label: "phone" }),
    });
  });

  it.each([200, 401, 429])("login returns a PinError body sent with status %i", async (status) => {
    const pinError = { reason: "locked", retry_after_s: 60, attempts_left: 0 };
    const fetchMock = vi.fn(async () => json(status, pinError));
    await expect(client(fetchMock).login({ level: "control", pin: "0000", label: "phone" })).resolves.toEqual(pinError);
  });

  it("login maps other errors to ApiRequestError", async () => {
    const fetchMock = vi.fn(async () => json(403, { code: "forbidden", message: "Origin mismatch" }));
    await expect(client(fetchMock).login({ level: "technician", pin: "123456", label: "phone" })).rejects.toMatchObject({
      code: "forbidden",
      status: 403,
    });
  });

  it("login refuses a PIN of the wrong length before fetching", async () => {
    const fetchMock = vi.fn(async () => json(200, session));
    await expect(client(fetchMock).login({ level: "control", pin: "123456", label: "phone" })).rejects.toMatchObject({
      code: "validation",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("lock POSTs and parses the downgraded session", async () => {
    const fetchMock = vi.fn(async () => json(200, { ...session, access: "view" }));
    await expect(client(fetchMock).lock()).resolves.toMatchObject({ access: "view" });
    expect(fetchMock).toHaveBeenCalledWith("/api/session/lock", {
      credentials: "same-origin",
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
  });
});

describe("http adapter: WebSocket", () => {
  function connect() {
    const socket = new FakeSocket();
    const api = createHttpApiClient({ fetch: vi.fn(), wsUrl: "ws://r-101.local/ws", createSocket: () => socket });
    const handlers = { onOpen: vi.fn(), onEvent: vi.fn(), onClose: vi.fn() };
    const connection = api.connect("phone", handlers);
    return { socket, handlers, connection };
  }

  it("sends hello with the client label on open", () => {
    const { socket, handlers } = connect();
    socket.onopen?.(new Event("open"));
    expect(socket.sent).toEqual([JSON.stringify({ type: "hello", label: "phone" })]);
    expect(handlers.onOpen).toHaveBeenCalled();
  });

  it("parses frames and forwards valid ServerEvents", () => {
    const { socket, handlers } = connect();
    const event: ServerEvent = { type: "activity", text: "Rear of room turned on", by: "phone", public_id: "x" };
    socket.emit(JSON.stringify(event));
    expect(handlers.onEvent).toHaveBeenCalledWith(event);
  });

  it("answers ping with pong", () => {
    const { socket, handlers } = connect();
    socket.emit(JSON.stringify({ type: "ping" }));
    expect(socket.sent).toContain(JSON.stringify({ type: "pong" }));
    expect(handlers.onEvent).toHaveBeenCalledWith({ type: "ping" });
  });

  it("drops non-JSON and invalid frames", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { socket, handlers } = connect();
    socket.emit("not json");
    socket.emit(JSON.stringify({ type: "state", state: { rev: -1 } }));
    expect(handlers.onEvent).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });

  it("reports close once, and not after a deliberate close()", () => {
    const first = connect();
    first.socket.fireError();
    first.socket.fireClose();
    expect(first.handlers.onClose).toHaveBeenCalledTimes(1);

    const second = connect();
    second.connection.close();
    second.socket.fireClose();
    expect(second.socket.closed).toBe(true);
    expect(second.handlers.onClose).not.toHaveBeenCalled();
  });
});

describe("sameOriginWsUrl", () => {
  it("uses ws for http and wss for https", () => {
    expect(sameOriginWsUrl({ protocol: "http:", host: "r-101.local" })).toBe("ws://r-101.local/ws");
    expect(sameOriginWsUrl({ protocol: "https:", host: "x:8443" })).toBe("wss://x:8443/ws");
  });
});
