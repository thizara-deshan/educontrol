import { TimedActionInput, type Command, type ServerEvent } from "@eduscope/contracts";
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
  async function connect(fetchImpl: typeof fetch = vi.fn(async () => json(200, {}))) {
    const socket = new FakeSocket();
    const createSocket = vi.fn(() => socket);
    const api = createHttpApiClient({ fetch: fetchImpl, wsUrl: "ws://r-101.local/ws", createSocket });
    const handlers = { onOpen: vi.fn(), onEvent: vi.fn(), onClose: vi.fn() };
    const connection = api.connect("phone", handlers);
    await vi.waitFor(() => expect(createSocket).toHaveBeenCalledWith("ws://r-101.local/ws"));
    return { socket, handlers, connection, fetchImpl };
  }

  it("GETs /api/session first so the upgrade carries the session cookie", async () => {
    const { fetchImpl } = await connect();
    expect(fetchImpl).toHaveBeenCalledWith("/api/session", { credentials: "same-origin" });
  });

  it("a failed session fetch is reported as a close and opens no socket", async () => {
    const createSocket = vi.fn(() => new FakeSocket());
    const api = createHttpApiClient({ fetch: vi.fn(async () => Promise.reject(new TypeError("offline"))), wsUrl: "ws://x/ws", createSocket });
    const handlers = { onOpen: vi.fn(), onEvent: vi.fn(), onClose: vi.fn() };
    api.connect("phone", handlers);
    await vi.waitFor(() => expect(handlers.onClose).toHaveBeenCalledTimes(1));
    expect(createSocket).not.toHaveBeenCalled();
  });

  it("close() before the session answer never opens the socket", async () => {
    const createSocket = vi.fn(() => new FakeSocket());
    const fetchImpl = vi.fn(async () => json(200, {}));
    const api = createHttpApiClient({ fetch: fetchImpl, wsUrl: "ws://x/ws", createSocket });
    const handlers = { onOpen: vi.fn(), onEvent: vi.fn(), onClose: vi.fn() };
    api.connect("phone", handlers).close();
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalled());
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(createSocket).not.toHaveBeenCalled();
    expect(handlers.onClose).not.toHaveBeenCalled();
  });

  it("sends hello with the client label on open", async () => {
    const { socket, handlers } = await connect();
    socket.onopen?.(new Event("open"));
    expect(socket.sent).toEqual([JSON.stringify({ type: "hello", label: "phone" })]);
    expect(handlers.onOpen).toHaveBeenCalled();
  });

  it("parses frames and forwards valid ServerEvents", async () => {
    const { socket, handlers } = await connect();
    const event: ServerEvent = { type: "activity", text: "Rear of room turned on", by: "phone", public_id: "x" };
    socket.emit(JSON.stringify(event));
    expect(handlers.onEvent).toHaveBeenCalledWith(event);
  });

  it("answers ping with pong", async () => {
    const { socket, handlers } = await connect();
    socket.emit(JSON.stringify({ type: "ping" }));
    expect(socket.sent).toContain(JSON.stringify({ type: "pong" }));
    expect(handlers.onEvent).toHaveBeenCalledWith({ type: "ping" });
  });

  it("drops non-JSON and invalid frames", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { socket, handlers } = await connect();
    socket.emit("not json");
    socket.emit(JSON.stringify({ type: "state", state: { rev: -1 } }));
    expect(handlers.onEvent).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });

  it("reports close once, and not after a deliberate close()", async () => {
    const first = await connect();
    first.socket.fireError();
    first.socket.fireClose();
    expect(first.handlers.onClose).toHaveBeenCalledTimes(1);

    const second = await connect();
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

describe("http adapter: settings routes (S3–S3e)", () => {
  /** A fetch that answers by path and method. */
  const fetchBy = (route: (path: string, init: RequestInit | undefined) => Response) =>
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => route(String(input), init));
  const empty = (status: number): Response => new Response(null, { status });
  const irCommand = {
    id: "c1", device_id: "projector", name: "Power on", role: "power_on", setpoint: null, code_format: "tuya",
    captured: true, captured_at: "2026-10-05T10:42:00Z", test: "reacted", tested_at: "2026-10-05T10:43:00Z",
  };
  const irDevice = { device_id: "projector", name: "Projector", brand: "Epson", kind: "projector", transport: "ir_zs06", commands: [irCommand] };

  it("ir: lists devices and posts the test result", async () => {
    const fetchMock = fetchBy((path) => json(200, path === "/api/ir/devices" ? [irDevice] : irCommand));
    const api = client(fetchMock);
    expect(await api.ir.listDevices()).toEqual([irDevice]);
    expect(await api.ir.recordTest("c1", true)).toEqual(irCommand);
    expect(fetchMock).toHaveBeenLastCalledWith("/api/ir/commands/c1/test-result", {
      credentials: "same-origin", method: "POST", headers: { "Content-Type": "application/json" }, body: '{"reacted":true}',
    });
  });

  it("ir: learn, cancel and test are 202s without a body", async () => {
    const fetchMock = fetchBy(() => empty(202));
    const api = client(fetchMock);
    await api.ir.learn("c 1");
    await api.ir.cancelLearn("c1");
    await api.ir.test("c1");
    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
      "/api/ir/commands/c%201/learn", "/api/ir/commands/c1/learn/cancel", "/api/ir/commands/c1/test",
    ]);
  });

  it("ir: a failed learn maps the ApiError (H25)", async () => {
    const fetchMock = fetchBy(() => json(503, { code: "hw_unavailable", message: "IR blaster offline" }));
    await expect(client(fetchMock).ir.learn("c1")).rejects.toMatchObject({ code: "hw_unavailable", status: 503 });
  });

  it("ir: an invalid create is refused before fetching", async () => {
    const fetchMock = fetchBy(() => json(200, irDevice));
    await expect(
      client(fetchMock).ir.createDevice({ name: " ", brand: "Epson", kind: "projector", transport: "ir_zs06" }),
    ).rejects.toMatchObject({ code: "validation" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("schedule: PUT an action, DELETE a block", async () => {
    const action = { id: "a1", name: "All off", time: "18:00", days: ["mon"], enabled: false, steps: [{ kind: "ac.power", on: false }] };
    const fetchMock = fetchBy((_path, init) => (init?.method === "DELETE" ? empty(204) : json(200, action)));
    const api = client(fetchMock);
    const { id, ...input } = action;
    expect(await api.schedule.updateAction(id, TimedActionInput.parse(input))).toEqual(action);
    await api.schedule.deleteBlock("b1");
    expect(fetchMock.mock.calls.map((call) => [call[0], call[1]?.method])).toEqual([
      ["/api/schedule/actions/a1", "PUT"], ["/api/schedule/blocks/b1", "DELETE"],
    ]);
  });

  it("devices: PATCH a rename; permit join posts 240 s", async () => {
    const device = roomState().devices[0];
    const fetchMock = fetchBy((path) => (path.startsWith("/api/zigbee") ? empty(202) : json(200, device)));
    const api = client(fetchMock);
    expect(await api.devices.update("projector", { name: "Projector" })).toEqual(device);
    await api.devices.permitJoin();
    expect(fetchMock.mock.calls.map((call) => [call[0], call[1]?.method, call[1]?.body])).toEqual([
      ["/api/devices/projector", "PATCH", '{"name":"Projector"}'], ["/api/zigbee/permit-join", "POST", '{"seconds":240}'],
    ]);
  });

  it("settings: PUT the room PIN; a 5-digit room PIN never leaves the client", async () => {
    const fetchMock = fetchBy(() => empty(204));
    const api = client(fetchMock);
    await api.settings.setRoomPin("4321");
    await expect(api.settings.setRoomPin("12345")).rejects.toMatchObject({ code: "validation" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/settings/pins/room", {
      credentials: "same-origin", method: "PUT", headers: { "Content-Type": "application/json" }, body: '{"pin":"4321"}',
    });
  });

  it("system: about is parsed; a restart is a POST", async () => {
    const about = { room: "R-101", version: "0.6.0", uptime_s: 12, pi_model: null, url: "http://r-101.local" };
    const fetchMock = fetchBy((path) => (path === "/api/system/about" ? json(200, about) : empty(202)));
    const api = client(fetchMock);
    expect(await api.system.about()).toEqual(about);
    await api.system.restart();
    expect(fetchMock).toHaveBeenLastCalledWith("/api/system/restart", expect.objectContaining({ method: "POST" }));
  });
});
