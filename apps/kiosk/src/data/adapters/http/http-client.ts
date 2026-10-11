import {
  ApiError, ClientMessage, CommandRequest, GetSessionResponse, GetStateResponse,
  PostCommandResponse, ServerEvent,
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

export function createHttpApiClient(options: HttpClientOptions): ApiClient {
  const doFetch = options.fetch ?? globalThis.fetch.bind(globalThis);
  const baseUrl = options.baseUrl ?? "";
  const createSocket = options.createSocket ?? ((url: string): SocketLike => new WebSocket(url));

  async function request<S extends z.ZodType>(schema: S, path: string, init?: RequestInit): Promise<z.infer<S>> {
    let response: Response;
    try {
      response = await doFetch(`${baseUrl}${path}`, { credentials: "same-origin", ...init });
    } catch {
      throw new ApiRequestError("network", "Can't reach the controller", null);
    }
    const body: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const error = ApiError.safeParse(body);
      if (error.success) throw new ApiRequestError(error.data.code, error.data.message, response.status);
      throw new ApiRequestError("bad_response", `HTTP ${response.status}`, response.status);
    }
    const parsed = schema.safeParse(body);
    if (!parsed.success) throw new ApiRequestError("bad_response", `Unexpected response from ${path}`, response.status);
    return parsed.data;
  }

  return {
    getSession: () => request(GetSessionResponse, "/api/session"),
    getState: () => request(GetStateResponse, "/api/state"),
    sendCommand: async (commandRequest) =>
      request(PostCommandResponse, "/api/commands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(CommandRequest.parse(commandRequest)),
      }),
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
