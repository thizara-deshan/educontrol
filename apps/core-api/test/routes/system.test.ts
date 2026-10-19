import { describe, expect, it, vi } from "vitest";
import { buildApp } from "../../src/app.ts";
import { fixedClock } from "../../src/clock.ts";
import type { SystemProbe } from "../../src/system/info.ts";
import { fakeHw, snapshotEvent, T0, testConfig } from "../helpers.ts";
import { call, openSocket, sessionAt } from "./app-helpers.ts";

const PROBE: SystemProbe = {
  hostname: () => "r-101",
  interfaces: () => ({ eth0: [{ address: "192.168.1.20", family: "IPv4", internal: false }] }),
  wifi: async () => null,
  piModel: () => "Raspberry Pi 5 Model B Rev 1.0",
  version: () => "0.0.0",
};

async function start() {
  const clock = fixedClock(T0);
  const restart = vi.fn();
  const shutdown = vi.fn();
  const app = await buildApp({ db: ":memory:", hw: fakeHw(), clock, config: testConfig(), restart, shutdown, system: PROBE });
  await app.ready();
  app.room.ingest.handle(snapshotEvent());
  return { app, clock, restart, shutdown, cookie: await sessionAt(app, "technician") };
}

describe("system routes (S3b, S3e)", () => {
  it("network: hostname, address, connection, controller and the connected clients", async () => {
    const { app, cookie } = await start();
    const socket = await openSocket(app, { cookie });
    await socket.next("snapshot");
    expect((await call(app, "GET", "/api/system/network", { cookie })).json()).toEqual({
      hostname: "r-101.local", address: "192.168.1.20", connection: { kind: "ethernet" }, controller: { hw: "up" },
      clients: [{ public_id: expect.any(String), label: "phone", client_type: "remote", access: "technician" }],
    });
    socket.ws.terminate();
    await app.close();
  });

  it("about: room, version, uptime since boot, Pi model, URL from ROOM_HOSTNAME", async () => {
    const { app, clock } = await start();
    clock.advance(3_725_000);
    const cookie = await sessionAt(app, "technician", "192.168.1.60"); // the first one idled out meanwhile
    expect((await call(app, "GET", "/api/system/about", { cookie, remoteAddress: "192.168.1.60" })).json()).toEqual({
      room: "R-101", version: "0.0.0", uptime_s: 3725, pi_model: "Raspberry Pi 5 Model B Rev 1.0", url: "http://r-101.local",
    });
    await app.close();
  });

  it("restart answers 202 first, then restarts", async () => {
    const { app, restart, cookie } = await start();
    const response = await call(app, "POST", "/api/system/restart", { cookie });
    expect(response.statusCode).toBe(202);
    expect(restart).not.toHaveBeenCalled();
    await expect.poll(() => restart.mock.calls.length).toBe(1);
    await app.close();
  });

  it("shutdown (D-32) needs control: view is refused, control gets 202 first, then the Pi powers off", async () => {
    const { app, shutdown } = await start();
    const view = await sessionAt(app, "view", "192.168.1.61");
    expect((await call(app, "POST", "/api/system/shutdown", { payload: {}, cookie: view, remoteAddress: "192.168.1.61" })).statusCode).toBe(401);
    const control = await sessionAt(app, "control", "192.168.1.62");
    const response = await call(app, "POST", "/api/system/shutdown", { payload: {}, cookie: control, remoteAddress: "192.168.1.62" });
    expect(response.statusCode).toBe(202);
    expect(shutdown).not.toHaveBeenCalled();
    await expect.poll(() => shutdown.mock.calls.length).toBe(1);
    await app.close();
  });
});
