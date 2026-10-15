import { eq } from "drizzle-orm";
import type { z } from "zod";
import type { Db } from "./client.ts";
import { settings } from "./schema.ts";

/** Keys of the `settings` table (ARCHITECTURE §6.2). */
export type SettingKey = "room_pin_hash" | "technician_pin_hash" | "kwh_baseline" | "interlock_bypass" | "ac_power_on_seeded";

/** The stored JSON value parsed with `schema`; null when missing or not matching. */
export function readSetting<S extends z.ZodType>(db: Db, key: SettingKey, schema: S): z.infer<S> | null {
  const row = db.select().from(settings).where(eq(settings.key, key)).get();
  if (row === undefined) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(row.value);
  } catch {
    return null;
  }
  const parsed = schema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export function writeSetting(db: Db, key: SettingKey, value: unknown, at: string): void {
  const json = JSON.stringify(value);
  db.insert(settings)
    .values({ key, value: json, updated_at: at })
    .onConflictDoUpdate({ target: settings.key, set: { value: json, updated_at: at } })
    .run();
}
