import type { FastifyInstance, LightMyRequestResponse } from "fastify";
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

export function call(app: FastifyInstance, method: "GET" | "POST", url: string, options: Call = {}): Promise<LightMyRequestResponse> {
  const headers: Record<string, string> = { host: HOST };
  if (options.origin !== null) headers.origin = options.origin ?? ORIGIN;
  if (options.cookie) headers.cookie = `ec_sid=${options.cookie}`;
  if (method === "POST") headers["content-type"] = options.contentType ?? "application/json";
  return app.inject({
    method, url, headers, remoteAddress: options.remoteAddress ?? PHONE_IP,
    ...(method === "POST" ? { payload: JSON.stringify(options.payload ?? {}) } : {}),
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
