import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { capturedSetpoints, createIrCodeLookup } from "../../src/commands/ir-codes.ts";
import { openDb } from "../../src/db/client.ts";
import { devices, irCommands } from "../../src/db/schema.ts";
import { seed } from "../../src/db/seed.ts";
import { T0, testConfig } from "../helpers.ts";

async function seeded(fakeCodes: boolean) {
  const { db } = openDb(":memory:");
  await seed(db, testConfig({ SEED_FAKE_IR_CODES: fakeCodes ? "true" : "false" }), T0);
  return db;
}

describe("IR code lookup", () => {
  it("finds a captured code with the device's transport", async () => {
    const ir = createIrCodeLookup(await seeded(true));
    expect(ir.find("projector", { role: "power_on" })).toEqual({ ok: true, code: "C/8hRgHrBkYBgAMH", transport: "ir_zs06" });
    expect(ir.find("ac", { setpoint_c: 24 })).toMatchObject({ ok: true, transport: "ir_zs06" });
  });

  it("names the missing code (ir_code_missing) and unknown setpoints", async () => {
    const ir = createIrCodeLookup(await seeded(false));
    expect(ir.find("projector", { role: "power_on" })).toEqual({ ok: false, message: "Projector · Power on has no captured IR code" });
    expect(ir.find("ac", { setpoint_c: 31 })).toEqual({ ok: false, message: "Air conditioning · 31° has no captured IR code" });
    expect(ir.find("lights", { role: "power_on" })).toEqual({ ok: false, message: "lights is not an IR device" });
  });

  it("R8: a device switched to the MCU fallback sends over ir_mcu", async () => {
    const db = await seeded(true);
    db.update(devices).set({ transport: "ir_mcu" }).where(eq(devices.id, "projector")).run();
    expect(createIrCodeLookup(db).find("projector", { role: "power_off" })).toMatchObject({ ok: true, transport: "ir_mcu" });
  });

  it("R4: captured setpoints only, ascending", async () => {
    const db = await seeded(false);
    expect(capturedSetpoints(db, "ac")).toEqual([]);
    for (const temp of [26, 18, 24]) db.update(irCommands).set({ code: `c${temp}` }).where(eq(irCommands.id, `ac.setpoint_${temp}`)).run();
    expect(capturedSetpoints(db, "ac")).toEqual([18, 24, 26]);
  });
});
