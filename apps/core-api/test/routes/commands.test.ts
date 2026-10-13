import { describe, expect, it } from "vitest";
import { call, commandBody, PHONE_IP, sessionAt, startApp } from "./app-helpers.ts";

const LIGHTS = { kind: "lights.set", gang: "rear", on: true };

describe("POST /api/commands by level", () => {
  it("no cookie → 401; view → 401; control → 202; technician kind as control → 403", async () => {
    const { app } = await startApp();
    expect((await call(app, "POST", "/api/commands", { payload: commandBody(LIGHTS) })).statusCode).toBe(401);
    const view = await sessionAt(app, "view");
    const viewed = await call(app, "POST", "/api/commands", { cookie: view, payload: commandBody(LIGHTS) });
    expect([viewed.statusCode, viewed.json()]).toEqual([401, { code: "unauthorized", message: "Enter the room PIN" }]);
    const control = await sessionAt(app, "control");
    const accepted = await call(app, "POST", "/api/commands", { cookie: control, payload: commandBody(LIGHTS) });
    expect(accepted.statusCode).toBe(202);
    expect(accepted.json()).toMatchObject({ status: "pending", issued_by: { label: "phone" }, body: LIGHTS });
    const mains = await call(app, "POST", "/api/commands", { cookie: control, payload: commandBody({ kind: "projector.mains", on: false }) });
    expect([mains.statusCode, mains.json()]).toEqual([403, { code: "forbidden", message: "Technician PIN required" }]);
    const tech = await sessionAt(app, "technician");
    const held = await call(app, "POST", "/api/commands", { cookie: tech, payload: commandBody({ kind: "projector.mains", on: false }) });
    expect(held.statusCode).toBe(409); // allowed, but the interlock holds (R11)
    await app.close();
  });

  it("a foreign Origin is refused before the session is even looked at", async () => {
    const { app } = await startApp();
    const control = await sessionAt(app, "control");
    const foreign = await call(app, "POST", "/api/commands", { cookie: control, origin: "http://evil.example", payload: commandBody(LIGHTS) });
    expect(foreign.statusCode).toBe(403);
    await app.close();
  });

  it("an invalid body is a 400 validation ApiError", async () => {
    const { app } = await startApp();
    const control = await sessionAt(app, "control");
    const response = await call(app, "POST", "/api/commands", { cookie: control, payload: commandBody({ kind: "lights.set", gang: "middle", on: true }) });
    expect([response.statusCode, response.json().code]).toEqual([400, "validation"]);
    await app.close();
  });

  it("hw down → 503 hw_unavailable", async () => {
    const { app } = await startApp();
    const control = await sessionAt(app, "control");
    app.room.ingest.down();
    const response = await call(app, "POST", "/api/commands", { cookie: control, payload: commandBody(LIGHTS) });
    expect([response.statusCode, response.json()]).toEqual([503, { code: "hw_unavailable", message: "Hardware service offline" }]);
    await app.close();
  });

  it("control ends after 2 h idle; a command resets the idle timer", async () => {
    const { app, clock } = await startApp();
    const cookie = await sessionAt(app, "control");
    clock.advance(90 * 60_000);
    expect((await call(app, "POST", "/api/commands", { cookie, payload: commandBody(LIGHTS) })).statusCode).toBe(202);
    clock.advance(90 * 60_000); // 3 h after login, 1.5 h after the command
    expect((await call(app, "GET", "/api/session", { cookie })).json()).toMatchObject({ access: "control" });
    clock.advance(31 * 60_000);
    expect((await call(app, "GET", "/api/session", { cookie })).json()).toMatchObject({ access: "view", expires_at: null });
    await app.close();
  });

  it("kiosk (loopback, flag on) commands without a PIN; with the flag off loopback is refused", async () => {
    const kiosk = await startApp({ LOCALHOST_IS_KIOSK: "true" });
    expect((await call(kiosk.app, "POST", "/api/commands", { remoteAddress: "127.0.0.1", payload: commandBody(LIGHTS) })).statusCode).toBe(202);
    expect((await call(kiosk.app, "POST", "/api/commands", { remoteAddress: PHONE_IP, payload: commandBody(LIGHTS) })).statusCode).toBe(401);
    await kiosk.app.close();
    const dev = await startApp({ LOCALHOST_IS_KIOSK: "false" });
    expect((await call(dev.app, "POST", "/api/commands", { remoteAddress: "127.0.0.1", payload: commandBody(LIGHTS) })).statusCode).toBe(401);
    await dev.app.close();
  });
});
