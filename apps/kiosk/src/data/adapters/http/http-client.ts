import {
  ApiError, ClassBlock, ClassBlockInput, ClientMessage, CommandRequest, Device, DeviceList, DevicePatch,
  GetAboutResponse, GetNetworkResponse, GetScheduleResponse, GetSessionResponse, GetStateResponse, IrCommand,
  IrCommandCreate, IrDevice, IrDeviceCreate, IrDeviceList, IrTestResultRequest, LockResponse, LoginRequest,
  PermitJoinRequest, PinError, PostCommandResponse, RoomPinRequest, ServerEvent, TechnicianPinRequest, TimedAction,
  TimedActionInput,
} from "@eduscope/contracts";
import type { z } from "zod";
import { ApiRequestError, type ApiClient, type RealtimeConnection } from "@/data/api-client";

// fetch + WebSocket adapter (ARCHITECTURE §4.4). Every response and frame is zod-parsed.
// Exercised by tests only until M08 brings core-api.

/** The slice of the browser WebSocket this adapter uses (a fake implements it in tests). */
export interface SocketLike {
  onopen: ((event: Event) => void) | null;
  onmessage: ((event: MessageEvent) => void) | null;
  onclose: ((event: CloseEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  send(data: string): void;
  close(): void;
}

export interface HttpClientOptions {
  fetch?: typeof fetch;
  /** Prefix for `/api/...`; empty = same origin. */
  baseUrl?: string;
  /** Full WS URL, e.g. `ws://r-101.local/ws`. */
  wsUrl: string;
  createSocket?: (url: string) => SocketLike;
}

/** `ws(s)://<host>/ws` for the page's own origin. */
export function sameOriginWsUrl(location: Pick<Location, "protocol" | "host">): string {
  return `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`;
}

const sendJson = (method: "POST" | "PUT" | "PATCH", body: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

/** Request bodies are checked against the contract before anything is sent (CLAUDE.md: zod at every boundary). */
function checked<S extends z.ZodType>(schema: S, value: unknown): z.infer<S> {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new ApiRequestError("validation", parsed.error.issues[0]?.message ?? "Invalid request", null);
  return parsed.data;
}

export function createHttpApiClient(options: HttpClientOptions): ApiClient {
  const doFetch = options.fetch ?? globalThis.fetch.bind(globalThis);
  const baseUrl = options.baseUrl ?? "";
  const createSocket = options.createSocket ?? ((url: string): SocketLike => new WebSocket(url));

  async function fetchJson(path: string, init?: RequestInit): Promise<{ response: Response; body: unknown }> {
    let response: Response;
    try {
      response = await doFetch(`${baseUrl}${path}`, { credentials: "same-origin", ...init });
    } catch {
      throw new ApiRequestError("network", "Can't reach the controller", null);
    }
    const body: unknown = await response.json().catch(() => null);
    return { response, body };
  }

  function fail(response: Response, body: unknown): never {
    const error = ApiError.safeParse(body);
    if (error.success) throw new ApiRequestError(error.data.code, error.data.message, response.status);
    throw new ApiRequestError("bad_response", `HTTP ${response.status}`, response.status);
  }

  function parse<S extends z.ZodType>(schema: S, path: string, response: Response, body: unknown): z.infer<S> {
    const parsed = schema.safeParse(body);
    if (!parsed.success) throw new ApiRequestError("bad_response", `Unexpected response from ${path}`, response.status);
    return parsed.data;
  }

  async function request<S extends z.ZodType>(schema: S, path: string, init?: RequestInit): Promise<z.infer<S>> {
    const { response, body } = await fetchJson(path, init);
    if (!response.ok) fail(response, body);
    return parse(schema, path, response, body);
  }

  const postJson = (body: unknown): RequestInit => sendJson("POST", body);

  /** A 2xx with no body we need (202 / 204). */
  async function requestVoid(path: string, init: RequestInit): Promise<void> {
    const { response, body } = await fetchJson(path, init);
    if (!response.ok) fail(response, body);
  }

  const id = (value: string): string => encodeURIComponent(value);

  return {
    getSession: () => request(GetSessionResponse, "/api/session"),
    async login(loginRequest) {
      const checked = LoginRequest.safeParse(loginRequest);
      if (!checked.success) throw new ApiRequestError("validation", "The PIN has the wrong number of digits", null);
      const path = "/api/session/login";
      const { response, body } = await fetchJson(path, postJson(checked.data));
      // A wrong or locked PIN is an answer, not a failure: a PinError body counts with any status.
      const pinError = PinError.safeParse(body);
      if (pinError.success) return pinError.data;
      if (!response.ok) fail(response, body);
      return parse(GetSessionResponse, path, response, body);
    },
    lock: () => request(LockResponse, "/api/session/lock", postJson({})),
    getState: () => request(GetStateResponse, "/api/state"),
    sendCommand: async (commandRequest) =>
      request(PostCommandResponse, "/api/commands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(CommandRequest.parse(commandRequest)),
      }),
    ir: {
      listDevices: () => request(IrDeviceList, "/api/ir/devices"),
      createDevice: async (input) => request(IrDevice, "/api/ir/devices", postJson(checked(IrDeviceCreate, input))),
      createCommand: async (deviceId, input) =>
        request(IrCommand, `/api/ir/devices/${id(deviceId)}/commands`, postJson(checked(IrCommandCreate, input))),
      learn: (commandId) => requestVoid(`/api/ir/commands/${id(commandId)}/learn`, postJson({})),
      cancelLearn: (commandId) => requestVoid(`/api/ir/commands/${id(commandId)}/learn/cancel`, postJson({})),
      test: (commandId) => requestVoid(`/api/ir/commands/${id(commandId)}/test`, postJson({})),
      recordTest: async (commandId, reacted) =>
        request(IrCommand, `/api/ir/commands/${id(commandId)}/test-result`, postJson(checked(IrTestResultRequest, { reacted }))),
    },
    schedule: {
      get: () => request(GetScheduleResponse, "/api/schedule"),
      createBlock: async (input) => request(ClassBlock, "/api/schedule/blocks", postJson(checked(ClassBlockInput, input))),
      deleteBlock: (blockId) => requestVoid(`/api/schedule/blocks/${id(blockId)}`, { method: "DELETE" }),
      createAction: async (input) => request(TimedAction, "/api/schedule/actions", postJson(checked(TimedActionInput, input))),
      updateAction: async (actionId, input) =>
        request(TimedAction, `/api/schedule/actions/${id(actionId)}`, sendJson("PUT", checked(TimedActionInput, input))),
      deleteAction: (actionId) => requestVoid(`/api/schedule/actions/${id(actionId)}`, { method: "DELETE" }),
    },
    devices: {
      list: () => request(DeviceList, "/api/devices"),
      update: async (deviceId, patch) => request(Device, `/api/devices/${id(deviceId)}`, sendJson("PATCH", checked(DevicePatch, patch))),
      remove: (deviceId) => requestVoid(`/api/devices/${id(deviceId)}`, { method: "DELETE" }),
      permitJoin: async () => requestVoid("/api/zigbee/permit-join", postJson(checked(PermitJoinRequest, { seconds: 240 }))),
    },
    settings: {
      setRoomPin: async (pin) => requestVoid("/api/settings/pins/room", sendJson("PUT", checked(RoomPinRequest, { pin }))),
      setTechnicianPin: async (pin) =>
        requestVoid("/api/settings/pins/technician", sendJson("PUT", checked(TechnicianPinRequest, { pin }))),
    },
    system: {
      network: () => request(GetNetworkResponse, "/api/system/network"),
      about: () => request(GetAboutResponse, "/api/system/about"),
      restart: () => requestVoid("/api/system/restart", postJson({})),
    },
    connect(label, handlers): RealtimeConnection {
      const socket = createSocket(options.wsUrl);
      let closed = false;
      const send = (message: ClientMessage): void => socket.send(JSON.stringify(ClientMessage.parse(message)));
      const finish = (): void => {
        if (closed) return;
        closed = true;
        handlers.onClose();
      };
      socket.onopen = () => {
        send({ type: "hello", label });
        handlers.onOpen();
      };
      socket.onmessage = (message) => {
        let raw: unknown;
        try {
          raw = JSON.parse(String(message.data));
        } catch {
          console.warn("ws: dropped a non-JSON frame");
          return;
        }
        const parsed = ServerEvent.safeParse(raw);
        if (!parsed.success) {
          console.warn("ws: dropped an invalid frame", parsed.error.issues);
          return;
        }
        if (parsed.data.type === "ping") send({ type: "pong" });
        handlers.onEvent(parsed.data);
      };
      socket.onclose = finish;
      socket.onerror = finish;
      return {
        close() {
          closed = true; // a deliberate close is not reported as a drop
          socket.close();
        },
      };
    },
  };
}
