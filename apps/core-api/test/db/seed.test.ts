import { eq } from "drizzle-orm";
import { z } from "zod";
import { describe, expect, it } from "vitest";
import { verifyPin } from "../../src/auth/pin-hash.ts";
import { openDb } from "../../src/db/client.ts";
import { devices, irCommands, settings } from "../../src/db/schema.ts";
import { FAKE_PROJECTOR_CODES, seed } from "../../src/db/seed.ts";
import { readSetting } from "../../src/db/settings.ts";
import { testConfig } from "../helpers.ts";

const NOW = "2026-10-05T10:42:00.000Z";

describe("seed", () => {
  it("creates the R-101 devices, 17 IR commands without codes and both PIN hashes", async () => {
    const { db } = openDb(":memory:");
    await seed(db, testConfig(), NOW);
    expect(db.select().from(devices).all().map((d) => d.id)).toHaveLength(12);
    const commands = db.select().from(irCommands).all();
    expect(commands.filter((c) => c.device_id === "projector")).toHaveLength(2);
    expect(commands.filter((c) => c.device_id === "ac")).toHaveLength(15);
    expect(commands.every((c) => c.code === null)).toBe(true);
    const roomHash = readSetting(db, "room_pin_hash", z.string());
    expect(roomHash).toMatch(/^scrypt\$16384\$8\$1\$/);
    expect(await verifyPin("1234", roomHash ?? "")).toBe(true);
    expect(await verifyPin("123456", readSetting(db, "technician_pin_hash", z.string()) ?? "")).toBe(true);
    expect(readSetting(db, "interlock_bypass", z.boolean())).toBe(false);
  });

  it("is idempotent and never overwrites a PIN hash", async () => {
    const { db } = openDb(":memory:");
    await seed(db, testConfig(), NOW);
    const hash = readSetting(db, "room_pin_hash", z.string());
    await seed(db, testConfig({ INITIAL_ROOM_PIN: "9999" }), NOW);
    expect(db.select().from(devices).all()).toHaveLength(12);
    expect(db.select().from(irCommands).all()).toHaveLength(17);
    expect(readSetting(db, "room_pin_hash", z.string())).toBe(hash);
  });

  it("a removed device or IR command is not seeded again", async () => {
    const { db } = openDb(":memory:");
    await seed(db, testConfig(), NOW);
    db.delete(devices).where(eq(devices.id, "door")).run();
    db.delete(irCommands).where(eq(irCommands.id, "ac.setpoint_30")).run();
    await seed(db, testConfig(), NOW);
    expect(db.select().from(devices).all().map((d) => d.id)).not.toContain("door");
    expect(db.select().from(irCommands).all().map((c) => c.id)).not.toContain("ac.setpoint_30");
  });

  it("an AC seeded before D-26 gets Power on once, and a later delete sticks", async () => {
    const { db } = openDb(":memory:");
    await seed(db, testConfig(), NOW);
    db.delete(irCommands).where(eq(irCommands.id, "ac.power_on")).run();
    db.delete(settings).where(eq(settings.key, "ac_power_on_seeded")).run();
    await seed(db, testConfig(), NOW);
    const powerOn = db.select().from(irCommands).where(eq(irCommands.id, "ac.power_on")).all();
    expect(powerOn).toHaveLength(1);
    expect(powerOn[0]).toMatchObject({ device_id: "ac", role: "power_on", sort: 0, code: null });
    expect(readSetting(db, "ac_power_on_seeded", z.boolean())).toBe(true);
    db.delete(irCommands).where(eq(irCommands.id, "ac.power_on")).run();
    await seed(db, testConfig(), NOW);
    expect(db.select().from(irCommands).where(eq(irCommands.id, "ac.power_on")).all()).toHaveLength(0);
  });

  it("a fresh database has AC Power on first and is marked", async () => {
    const { db } = openDb(":memory:");
    await seed(db, testConfig(), NOW);
    const ac = db.select().from(irCommands).where(eq(irCommands.device_id, "ac")).all().sort((a, b) => a.sort - b.sort);
    expect(ac[0]?.id).toBe("ac.power_on");
    expect(readSetting(db, "ac_power_on_seeded", z.boolean())).toBe(true);
  });

  it("SEED_FAKE_IR_CODES fills only missing codes, with the fake projector codes", async () => {
    const { db } = openDb(":memory:");
    await seed(db, testConfig(), NOW);
    db.update(irCommands).set({ code: "learned" }).where(eq(irCommands.id, "ac.setpoint_24")).run();
    await seed(db, testConfig({ SEED_FAKE_IR_CODES: "true" }), NOW);
    const byId = new Map(db.select().from(irCommands).all().map((c) => [c.id, c]));
    expect(byId.get("projector.power_on")?.code).toBe(FAKE_PROJECTOR_CODES["projector.power_on"]);
    expect(byId.get("ac.setpoint_24")?.code).toBe("learned");
    expect(byId.get("ac.setpoint_18")?.captured_at).toBe(NOW);
  });

  it("fails on first boot without the initial PINs", async () => {
    const { db } = openDb(":memory:");
    const config = { ...testConfig(), INITIAL_ROOM_PIN: undefined };
    await expect(seed(db, config, NOW)).rejects.toThrow("INITIAL_ROOM_PIN is required on first boot");
  });
});
