import { describe, expect, it } from "vitest";
import { eventLog } from "../../src/db/schema.ts";
import { call, cookieOf, openSocket, sessionAt, startApp } from "./app-helpers.ts";

const TECH_IP = "192.168.1.70";
const OTHER_IP = "192.168.1.71";

async function login(app: Parameters<typeof call>[0], level: "control" | "technician", pin: string, remoteAddress: string) {
  const cookie = cookieOf(await call(app, "GET", "/api/session", { remoteAddress }));
  const response = await call(app, "POST", "/api/session/login", { cookie, remoteAddress, payload: { level, pin, label: "phone" } });
  return { cookie, status: response.statusCode };
}

describe("PIN changes (S3d)", () => {
  it("room PIN: the old PIN fails, the new one works, other control sessions are locked and told", async () => {
    const { app } = await startApp();
    const tech = await sessionAt(app, "technician", TECH_IP);
    const phone = await sessionAt(app, "control", OTHER_IP);
    const phoneSocket = await openSocket(app, { cookie: phone });
    await phoneSocket.next("snapshot");
    const changed = await call(app, "PUT", "/api/settings/pins/room", { cookie: tech, remoteAddress: TECH_IP, payload: { pin: "4321" } });
    expect([changed.statusCode, changed.body]).toEqual([204, ""]);
    await expect.poll(() => phoneSocket.frames.filter((f) => f.type === "session").at(-1)).toMatchObject({ session: { access: "view" } });
    expect((await call(app, "GET", "/api/session", { cookie: phone, remoteAddress: OTHER_IP })).json()).toMatchObject({ access: "view" });
    expect((await login(app, "control", "1234", "192.168.1.72")).status).toBe(401);
    expect((await login(app, "control", "4321", "192.168.1.73")).status).toBe(200);
    expect((await call(app, "GET", "/api/session", { cookie: tech, remoteAddress: TECH_IP })).json()).toMatchObject({ access: "technician" });
    phoneSocket.ws.terminate();
    await app.close();
  });

  it("technician PIN: other technician sessions end, the one that changed it stays", async () => {
    const { app } = await startApp();
    const me = await sessionAt(app, "technician", TECH_IP);
    const other = await sessionAt(app, "technician", OTHER_IP);
    expect((await call(app, "PUT", "/api/settings/pins/technician", { cookie: me, remoteAddress: TECH_IP, payload: { pin: "654321" } })).statusCode).toBe(204);
    expect((await call(app, "GET", "/api/session", { cookie: other, remoteAddress: OTHER_IP })).json()).toMatchObject({ access: "view" });
    expect((await call(app, "GET", "/api/session", { cookie: me, remoteAddress: TECH_IP })).json()).toMatchObject({ access: "technician" });
    expect((await login(app, "technician", "123456", "192.168.1.74")).status).toBe(401);
    expect((await login(app, "technician", "654321", "192.168.1.75")).status).toBe(200);
    await app.close();
  });

  it("refuses the wrong length and never logs the PIN", async () => {
    const { app } = await startApp();
    const tech = await sessionAt(app, "technician");
    const bad = await call(app, "PUT", "/api/settings/pins/room", { cookie: tech, payload: { pin: "12345" } });
    expect([bad.statusCode, bad.json()]).toEqual([400, { code: "validation", message: "pin: Room PIN is 4 digits" }]);
    await call(app, "PUT", "/api/settings/pins/room", { cookie: tech, payload: { pin: "4321" } });
    const rows = app.room.db.select().from(eventLog).all();
    expect(JSON.stringify(rows)).not.toContain("4321");
    await app.close();
  });
});
