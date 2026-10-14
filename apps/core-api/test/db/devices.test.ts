import { describe, expect, it } from "vitest";
import { openDb } from "../../src/db/client.ts";
import { deleteDevice, findDevice, loadRegistry, nextDeviceSort, updateDevice } from "../../src/db/devices.ts";
import { irCommands } from "../../src/db/schema.ts";
import { seed } from "../../src/db/seed.ts";
import { T0, testConfig } from "../helpers.ts";

async function seeded() {
  const { db } = openDb(":memory:");
  await seed(db, testConfig(), T0);
  return db;
}

describe("devices registry", () => {
  it("loads the seeded registry in sort order", async () => {
    const db = await seeded();
    const registry = loadRegistry(db);
    expect(registry.map((d) => d.id).slice(0, 3)).toEqual(["projector", "hdmi_switch", "projection_screen"]);
    expect(registry.find((d) => d.id === "lights")).toEqual({
      id: "lights", name: "Lighting switch", kind: "lights", transport: "zigbee", brand: null, model: "ZBM5-2C-86W", hw_ref: "r101_lights",
    });
    expect(nextDeviceSort(db)).toBe(13);
  });

  it("updates only the patched fields", async () => {
    const db = await seeded();
    expect(updateDevice(db, "projector", { transport: "ir_mcu" })).toMatchObject({ name: "Projector", transport: "ir_mcu", brand: "Epson" });
    expect(updateDevice(db, "lights", { name: "Lights", hw_ref: null })).toMatchObject({ name: "Lights", transport: "zigbee", hw_ref: null });
    expect(updateDevice(db, "lights", {})).toMatchObject({ name: "Lights" });
    expect(updateDevice(db, "nope", { name: "x" })).toBeNull();
  });

  it("deletes a device with its IR commands", async () => {
    const db = await seeded();
    expect(deleteDevice(db, "ac")).toBe(true);
    expect(findDevice(db, "ac")).toBeNull();
    expect(db.select().from(irCommands).all().filter((c) => c.device_id === "ac")).toHaveLength(0);
    expect(deleteDevice(db, "ac")).toBe(false);
  });
});
