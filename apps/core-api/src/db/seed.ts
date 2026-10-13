import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { hashPin } from "../auth/pin-hash.ts";
import type { Config } from "../config.ts";
import type { Db } from "./client.ts";
import { readSetting, writeSetting } from "./settings.ts";
import { devices, irCommands } from "./schema.ts";

// Idempotent first-boot data for R-101 (ARCHITECTURE §6.2). Every insert is "insert if missing",
// so a restart never duplicates rows and never overwrites a PIN, a rename or a captured code.

type DeviceRow = typeof devices.$inferInsert;
type IrCommandRow = typeof irCommands.$inferInsert;

/** Ids equal fixtures/state/room-normal.json: the kiosk looks devices up by these ids. */
export const SEED_DEVICES: readonly DeviceRow[] = [
  { id: "projector", name: "Projector", kind: "projector", transport: "ir_zs06", brand: "Epson", model: null, hw_ref: null, sort: 1 },
  { id: "hdmi_switch", name: "HDMI switch", kind: "hdmi_switch", transport: "local", brand: null, model: null, hw_ref: null, sort: 2 },
  { id: "projection_screen", name: "Projection screen", kind: "projection_screen", transport: "local", brand: null, model: null, hw_ref: null, sort: 3 },
  { id: "lights", name: "Lighting switch", kind: "lights", transport: "zigbee", brand: null, model: "ZBM5-2C-86W", hw_ref: "r101_lights", sort: 4 },
  { id: "ac", name: "Air conditioning", kind: "ac", transport: "ir_zs06", brand: "Panasonic", model: null, hw_ref: null, sort: 5 },
  { id: "audio", name: "Audio mixer", kind: "audio", transport: "local", brand: null, model: null, hw_ref: null, sort: 6 },
  { id: "projector_socket", name: "Projector socket", kind: "power_socket", transport: "zigbee", brand: null, model: "S60ZBTPG", hw_ref: "r101_proj_plug", sort: 7 },
  { id: "room_climate", name: "Room climate", kind: "sensor", transport: "zigbee", brand: null, model: "SNZB-02P", hw_ref: "r101_temp", sort: 8 },
  { id: "motion", name: "Motion", kind: "sensor", transport: "zigbee", brand: null, model: "SNZB-03P", hw_ref: "r101_motion", sort: 9 },
  { id: "door", name: "Door", kind: "sensor", transport: "zigbee", brand: null, model: "SNZB-04PR2", hw_ref: "r101_door", sort: 10 },
  { id: "ir_blaster", name: "ZS06", kind: "ir_blaster", transport: "zigbee", brand: null, model: "ZS06", hw_ref: "r101_ir", sort: 11 },
  { id: "coordinator", name: "Coordinator", kind: "coordinator", transport: "local", brand: null, model: "ZG-808Z", hw_ref: "zigbee-coord", sort: 12 },
];

/** AC setpoint frames 18–30 °C, cool, auto fan (Q23 [ASSUMED]). */
export const SEED_AC_SETPOINTS = [18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30] as const;

function irCommand(id: string, deviceId: string, name: string, role: string, sort: number, tempC: number | null = null): IrCommandRow {
  return {
    id, device_id: deviceId, name, role, sort, code_format: "tuya", code: null, captured_at: null, test: "untested", tested_at: null,
    setpoint_temp_c: tempC, setpoint_mode: tempC === null ? null : "cool", setpoint_fan: tempC === null ? null : "auto",
  };
}

/** Projector 2 + AC 14 (power off + 13 setpoints), all without a code until M09 learns them. */
export const SEED_IR_COMMANDS: readonly IrCommandRow[] = [
  irCommand("projector.power_on", "projector", "Power on", "power_on", 1),
  irCommand("projector.power_off", "projector", "Power off", "power_off", 2),
  irCommand("ac.power_off", "ac", "Power off", "power_off", 1),
  ...SEED_AC_SETPOINTS.map((temp, i) => irCommand(`ac.setpoint_${temp}`, "ac", `${temp}°`, "setpoint", i + 2, temp)),
];

/** Equal to hw-service's HW_FAKE_PROJECTOR_ON/OFF_CODE defaults (services/hw/app/config.py). */
export const FAKE_PROJECTOR_CODES: Readonly<Record<string, string>> = {
  "projector.power_on": "C/8hRgHrBkYBgAMH",
  "projector.power_off": "C/8hRgHrBkYBgAMP",
};

const fakeCode = (id: string): string => FAKE_PROJECTOR_CODES[id] ?? Buffer.from(`fake:${id}`).toString("base64");

export async function seed(db: Db, config: Pick<Config, "INITIAL_ROOM_PIN" | "INITIAL_TECH_PIN" | "SEED_FAKE_IR_CODES">, now: string): Promise<void> {
  db.insert(devices).values([...SEED_DEVICES]).onConflictDoNothing().run();
  db.insert(irCommands).values([...SEED_IR_COMMANDS]).onConflictDoNothing().run();

  if (config.SEED_FAKE_IR_CODES) {
    for (const command of SEED_IR_COMMANDS) {
      db.update(irCommands)
        .set({ code: fakeCode(command.id), captured_at: now })
        .where(and(eq(irCommands.id, command.id), isNull(irCommands.code)))
        .run();
    }
  }

  if (readSetting(db, "room_pin_hash", z.string()) === null) {
    if (config.INITIAL_ROOM_PIN === undefined) throw new Error("INITIAL_ROOM_PIN is required on first boot");
    writeSetting(db, "room_pin_hash", await hashPin(config.INITIAL_ROOM_PIN), now);
  }
  if (readSetting(db, "technician_pin_hash", z.string()) === null) {
    if (config.INITIAL_TECH_PIN === undefined) throw new Error("INITIAL_TECH_PIN is required on first boot");
    writeSetting(db, "technician_pin_hash", await hashPin(config.INITIAL_TECH_PIN), now);
  }
  if (readSetting(db, "interlock_bypass", z.boolean()) === null) writeSetting(db, "interlock_bypass", false, now);
}
