import { describe, expect, it } from "vitest";
import { call, startApp } from "./app-helpers.ts";

describe("read routes", () => {
  it("GET /api/state and /api/health need no session", async () => {
    const { app } = await startApp();
    const state = await call(app, "GET", "/api/state");
    expect(state.statusCode).toBe(200);
    expect(state.json()).toMatchObject({ room: { id: "R-101", status: { level: "normal" } }, connection: { hw: "up" } });
    expect((await call(app, "GET", "/api/health")).json()).toEqual({ ok: true, hw: "up", rev: state.json().rev });
    await app.close();
  });

  it("before hw reports, health says hw down and the room is in fault", async () => {
    const { app } = await startApp({}, { hwUp: false });
    expect((await call(app, "GET", "/api/health")).json()).toEqual({ ok: true, hw: "down", rev: 0 });
    expect((await call(app, "GET", "/api/state")).json()).toMatchObject({ room: { status: { level: "fault", text: "Hardware service offline" } } });
    await app.close();
  });

  it("an unknown /api path is a 404 ApiError", async () => {
    const { app } = await startApp();
    const response = await call(app, "GET", "/api/nope");
    expect([response.statusCode, response.json()]).toEqual([404, { code: "not_found", message: "Not found" }]);
    await app.close();
  });
});
