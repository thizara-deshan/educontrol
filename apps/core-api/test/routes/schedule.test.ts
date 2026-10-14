import { describe, expect, it } from "vitest";
import { call, openSocket, sessionAt, startApp } from "./app-helpers.ts";

const LIGHTS_OFF = { name: "Lights off", time: "18:00", days: ["mon", "fri"], enabled: true, steps: [{ kind: "lights.set", gang: "rear", on: false }] };

describe("schedule routes (S3c)", () => {
  it("creates, edits and removes blocks and actions; every write invalidates ['schedule']", async () => {
    const { app } = await startApp();
    const cookie = await sessionAt(app, "technician");
    const socket = await openSocket(app, { cookie });
    expect((await call(app, "GET", "/api/schedule", { cookie })).json()).toEqual({ class_blocks: [], actions: [] });

    const block = await call(app, "POST", "/api/schedule/blocks", { cookie, payload: { days: ["mon"], start: "08:00", end: "10:00" } });
    expect([block.statusCode, block.json()]).toEqual([201, { id: expect.any(String), days: ["mon"], start: "08:00", end: "10:00" }]);
    expect(await socket.next("invalidate")).toEqual({ type: "invalidate", keys: [["schedule"]] });
    const action = await call(app, "POST", "/api/schedule/actions", { cookie, payload: LIGHTS_OFF });
    expect(action.statusCode).toBe(201);
    const actionId: string = action.json().id;
    const off = await call(app, "PUT", `/api/schedule/actions/${actionId}`, { cookie, payload: { ...LIGHTS_OFF, enabled: false } });
    expect(off.json()).toEqual({ id: actionId, ...LIGHTS_OFF, enabled: false });
    expect((await call(app, "GET", "/api/schedule", { cookie })).json().actions).toEqual([{ id: actionId, ...LIGHTS_OFF, enabled: false }]);

    expect((await call(app, "DELETE", `/api/schedule/blocks/${block.json().id}`, { cookie })).statusCode).toBe(204);
    expect((await call(app, "DELETE", `/api/schedule/actions/${actionId}`, { cookie })).statusCode).toBe(204);
    expect((await call(app, "DELETE", `/api/schedule/actions/${actionId}`, { cookie })).json()).toEqual({ code: "not_found", message: "Not found" });
    expect(socket.frames.filter((f) => f.type === "invalidate")).toHaveLength(5);
    socket.ws.terminate();
    await app.close();
  });

  it("validates the contract: end after start, at least one day and one step", async () => {
    const { app } = await startApp();
    const cookie = await sessionAt(app, "technician");
    const backwards = await call(app, "POST", "/api/schedule/blocks", { cookie, payload: { days: ["mon"], start: "10:00", end: "08:00" } });
    expect([backwards.statusCode, backwards.json()]).toEqual([400, { code: "validation", message: "end: end must be after start" }]);
    const noSteps = await call(app, "POST", "/api/schedule/actions", { cookie, payload: { ...LIGHTS_OFF, steps: [] } });
    expect(noSteps.statusCode).toBe(400);
    await app.close();
  });
});
