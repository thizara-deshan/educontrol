import { describe, expect, it } from "vitest";
import { call, sessionAt, startApp, type Method } from "./app-helpers.ts";

// AC10/AC11: every M09 route, GETs included, is technician-only. Bodies are valid so the guard,
// not validation, decides; ids are unknown so a passing guard never changes anything.

const ROUTES: readonly [Method, string, unknown?][] = [
  ["GET", "/api/ir/devices"],
  ["POST", "/api/ir/devices", { name: "Fan", brand: "Acme", kind: "other", transport: "ir_mcu" }],
  ["PATCH", "/api/ir/devices/nope", { name: "Fan" }],
  ["POST", "/api/ir/devices/nope/commands", { name: "On", role: "other", setpoint: null }],
  ["DELETE", "/api/ir/commands/nope"],
  ["POST", "/api/ir/commands/nope/learn", {}],
  ["POST", "/api/ir/commands/nope/learn/cancel", {}],
  ["POST", "/api/ir/commands/nope/test", {}],
  ["POST", "/api/ir/commands/nope/test-result", { reacted: true }],
  ["GET", "/api/schedule"],
  ["POST", "/api/schedule/blocks", { days: ["mon"], start: "08:00", end: "10:00" }],
  ["PUT", "/api/schedule/blocks/nope", { days: ["mon"], start: "08:00", end: "10:00" }],
  ["DELETE", "/api/schedule/blocks/nope"],
  ["POST", "/api/schedule/actions", { name: "All off", time: "18:00", days: ["fri"], enabled: true, steps: [{ kind: "ac.power", on: false }] }],
  ["PUT", "/api/schedule/actions/nope", { name: "All off", time: "18:00", days: ["fri"], enabled: true, steps: [{ kind: "ac.power", on: false }] }],
  ["DELETE", "/api/schedule/actions/nope"],
  ["GET", "/api/devices"],
  ["PATCH", "/api/devices/nope", { name: "x" }],
  ["DELETE", "/api/devices/nope"],
  ["POST", "/api/zigbee/permit-join", { seconds: 240 }],
];

describe("M09 routes need technician", () => {
  it.each(ROUTES)("%s %s: no session 401, control 403, technician passes the guard", async (method, url, payload) => {
    const { app } = await startApp();
    expect((await call(app, method, url, { payload })).json()).toEqual({ code: "unauthorized", message: "Enter the room PIN" });
    const view = await sessionAt(app, "view");
    expect((await call(app, method, url, { payload, cookie: view })).statusCode).toBe(401);
    const control = await sessionAt(app, "control", "192.168.1.51");
    const refused = await call(app, method, url, { payload, cookie: control, remoteAddress: "192.168.1.51" });
    expect([refused.statusCode, refused.json()]).toEqual([403, { code: "forbidden", message: "Technician PIN required" }]);
    const tech = await sessionAt(app, "technician", "192.168.1.52");
    const passed = await call(app, method, url, { payload, cookie: tech, remoteAddress: "192.168.1.52" });
    expect([401, 403]).not.toContain(passed.statusCode);
    await app.close();
  });
});
