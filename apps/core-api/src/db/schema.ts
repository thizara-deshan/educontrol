import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

// ARCHITECTURE §6.2 — every table core-api will ever need (M09 adds none). Timestamps are ISO
// strings (server time); json columns hold JSON text. Edit → `pnpm --filter @eduscope/core-api db:generate`.

/** room id/hostname overrides, PIN hashes, kWh midnight baseline, interlock bypass. */
export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(), // JSON
  updated_at: text("updated_at").notNull(),
});

/** Device/Output registry (S3d) and IrDevice rows (transport ir_*). */
export const devices = sqliteTable("devices", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  kind: text("kind").notNull(),
  transport: text("transport").notNull(),
  brand: text("brand"),
  model: text("model"),
  hw_ref: text("hw_ref"),
  sort: integer("sort").notNull(),
});

/** IrCommand (R4, R5). `code` is technician-only and never leaves core-api over WS. */
export const irCommands = sqliteTable(
  "ir_commands",
  {
    id: text("id").primaryKey(),
    device_id: text("device_id")
      .notNull()
      .references(() => devices.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    role: text("role").notNull(),
    setpoint_temp_c: integer("setpoint_temp_c"),
    setpoint_mode: text("setpoint_mode"),
    setpoint_fan: text("setpoint_fan"),
    code_format: text("code_format").notNull(),
    code: text("code"),
    captured_at: text("captured_at"),
    test: text("test").notNull(),
    tested_at: text("tested_at"),
    sort: integer("sort").notNull(),
  },
  (table) => [index("ir_commands_device_idx").on(table.device_id)],
);

/** ClientSession rows; `id` is the cookie value, `public_id` is safe to broadcast. */
export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  public_id: text("public_id").notNull().unique(),
  access: text("access").notNull(),
  client_type: text("client_type").notNull(),
  label: text("label").notNull(),
  ip: text("ip").notNull(),
  created_at: text("created_at").notNull(),
  unlocked_at: text("unlocked_at"),
  last_activity: text("last_activity"),
  expires_at: text("expires_at"),
});

/** Schedule.class_blocks (§2.3); used from M09. */
export const classBlocks = sqliteTable("class_blocks", {
  id: text("id").primaryKey(),
  days: text("days").notNull(), // JSON Weekday[]
  start: text("start").notNull(), // "HH:MM"
  end: text("end").notNull(),
});

/** Schedule.actions; used from M09. */
export const timedActions = sqliteTable("timed_actions", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  time: text("time").notNull(),
  days: text("days").notNull(), // JSON Weekday[]
  enabled: integer("enabled", { mode: "boolean" }).notNull(),
  steps: text("steps").notNull(), // JSON CommandBody[]
});

/** Command history and audit (30-day retention from M09). */
export const eventLog = sqliteTable(
  "event_log",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    at: text("at").notNull(),
    type: text("type").notNull(), // command | state | session | pin_failure | hw | system
    actor: text("actor"),
    public_id: text("public_id"),
    subject: text("subject"),
    payload: text("payload"), // JSON
    result: text("result"),
  },
  (table) => [index("event_log_at_idx").on(table.at)],
);
