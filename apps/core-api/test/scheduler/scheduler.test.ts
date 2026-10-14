import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createEventLogger } from "../../src/db/event-log.ts";
import { eventLog } from "../../src/db/schema.ts";
import { readSetting } from "../../src/db/settings.ts";
import { hwEvent } from "../helpers.ts";
import { call, openSocket, sessionAt, startApp } from "../routes/app-helpers.ts";

// T0 = Mon 2026-10-05 10:42:00 UTC; tests run with TZ=UTC, so "10:44" is two minutes later.

const LIGHTS_OFF = {
  name: "Lights off", time: "10:44", days: ["mon"], enabled: true,
  steps: [{ kind: "lights.set", gang: "front", on: false }, { kind: "lights.set", gang: "rear", on: false }],
};

async function room() {
  const started = await startApp();
  const tech = await sessionAt(started.app, "technician", "192.168.1.90");
  const add = (url: string, payload: unknown) => call(started.app, "POST", url, { cookie: tech, remoteAddress: "192.168.1.90", payload });
  // like the hw fake: every lights command is echoed back as a report
  started.hw.onCall = (method, body) => {
    const parsed = z.object({ gang: z.enum(["front", "rear"]), on: z.boolean() }).safeParse(body);
    if (method === "lightsSet" && parsed.success) started.app.room.ingest.handle(hwEvent("lights.state", parsed.data, started.clock.now().toISOString()));
  };
  return { ...started, add };
}

describe("scheduler (§6.8)", () => {
  it("AC5: a timed action fires at its minute, every client gets '… · by schedule', lights turn off", async () => {
    const { app, clock, hw, add } = await room();
    app.room.ingest.handle(hwEvent("lights.state", { gang: "front", on: true }));
    expect((await add("/api/schedule/actions", LIGHTS_OFF)).statusCode).toBe(201);
    const viewer = await openSocket(app);
    await viewer.next("snapshot");
    clock.set("2026-10-05T10:43:50.000Z");
    app.room.scheduler.tick();
    expect(hw.calls.filter((c) => c.method === "lightsSet")).toHaveLength(0);
    clock.set("2026-10-05T10:44:20.000Z");
    app.room.scheduler.tick();
    expect(hw.calls.filter((c) => c.method === "lightsSet").map((c) => c.body)).toEqual([{ gang: "front", on: false }, { gang: "rear", on: false }]);
    await expect.poll(() => viewer.frames.filter((f) => f.type === "activity").map((f) => (f.type === "activity" ? `${f.text} · ${f.by}` : ""))).toContain(
      "Front of room turned off · schedule",
    );
    expect(app.room.store.get().environment.lights.front).toMatchObject({ value: false, changed_by: "schedule" });
    clock.set("2026-10-05T10:44:50.000Z");
    app.room.scheduler.tick(); // same minute again: not twice
    expect(hw.calls.filter((c) => c.method === "lightsSet")).toHaveLength(2);
    viewer.ws.terminate();
    await app.close();
  });

  it("a disabled action or another weekday does nothing; a refused step does not stop the rest", async () => {
    const { app, clock, hw, add } = await room();
    await add("/api/schedule/actions", { ...LIGHTS_OFF, enabled: false });
    await add("/api/schedule/actions", { ...LIGHTS_OFF, days: ["tue"] });
    await add("/api/schedule/actions", { ...LIGHTS_OFF, name: "AC up", steps: [{ kind: "ac.step", direction: "up" }, { kind: "lights.set", gang: "rear", on: false }] });
    clock.set("2026-10-05T10:44:10.000Z");
    app.room.scheduler.tick();
    expect(hw.calls.filter((c) => c.method === "lightsSet").map((c) => c.body)).toEqual([{ gang: "rear", on: false }]);
    const refused = app.room.db.select().from(eventLog).all().find((row) => row.subject === "ac.step");
    expect(refused).toMatchObject({ actor: "schedule", result: "refused: Turn the air conditioning on first" });
    await app.close();
  });

  it("AC6: at a class block's end remote control sessions drop to view and are told; technician stays", async () => {
    const { app, clock, add } = await room();
    await add("/api/schedule/blocks", { days: ["mon"], start: "09:00", end: "10:44" });
    const phone = await sessionAt(app, "control");
    const socket = await openSocket(app, { cookie: phone });
    await socket.next("snapshot");
    clock.set("2026-10-05T10:43:40.000Z");
    app.room.scheduler.tick();
    expect((await call(app, "GET", "/api/session", { cookie: phone })).json()).toMatchObject({ access: "control" });
    clock.set("2026-10-05T10:44:10.000Z");
    app.room.scheduler.tick();
    await expect.poll(() => socket.frames.filter((f) => f.type === "session").at(-1)).toMatchObject({ session: { access: "view" } });
    expect(app.room.sessions.endAccess("technician", null, "check")).toBe(1); // the technician was not ended by the block
    socket.ws.terminate();
    await app.close();
  });

  it("midnight: kWh today restarts at 0 and the baseline is saved", async () => {
    const { app, clock } = await room();
    app.room.ingest.handle(hwEvent("projector_power.reading", { watts: 287, volts: 230, energy_kwh_total: 414.51 }));
    expect(readSetting(app.room.db, "kwh_baseline", z.object({ date: z.string(), kwh_total: z.number() }))?.date).toBe("2026-10-05");
    clock.set("2026-10-06T00:00:10.000Z");
    app.room.scheduler.tick();
    expect(app.room.store.get().display.projector.power.value?.kwh_today).toBe(0);
    expect(readSetting(app.room.db, "kwh_baseline", z.object({ date: z.string(), kwh_total: z.number() }))).toEqual({ date: "2026-10-06", kwh_total: 414.51 });
    await app.close();
  });

  it("prunes event-log rows older than 30 days once a day", async () => {
    const { app } = await room();
    createEventLogger(app.room.db, { now: () => new Date("2026-08-01T00:00:00.000Z") })({ type: "system", subject: "ancient" });
    app.room.scheduler.tick();
    expect(app.room.db.select().from(eventLog).all().map((row) => row.subject)).not.toContain("ancient");
    await app.close();
  });
});
