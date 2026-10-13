import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { openDb } from "../../src/db/client.ts";
import { devices } from "../../src/db/schema.ts";

describe("openDb", () => {
  it("creates every §6.2 table through the generated migration", () => {
    const { sqlite, close } = openDb(":memory:");
    const tables = sqlite
      .prepare("select name from sqlite_master where type = 'table' and name not like '\\_\\_%' escape '\\' and name != 'sqlite_sequence' order by name")
      .all();
    expect(tables).toEqual(
      ["class_blocks", "devices", "event_log", "ir_commands", "sessions", "settings", "timed_actions"].map((name) => ({ name })),
    );
    expect(sqlite.pragma("foreign_keys", { simple: true })).toBe(1);
    close();
  });

  it("creates the folder and file, and re-opening runs no migration twice", () => {
    const path = join(mkdtempSync(join(tmpdir(), "core-db-")), "nested", "eduscope.db");
    const first = openDb(path);
    first.db.insert(devices).values({ id: "x", name: "X", kind: "other", transport: "local", sort: 1 }).run();
    first.close();
    const second = openDb(path);
    expect(second.db.select().from(devices).all()).toHaveLength(1);
    expect(second.sqlite.pragma("journal_mode", { simple: true })).toBe("wal");
    second.close();
  });
});
