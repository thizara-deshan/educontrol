import { DeviceKind, Transport, type DevicePatch } from "@eduscope/contracts";
import { eq, max } from "drizzle-orm";
import type { DeviceInfo } from "../domain/model.ts";
import type { Db } from "./client.ts";
import { devices } from "./schema.ts";

// The `devices` registry (ARCHITECTURE §6.2, S3d). The store keeps a copy (`RoomModel.registry`);
// every write here is followed by `syncRegistry` (registry-sync.ts).

export type DeviceRow = typeof devices.$inferSelect;

export function toDeviceInfo(row: DeviceRow): DeviceInfo {
  return {
    id: row.id, name: row.name, kind: DeviceKind.parse(row.kind), transport: Transport.parse(row.transport),
    brand: row.brand, model: row.model, hw_ref: row.hw_ref,
  };
}

/** Every device in sort order. */
export function loadRegistry(db: Db): DeviceInfo[] {
  return db.select().from(devices).orderBy(devices.sort).all().map(toDeviceInfo);
}

export function findDevice(db: Db, id: string): DeviceInfo | null {
  const row = db.select().from(devices).where(eq(devices.id, id)).get();
  return row === undefined ? null : toDeviceInfo(row);
}

/** The sort value for a device added now (after every existing one). */
export function nextDeviceSort(db: Db): number {
  return (db.select({ value: max(devices.sort) }).from(devices).get()?.value ?? 0) + 1;
}

/** S3d edit sheet: only the fields present in the patch change. Returns null when the id is unknown. */
export function updateDevice(db: Db, id: string, patch: DevicePatch): DeviceInfo | null {
  const set: Partial<DeviceRow> = {
    ...(patch.name === undefined ? {} : { name: patch.name }),
    ...(patch.transport === undefined ? {} : { transport: patch.transport }),
    ...(patch.hw_ref === undefined ? {} : { hw_ref: patch.hw_ref }),
  };
  if (Object.keys(set).length > 0) db.update(devices).set(set).where(eq(devices.id, id)).run();
  return findDevice(db, id);
}

/** S3d remove; its IR commands go with it (FK cascade). False when the id is unknown. */
export function deleteDevice(db: Db, id: string): boolean {
  return db.delete(devices).where(eq(devices.id, id)).run().changes > 0;
}
