import type { IrTransport } from "@eduscope/contracts";
import { and, eq, isNotNull } from "drizzle-orm";
import type { Db } from "../db/client.ts";
import { devices, irCommands } from "../db/schema.ts";

// Stored IR codes for the dispatcher. Codes never leave core-api except to hw-service.

export type IrMatch = { role: "power_on" | "power_off" } | { setpoint_c: number };
export type IrCodeResult = { ok: true; code: string; transport: IrTransport } | { ok: false; message: string };

export interface IrCodeLookup {
  find(deviceId: string, match: IrMatch): IrCodeResult;
}

const isIrTransport = (value: string): value is IrTransport => value === "ir_zs06" || value === "ir_mcu";

export function createIrCodeLookup(db: Db): IrCodeLookup {
  return {
    find(deviceId, match) {
      const device = db.select().from(devices).where(eq(devices.id, deviceId)).get();
      if (device === undefined || !isIrTransport(device.transport)) return { ok: false, message: `${deviceId} is not an IR device` };
      const rows = db.select().from(irCommands).where(eq(irCommands.device_id, deviceId)).all();
      const row = rows.find((r) => ("role" in match ? r.role === match.role : r.role === "setpoint" && r.setpoint_temp_c === match.setpoint_c));
      const name = row?.name ?? ("role" in match ? match.role : `${match.setpoint_c}°`);
      if (row === undefined || row.code === null) return { ok: false, message: `${device.name} · ${name} has no captured IR code` };
      return { ok: true, code: row.code, transport: device.transport };
    },
  };
}

/** R4: AC setpoints that have a captured frame, ascending. */
export function capturedSetpoints(db: Db, deviceId: string): number[] {
  return db
    .select()
    .from(irCommands)
    .where(and(eq(irCommands.device_id, deviceId), eq(irCommands.role, "setpoint"), isNotNull(irCommands.code)))
    .all()
    .flatMap((row) => (row.setpoint_temp_c === null ? [] : [row.setpoint_temp_c]))
    .sort((a, b) => a - b);
}
