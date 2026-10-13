import { ClientMessage, type ClientLabel, type ConnectedClient, type ServerEvent } from "@eduscope/contracts";
import websocket from "@fastify/websocket";
import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import type { WebSocket } from "ws";
import type { SessionService } from "../auth/sessions.ts";
import type { StateStore } from "../domain/state-store.ts";

// ARCHITECTURE §6.6 WS hub: snapshot on connect, `state` + command/activity to all, `session` only
// to that session's sockets, ping every 10 s (2 missed pongs ⇒ terminate). Receive-only (D-03):
// inbound frames other than hello/pong are dropped, > 4 KB closes the socket. Never IR codes or PINs.

export const PING_MS = 10_000;
export const MAX_FRAME_BYTES = 4096;
const MAX_MISSED_PONGS = 2;

interface HubClient {
  socket: WebSocket;
  publicId: string | null;
  label: ClientLabel;
  info: Omit<ConnectedClient, "label" | "public_id">;
  missedPongs: number;
}

export interface Hub {
  add(client: HubClient): void;
  remove(client: HubClient): void;
  broadcast(event: ServerEvent): void;
  sendToSession(publicId: string, event: ServerEvent): void;
  /** S3b connected clients (used by M09's network route). */
  clients(): ConnectedClient[];
  /** One ping round: terminate silent sockets, ping the rest. */
  ping(): void;
  size(): number;
}

export function createHub(): Hub {
  const clients = new Set<HubClient>();
  const send = (client: HubClient, event: ServerEvent): void => {
    if (client.socket.readyState === client.socket.OPEN) client.socket.send(JSON.stringify(event));
  };
  return {
    add: (client) => clients.add(client),
    remove: (client) => clients.delete(client),
    broadcast(event) {
      for (const client of clients) send(client, event);
    },
    sendToSession(publicId, event) {
      for (const client of clients) if (client.publicId === publicId) send(client, event);
    },
    clients: () => [...clients].map((client) => ({ public_id: client.publicId, label: client.label, ...client.info })),
    ping() {
      for (const client of clients) {
        if (client.missedPongs >= MAX_MISSED_PONGS) {
          client.socket.terminate();
          clients.delete(client);
          continue;
        }
        client.missedPongs += 1;
        send(client, { type: "ping" });
      }
    },
    size: () => clients.size,
  };
}

export const realtimePlugin = fp(async (app: FastifyInstance, options: { hub: Hub; store: StateStore; sessions: SessionService }) => {
  const { hub, store, sessions } = options;
  await app.register(websocket, { options: { maxPayload: MAX_FRAME_BYTES } });

  app.get("/ws", { websocket: true }, (socket, request) => {
    const resolved = request.client;
    const client: HubClient = {
      socket,
      publicId: resolved.row?.public_id ?? null,
      label: resolved.label,
      info: { client_type: resolved.clientType, access: resolved.access },
      missedPongs: 0,
    };
    hub.add(client);
    socket.send(JSON.stringify({ type: "snapshot", state: store.get() } satisfies ServerEvent));

    socket.on("message", (data, isBinary) => {
      if (isBinary) return;
      let raw: unknown;
      try {
        raw = JSON.parse(String(data));
      } catch {
        return;
      }
      const message = ClientMessage.safeParse(raw);
      if (!message.success) return;
      client.missedPongs = 0;
      if (message.data.type === "hello" && resolved.clientType === "remote") {
        client.label = message.data.label;
        if (client.publicId !== null) sessions.setLabel(client.publicId, message.data.label);
      }
    });
    socket.on("close", () => hub.remove(client));
  });
});
