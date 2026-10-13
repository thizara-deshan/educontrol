import { describe, expect, it } from "vitest";
import { call, startApp } from "./app-helpers.ts";

const ROOM_PIN = { level: "control", pin: "1234", label: "phone" };

describe("origin check (CSRF, §5)", () => {
  it("missing or foreign Origin → 403 on every mutation, public ones included", async () => {
    const { app } = await startApp();
    const missing = await call(app, "POST", "/api/session/login", { origin: null, payload: ROOM_PIN });
    expect([missing.statusCode, missing.json()]).toEqual([403, { code: "forbidden", message: "Cross-origin request refused" }]);
    expect((await call(app, "POST", "/api/session/login", { origin: "http://evil.example", payload: ROOM_PIN })).statusCode).toBe(403);
    expect((await call(app, "POST", "/api/session/lock", { origin: "http://r-101.local:8080" })).statusCode).toBe(403); // port is part of the host
    await app.close();
  });

  it("a non-JSON body → 415; same origin + JSON passes; GETs are never checked", async () => {
    const { app } = await startApp();
    const text = await call(app, "POST", "/api/session/login", { contentType: "text/plain", payload: ROOM_PIN });
    expect([text.statusCode, text.json()]).toEqual([415, { code: "validation", message: "Content-Type must be application/json" }]);
    expect((await call(app, "POST", "/api/session/login", { payload: ROOM_PIN })).statusCode).toBe(200);
    expect((await call(app, "GET", "/api/state", { origin: "http://evil.example" })).statusCode).toBe(200);
    await app.close();
  });
});
