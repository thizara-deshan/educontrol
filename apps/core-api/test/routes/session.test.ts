import { describe, expect, it } from "vitest";
import { buildApp } from "../../src/app.ts";
import { fixedClock } from "../../src/clock.ts";
import { assertRouteAccess } from "../../src/plugins/auth.ts";
import { fakeHw, T0, testConfig } from "../helpers.ts";
import { call, cookieOf, PHONE_IP, sessionAt, startApp } from "./app-helpers.ts";

const ROOM_PIN = { level: "control", pin: "1234", label: "phone" };

describe("startup guard (§5)", () => {
  it("a mutating route without config.access is refused", () => {
    expect(() => assertRouteAccess({ method: "POST", url: "/api/x" })).toThrow("Route POST /api/x must declare config.access");
    expect(() => assertRouteAccess({ method: "DELETE", url: "/api/x", config: { access: "technician" } })).not.toThrow();
    expect(() => assertRouteAccess({ method: "POST", url: "/api/session/lock", config: { public: true } })).not.toThrow();
    expect(() => assertRouteAccess({ method: ["GET", "HEAD"], url: "/api/state" })).not.toThrow();
  });
  it("the app refuses such a route the moment it is added", async () => {
    const app = await buildApp({ db: ":memory:", hw: fakeHw(), clock: fixedClock(T0), config: testConfig() });
    expect(() => app.post("/api/naked", async () => ({}))).toThrow("Route POST /api/naked must declare config.access");
    expect(() => app.post("/api/guarded", { config: { access: "control" } }, async () => ({}))).not.toThrow();
    await app.close();
  });
});

describe("GET /api/session", () => {
  it("issues a view session and an HttpOnly, SameSite=Strict, signed cookie on the first visit", async () => {
    const { app } = await startApp();
    const first = await call(app, "GET", "/api/session");
    expect(first.json()).toMatchObject({ client_type: "remote", label: "laptop", access: "view", expires_at: null });
    const cookie = first.cookies.find((c) => c.name === "ec_sid");
    expect(cookie).toMatchObject({ httpOnly: true, sameSite: "Strict", path: "/" });
    const again = await call(app, "GET", "/api/session", { cookie: cookie?.value ?? null });
    expect(again.json().public_id).toBe(first.json().public_id);
    expect(cookieOf(again)).toBeNull();
    await app.close();
  });
});

describe("PIN login, throttle, lock", () => {
  it("room PIN → control session with a 2 h expiry; lock → view in place", async () => {
    const { app } = await startApp();
    const first = await call(app, "POST", "/api/session/login", { payload: ROOM_PIN });
    expect(first.statusCode).toBe(200);
    expect(first.json()).toMatchObject({ client_type: "remote", label: "phone", access: "control", expires_at: "2026-10-05T12:42:00.000Z" });
    const cookie = cookieOf(first);
    const locked = await call(app, "POST", "/api/session/lock", { cookie });
    expect(locked.json()).toMatchObject({ access: "view", public_id: first.json().public_id, expires_at: null });
    expect((await call(app, "GET", "/api/session", { cookie })).json()).toMatchObject({ access: "view" });
    await app.close();
  });

  it("H17: 5 wrong → locked 60 s (429); the right PIN is refused while locked", async () => {
    const { app, clock } = await startApp();
    const wrong = { level: "control", pin: "0000", label: "phone" };
    const codes: number[] = [];
    for (let i = 0; i < 6; i += 1) codes.push((await call(app, "POST", "/api/session/login", { payload: wrong })).statusCode);
    expect(codes).toEqual([401, 401, 401, 401, 429, 429]);
    const right = await call(app, "POST", "/api/session/login", { payload: ROOM_PIN });
    expect([right.statusCode, right.json()]).toEqual([429, { reason: "locked", retry_after_s: 60, attempts_left: 0 }]);
    clock.advance(60_000);
    expect((await call(app, "POST", "/api/session/login", { payload: ROOM_PIN })).statusCode).toBe(200);
    await app.close();
  });

  it("a wrong PIN answers attempts_left; a PIN of the wrong length is a 400", async () => {
    const { app } = await startApp();
    const wrong = await call(app, "POST", "/api/session/login", { payload: { level: "technician", pin: "000000", label: "laptop" } });
    expect([wrong.statusCode, wrong.json()]).toEqual([401, { reason: "wrong", retry_after_s: null, attempts_left: 4 }]);
    const short = await call(app, "POST", "/api/session/login", { payload: { level: "control", pin: "12345", label: "phone" } });
    expect([short.statusCode, short.json().code]).toEqual([400, "validation"]);
    await app.close();
  });

  it("technician ends after 15 min idle; the 15 s sweep downgrades without a request", async () => {
    const { app, clock } = await startApp();
    const cookie = await sessionAt(app, "technician");
    clock.advance(15 * 60_000);
    app.room.sessions.sweep();
    expect((await call(app, "GET", "/api/session", { cookie })).json()).toMatchObject({ access: "view" });
    await app.close();
  });
});

describe("kiosk exemption (D-09)", () => {
  it("LOCALHOST_IS_KIOSK=true: loopback is kiosk/control without a PIN; LAN is view", async () => {
    const { app } = await startApp({ LOCALHOST_IS_KIOSK: "true" });
    const kiosk = await call(app, "GET", "/api/session", { remoteAddress: "127.0.0.1" });
    expect(kiosk.json()).toMatchObject({ client_type: "kiosk", label: "room screen", access: "control", expires_at: null });
    expect((await call(app, "GET", "/api/session", { remoteAddress: PHONE_IP })).json()).toMatchObject({ client_type: "remote", access: "view" });
    await app.close();
  });

  it("LOCALHOST_IS_KIOSK=false: loopback is an ordinary remote view client", async () => {
    const { app } = await startApp({ LOCALHOST_IS_KIOSK: "false" });
    expect((await call(app, "GET", "/api/session", { remoteAddress: "127.0.0.1" })).json()).toMatchObject({ client_type: "remote", access: "view" });
    await app.close();
  });

  it("a kiosk session cookie is refused from a LAN address; kiosk technician lasts 2 min; kiosk lock keeps control", async () => {
    const { app, clock } = await startApp({ LOCALHOST_IS_KIOSK: "true" });
    const cookie = await sessionAt(app, "technician", "127.0.0.1");
    expect((await call(app, "GET", "/api/session", { cookie, remoteAddress: "127.0.0.1" })).json()).toMatchObject({ client_type: "kiosk", access: "technician" });
    expect((await call(app, "GET", "/api/session", { cookie, remoteAddress: PHONE_IP })).json()).toMatchObject({ client_type: "remote", access: "view" });
    clock.advance(2 * 60_000);
    expect((await call(app, "GET", "/api/session", { cookie, remoteAddress: "127.0.0.1" })).json()).toMatchObject({ access: "control" });
    const locked = await call(app, "POST", "/api/session/lock", { cookie, remoteAddress: "127.0.0.1" });
    expect(locked.json()).toMatchObject({ client_type: "kiosk", access: "control" });
    await app.close();
  });
});
