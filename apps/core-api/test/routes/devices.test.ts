import type { IrDevice } from "@eduscope/contracts";
import { describe, expect, it } from "vitest";
import { hwEvent, T0 } from "../helpers.ts";
import { call, openSocket, sessionAt, startApp } from "./app-helpers.ts";

describe("device routes (S3d)", () => {
  it("lists the registry with live online state", async () => {
    const { app } = await startApp();
    const cookie = await sessionAt(app, "technician");
    const list = (await call(app, "GET", "/api/devices", { cookie })).json();
    expect(list).toHaveLength(12);
    expect(list[0]).toMatchObject({ id: "projector", transport: "ir_zs06", online: { value: true } });
    await app.close();
  });

  it("R8: switching the projector to mcu shows 'via MCU' in S3 and in devices[]", async () => {
    const { app } = await startApp();
    const cookie = await sessionAt(app, "technician");
    const socket = await openSocket(app, { cookie });
    const patched = await call(app, "PATCH", "/api/devices/projector", { cookie, payload: { transport: "ir_mcu" } });
    expect(patched.json()).toMatchObject({ id: "projector", name: "Projector", transport: "ir_mcu" });
    expect(await socket.next("invalidate")).toEqual({ type: "invalidate", keys: [["devices"], ["ir", "devices"]] });
    const ir: IrDevice[] = (await call(app, "GET", "/api/ir/devices", { cookie })).json();
    expect(ir.find((d) => d.device_id === "projector")?.transport).toBe("ir_mcu");
    expect(app.room.store.get().devices.find((d) => d.id === "projector")?.transport).toBe("ir_mcu");
    socket.ws.terminate();
    await app.close();
  });

  it("renames; refuses a transport change on a non-IR device; removes", async () => {
    const { app } = await startApp();
    const cookie = await sessionAt(app, "technician");
    expect((await call(app, "PATCH", "/api/devices/lights", { cookie, payload: { name: "Lights", hw_ref: "r101_lights_2" } })).json()).toMatchObject({
      name: "Lights", hw_ref: "r101_lights_2",
    });
    const refused = await call(app, "PATCH", "/api/devices/lights", { cookie, payload: { transport: "ir_mcu" } });
    expect([refused.statusCode, refused.json()]).toEqual([409, { code: "precondition", message: "Only IR devices change transport (ZS06 or MCU)" }]);
    expect((await call(app, "DELETE", "/api/devices/door", { cookie })).statusCode).toBe(204);
    expect(app.room.store.get().devices.map((d) => d.id)).not.toContain("door");
    expect((await call(app, "DELETE", "/api/devices/door", { cookie })).statusCode).toBe(404);
    await app.close();
  });

  it("removing the AC removes its setpoints from S1 (R4)", async () => {
    const { app } = await startApp({ SEED_FAKE_IR_CODES: "true" });
    const cookie = await sessionAt(app, "technician");
    expect(app.room.store.get().environment.ac.available_setpoints).toHaveLength(13);
    await call(app, "DELETE", "/api/devices/ac", { cookie });
    expect(app.room.store.get().environment.ac.available_setpoints).toEqual([]);
    await app.close();
  });

  it("permit joining asks hw for 240 s; the mesh event opens S2's countdown", async () => {
    const { app, hw } = await startApp();
    const cookie = await sessionAt(app, "technician");
    const until = new Date(Date.parse(T0) + 240_000).toISOString();
    hw.onCall = (method) => {
      if (method === "permitJoin") app.room.ingest.handle(hwEvent("zigbee.mesh", { joining_until: until }));
    };
    const response = await call(app, "POST", "/api/zigbee/permit-join", { cookie, payload: { seconds: 240 } });
    expect([response.statusCode, hw.calls.at(-1)]).toEqual([202, { method: "permitJoin", body: { seconds: 240 } }]);
    expect(app.room.store.get().zigbee.mesh.joining).toEqual({ state: "open", until });
    expect((await call(app, "POST", "/api/zigbee/permit-join", { cookie, payload: { seconds: 60 } })).statusCode).toBe(400);
    await app.close();
  });

  it("permit joining: coordinator offline 409, hw refusal 503", async () => {
    const { app, hw } = await startApp();
    const cookie = await sessionAt(app, "technician");
    hw.nextAcks.push({ ok: false, error: { code: "timeout", message: "no answer" } });
    expect((await call(app, "POST", "/api/zigbee/permit-join", { cookie, payload: { seconds: 240 } })).json()).toEqual({
      code: "hw_unavailable", message: "Coordinator didn't respond",
    });
    const coordinator = { ...app.room.store.get().zigbee.coordinator, status: "offline" as const };
    app.room.ingest.handle(hwEvent("zigbee.coordinator", coordinator));
    expect((await call(app, "POST", "/api/zigbee/permit-join", { cookie, payload: { seconds: 240 } })).json()).toEqual({
      code: "precondition", message: "Coordinator offline",
    });
    await app.close();
  });
});
