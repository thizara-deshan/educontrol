import { describe, expect, it } from "vitest";
import { openDb } from "../../src/db/client.ts";
import {
  createIrCommand, createIrDevice, deleteIrCommand, findIrCommand, findIrDevice, listIrDevices, storeCapture, storeTestResult,
  updateIrDevice,
} from "../../src/db/ir.ts";
import { seed } from "../../src/db/seed.ts";
import { must, T0, testConfig } from "../helpers.ts";

async function seeded(fakeCodes = false) {
  const { db } = openDb(":memory:");
  await seed(db, testConfig(fakeCodes ? { SEED_FAKE_IR_CODES: "true" } : {}), T0);
  return db;
}

describe("IR records", () => {
  it("lists AC (15) and Projector (2) by name, without codes", async () => {
    const db = await seeded(true);
    const list = listIrDevices(db);
    expect(list.map((d) => [d.name, d.brand, d.kind, d.transport, d.commands.length])).toEqual([
      ["Air conditioning", "Panasonic", "ac", "ir_zs06", 15],
      ["Projector", "Epson", "projector", "ir_zs06", 2],
    ]);
    const on = must(list[1]?.commands[0]);
    expect(on).toEqual({
      id: "projector.power_on", device_id: "projector", name: "Power on", role: "power_on", setpoint: null, code_format: "tuya",
      captured: true, captured_at: T0, test: "untested", tested_at: null,
    });
    expect(JSON.stringify(list)).not.toContain("C/8hRgHrBkYBgAMH");
    expect(list[0]?.commands[2]?.setpoint).toEqual({ temp_c: 18, mode: "cool", fan: "auto" });
  });

  it("a non-IR device is not an IR device", async () => {
    const db = await seeded();
    expect(findIrDevice(db, "lights")).toBeNull();
    expect(updateIrDevice(db, "lights", { name: "x" })).toBeNull();
  });

  it("creates a device and a command after the existing ones", async () => {
    const db = await seeded();
    const fan = createIrDevice(db, "dev-1", { name: "Fan", brand: "Acme", kind: "other", transport: "ir_mcu" });
    expect(fan).toEqual({ device_id: "dev-1", name: "Fan", brand: "Acme", kind: "other", transport: "ir_mcu", commands: [] });
    const cmd = createIrCommand(db, "cmd-1", "ac", { name: "31°", role: "setpoint", setpoint: { temp_c: 31, mode: "cool", fan: "auto" } });
    expect(cmd).toMatchObject({ captured: false, test: "untested", setpoint: { temp_c: 31 } });
    expect(must(findIrDevice(db, "ac")).commands.at(-1)?.id).toBe("cmd-1");
  });

  it("updates an IR device's transport (R8)", async () => {
    const db = await seeded();
    expect(updateIrDevice(db, "projector", { transport: "ir_mcu" })).toMatchObject({ transport: "ir_mcu", brand: "Epson" });
  });

  it("capture stores the code untested; a test answer records the result", async () => {
    const db = await seeded();
    expect(storeCapture(db, "projector.power_on", "QUJD", T0)).toMatchObject({ captured: true, captured_at: T0, test: "untested" });
    expect(findIrCommand(db, "projector.power_on")?.code).toBe("QUJD");
    expect(storeTestResult(db, "projector.power_on", true, T0)).toMatchObject({ test: "reacted", tested_at: T0 });
    expect(storeTestResult(db, "nope", true, T0)).toBeNull();
  });

  it("deletes a command", async () => {
    const db = await seeded();
    expect(deleteIrCommand(db, "ac.setpoint_30")).toBe(true);
    expect(deleteIrCommand(db, "ac.setpoint_30")).toBe(false);
    expect(must(findIrDevice(db, "ac")).commands).toHaveLength(14);
  });
});
