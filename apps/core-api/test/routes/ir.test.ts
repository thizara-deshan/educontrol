import type { IrDevice } from "@eduscope/contracts";
import { describe, expect, it } from "vitest";
import { findIrCommand } from "../../src/db/ir.ts";
import { call, openSocket, sessionAt, startApp } from "./app-helpers.ts";

async function technician(overrides: Record<string, string> = {}) {
  const started = await startApp({ SEED_FAKE_IR_CODES: "true", ...overrides });
  const cookie = await sessionAt(started.app, "technician");
  return { ...started, cookie };
}

describe("IR routes (S3)", () => {
  it("lists AC (15) and Projector (2) from the DB, without codes", async () => {
    const { app, cookie } = await technician();
    const response = await call(app, "GET", "/api/ir/devices", { cookie });
    const list: IrDevice[] = response.json();
    expect(list.map((d) => [d.name, d.commands.length])).toEqual([["Air conditioning", 15], ["Projector", 2]]);
    expect(response.body).not.toContain("C/8hRgHrBkYBgAMH");
    await app.close();
  });

  it("learn → 202, listening then captured over WS; test → 202 sends the code; test-result → tested", async () => {
    const { app, hw, cookie } = await technician();
    const socket = await openSocket(app, { cookie });
    const learn = await call(app, "POST", "/api/ir/commands/projector.power_on/learn", { cookie });
    expect([learn.statusCode, learn.body]).toEqual([202, ""]);
    expect(await socket.next("ir_capture")).toMatchObject({ command_id: "projector.power_on", status: "listening" });
    await app.room.ir.idle();
    await expect.poll(() => socket.frames.filter((f) => f.type === "ir_capture").at(-1)).toMatchObject({ status: "captured" });
    expect(await socket.next("invalidate")).toEqual({ type: "invalidate", keys: [["ir", "devices"]] });
    expect((await call(app, "POST", "/api/ir/commands/projector.power_on/test", { cookie })).statusCode).toBe(202);
    expect(hw.calls.at(-1)).toEqual({ method: "irSend", body: { transport: "ir_zs06", code_format: "tuya", code: "Q0FQVFVSRUQ=" } });
    const answer = await call(app, "POST", "/api/ir/commands/projector.power_on/test-result", { cookie, payload: { reacted: true } });
    expect(answer.json()).toMatchObject({ id: "projector.power_on", captured: true, test: "reacted" });
    socket.ws.terminate();
    await app.close();
  });

  it("nothing received keeps the stored code (H21)", async () => {
    const { app, hw, cookie } = await technician();
    hw.nextLearns.push({ status: "timeout" });
    await call(app, "POST", "/api/ir/commands/projector.power_on/learn", { cookie });
    await app.room.ir.idle();
    expect(findIrCommand(app.room.db, "projector.power_on")?.code).toBe("C/8hRgHrBkYBgAMH");
    await app.close();
  });

  it("a second learn while one runs → 409 precondition", async () => {
    const { app, hw, cookie } = await technician();
    hw.nextLearns.push(new Promise(() => undefined)); // the first capture never ends in this test
    await call(app, "POST", "/api/ir/commands/projector.power_on/learn", { cookie });
    const second = await call(app, "POST", "/api/ir/commands/ac.setpoint_24/learn", { cookie });
    expect([second.statusCode, second.json()]).toEqual([409, { code: "precondition", message: "Another capture is running" }]);
    await app.close();
  });

  it("+ Add device, + Add a command, delete; 404 for an unknown command; validation 400", async () => {
    const { app, cookie } = await technician();
    const device = await call(app, "POST", "/api/ir/devices", { cookie, payload: { name: "Fan", brand: "Acme", kind: "other", transport: "ir_mcu" } });
    expect(device.statusCode).toBe(201);
    const id: string = device.json().device_id;
    const command = await call(app, "POST", `/api/ir/devices/${id}/commands`, { cookie, payload: { name: "On", role: "power_on", setpoint: null } });
    expect([command.statusCode, command.json()]).toEqual([201, expect.objectContaining({ name: "On", captured: false, test: "untested" })]);
    const renamed = await call(app, "PATCH", `/api/ir/devices/${id}`, { cookie, payload: { name: "Ceiling fan" } });
    expect(renamed.json()).toMatchObject({ name: "Ceiling fan", commands: [expect.objectContaining({ name: "On" })] });
    expect((await call(app, "DELETE", `/api/ir/commands/${command.json().id}`, { cookie })).statusCode).toBe(204);
    expect((await call(app, "DELETE", "/api/ir/commands/nope", { cookie })).json()).toEqual({ code: "not_found", message: "Command not found" });
    const bad = await call(app, "POST", "/api/ir/devices/ac/commands", { cookie, payload: { name: "25", role: "setpoint", setpoint: null } });
    expect([bad.statusCode, bad.json().code]).toEqual([400, "validation"]);
    await app.close();
  });
});
