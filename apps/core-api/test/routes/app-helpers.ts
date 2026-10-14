import { ServerEvent } from "@eduscope/contracts";
import type { FastifyInstance, LightMyRequestResponse } from "fastify";
import type { WebSocket } from "ws";
import { buildApp } from "../../src/app.ts";
import { fixedClock, type FixedClock } from "../../src/clock.ts";
import type { Config } from "../../src/config.ts";
import { fakeHw, snapshotEvent, T0, testConfig, type FakeHw } from "../helpers.ts";

export const HOST = "r-101.local";
export const ORIGIN = `http://${HOST}`;
/** A phone on the room Wi-Fi (not loopback). */
export const PHONE_IP = "192.168.1.50";

export interface TestApp {
  app: FastifyInstance;
  clock: FixedClock;
  hw: FakeHw;
}

/** buildApp with `:memory:`, a fake hw client, a fixed clock; hw reported up (fixture snapshot) unless `hwUp: false`. */
export async function startApp(overrides: Partial<Record<keyof Config, string>> = {}, options: { hwUp?: boolean } = {}): Promise<TestApp> {
  const clock = fixedClock(T0);
  const hw = fakeHw();
  const app = await buildApp({ db: ":memory:", hw, clock, config: testConfig(overrides) });
  await app.ready();
  if (options.hwUp !== false) app.room.ingest.handle(snapshotEvent());
  return { app, clock, hw };
}

export interface Call {
  cookie?: string | null;
  payload?: unknown;
  origin?: string | null;
  contentType?: string;
  remoteAddress?: string;
}

export type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

/** A browser request: JSON body for POST/PUT/PATCH; DELETE has no body and no content type (like the kiosk). */
export function call(app: FastifyInstance, method: Method, url: string, options: Call = {}): Promise<LightMyRequestResponse> {
  const headers: Record<string, string> = { host: HOST };
  const hasBody = method === "POST" || method === "PUT" || method === "PATCH";
  if (options.origin !== null) headers.origin = options.origin ?? ORIGIN;
  if (options.cookie) headers.cookie = `ec_sid=${options.cookie}`;
  if (hasBody) headers["content-type"] = options.contentType ?? "application/json";
  return app.inject({
    method, url, headers, remoteAddress: options.remoteAddress ?? PHONE_IP,
    ...(hasBody ? { payload: JSON.stringify(options.payload ?? {}) } : {}),
  });
}

/** The signed `ec_sid` value a response set, if any. */
export function cookieOf(response: LightMyRequestResponse): string | null {
  return response.cookies.find((c) => c.name === "ec_sid")?.value ?? null;
}

/** A browser session at the given level (control: room PIN, technician: technician PIN). */
export async function sessionAt(app: FastifyInstance, level: "view" | "control" | "technician", remoteAddress = PHONE_IP): Promise<string> {
  const cookie = cookieOf(await call(app, "GET", "/api/session", { remoteAddress }));
  if (cookie === null) throw new Error("no cookie");
  if (level === "view") return cookie;
  const pin = level === "control" ? "1234" : "123456";
  const response = await call(app, "POST", "/api/session/login", { cookie, remoteAddress, payload: { level, pin, label: "phone" } });
  if (response.statusCode !== 200) throw new Error(`login failed: ${response.body}`);
  return cookie;
}

let seq = 0;
export const commandBody = (body: unknown): { client_cmd_id: string; body: unknown } => ({
  client_cmd_id: `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`,
  body,
});

const isType =
  <T extends ServerEvent["type"]>(type: T) =>
  (frame: ServerEvent): frame is Extract<ServerEvent, { type: T }> =>
    frame.type === type;

export interface TestSocket {
  ws: WebSocket;
  frames: ServerEvent[];
  /** Resolves with the next frame of `type` (already received ones count). */
  next<T extends ServerEvent["type"]>(type: T, after?: number): Promise<Extract<ServerEvent, { type: T }>>;
}

export async function openSocket(app: FastifyInstance, options: { cookie?: string | null; origin?: string } = {}): Promise<TestSocket> {
  const frames: ServerEvent[] = [];
  const headers: Record<string, string> = { host: HOST, origin: options.origin ?? ORIGIN };
  if (options.cookie) headers.cookie = `ec_sid=${options.cookie}`;
  const ws = await app.injectWS("/ws", { headers }, {
    onInit: (socket) => socket.on("message", (data) => frames.push(ServerEvent.parse(JSON.parse(String(data))))),
  });
  return {
    ws,
    frames,
    async next(type, after = 0) {
      for (let i = 0; i < 100; i += 1) {
        const found = frames.slice(after).find(isType(type));
        if (found !== undefined) return found;
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      throw new Error(`no ${type} frame`);
    },
  };
}
