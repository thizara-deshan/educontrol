import { IrCommand, type IrCommandCreate, type IrDevice, type IrDeviceCreate, type IrDeviceUpdate } from "@eduscope/contracts";
import { asc, eq, max } from "drizzle-orm";
import { captureFields, irKind, isIrTransport, sortIrDevices, testResultFields } from "../domain/ir.ts";
import type { DeviceInfo } from "../domain/model.ts";
import type { Db } from "./client.ts";
import { findDevice, loadRegistry, nextDeviceSort } from "./devices.ts";
import { devices, irCommands } from "./schema.ts";

// IR devices and commands (ARCHITECTURE §6.2, §6.9). IR devices ARE the registry devices with an
// ir_* transport. The opaque `code` never leaves this module except through `commandCode`.

export type IrCommandRow = typeof irCommands.$inferSelect;

/** The contract view of a row: `captured` instead of the code. */
export function toIrCommand(row: IrCommandRow): IrCommand {
  const setpoint =
    row.role === "setpoint" && row.setpoint_temp_c !== null
      ? { temp_c: row.setpoint_temp_c, mode: row.setpoint_mode ?? "", fan: row.setpoint_fan ?? "" }
      : null;
  return IrCommand.parse({
    id: row.id, device_id: row.device_id, name: row.name, role: row.role, setpoint, code_format: row.code_format,
    captured: row.code !== null, captured_at: row.captured_at, test: row.test, tested_at: row.tested_at,
  });
}

function commandsOf(db: Db, deviceId: string): IrCommand[] {
  return db.select().from(irCommands).where(eq(irCommands.device_id, deviceId)).orderBy(asc(irCommands.sort)).all().map(toIrCommand);
}

function toIrDevice(db: Db, info: DeviceInfo): IrDevice | null {
  if (!isIrTransport(info.transport)) return null;
  return {
    device_id: info.id, name: info.name, brand: info.brand ?? "", kind: irKind(info.kind), transport: info.transport,
    commands: commandsOf(db, info.id),
  };
}

/** GET /api/ir/devices: every IR device with its commands, by name. */
export function listIrDevices(db: Db): IrDevice[] {
  return sortIrDevices(loadRegistry(db).flatMap((info) => toIrDevice(db, info) ?? []));
}

/** One IR device, or null when the id is unknown or not an IR device. */
export function findIrDevice(db: Db, id: string): IrDevice | null {
  const info = findDevice(db, id);
  return info === null ? null : toIrDevice(db, info);
}

export function findIrCommand(db: Db, id: string): IrCommandRow | null {
  return db.select().from(irCommands).where(eq(irCommands.id, id)).get() ?? null;
}

/** S3.E9 "+ Add device": a new registry row with an IR transport. */
export function createIrDevice(db: Db, id: string, input: IrDeviceCreate): IrDevice {
  db.insert(devices)
    .values({ id, name: input.name, kind: input.kind, transport: input.transport, brand: input.brand, model: null, hw_ref: null, sort: nextDeviceSort(db) })
    .run();
  const created = findIrDevice(db, id);
  if (created === null) throw new Error("IR device vanished");
  return created;
}

/** PATCH /api/ir/devices/:id. Null when the id is unknown or not an IR device. */
export function updateIrDevice(db: Db, id: string, patch: IrDeviceUpdate): IrDevice | null {
  if (findIrDevice(db, id) === null) return null;
  const set = {
    ...(patch.name === undefined ? {} : { name: patch.name }),
    ...(patch.brand === undefined ? {} : { brand: patch.brand }),
    ...(patch.kind === undefined ? {} : { kind: patch.kind }),
    ...(patch.transport === undefined ? {} : { transport: patch.transport }),
  };
  if (Object.keys(set).length > 0) db.update(devices).set(set).where(eq(devices.id, id)).run();
  return findIrDevice(db, id);
}

/** S3.E16 "+ Add a command": not captured, untested, after the device's other commands. */
export function createIrCommand(db: Db, id: string, deviceId: string, input: IrCommandCreate): IrCommand {
  const sort = (db.select({ value: max(irCommands.sort) }).from(irCommands).where(eq(irCommands.device_id, deviceId)).get()?.value ?? 0) + 1;
  db.insert(irCommands)
    .values({
      id, device_id: deviceId, name: input.name, role: input.role, sort, code_format: "tuya", code: null, captured_at: null,
      test: "untested", tested_at: null, setpoint_temp_c: input.setpoint?.temp_c ?? null, setpoint_mode: input.setpoint?.mode ?? null,
      setpoint_fan: input.setpoint?.fan ?? null,
    })
    .run();
  const row = findIrCommand(db, id);
  if (row === null) throw new Error("IR command vanished");
  return toIrCommand(row);
}

export function deleteIrCommand(db: Db, id: string): boolean {
  return db.delete(irCommands).where(eq(irCommands.id, id)).run().changes > 0;
}

/** A capture succeeded: the new code replaces the old one, untested (R5). Null if the command is gone. */
export function storeCapture(db: Db, id: string, code: string, at: string): IrCommand | null {
  db.update(irCommands).set(captureFields(code, at)).where(eq(irCommands.id, id)).run();
  const row = findIrCommand(db, id);
  return row === null ? null : toIrCommand(row);
}

/** H22 answer. Null if the command is gone. */
export function storeTestResult(db: Db, id: string, reacted: boolean, at: string): IrCommand | null {
  db.update(irCommands).set(testResultFields(reacted, at)).where(eq(irCommands.id, id)).run();
  const row = findIrCommand(db, id);
  return row === null ? null : toIrCommand(row);
}
