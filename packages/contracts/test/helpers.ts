import { readdirSync, readFileSync } from "node:fs";

/** Fixed server time used by every contract test (screenshot clock: Mon 5 Oct, 10:42). */
export const AT = "2026-10-05T10:42:00Z";

/** A complete Observed<T> wire object; override any field to build a bad sample. */
export function obs(value: unknown, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    value,
    confidence: "confirmed",
    source: "switch",
    updated_at: AT,
    stale: false,
    changed_by: null,
    ...overrides,
  };
}

/** Parse a JSON file under packages/contracts/fixtures/ (path relative to that folder). */
export function readFixture(relativePath: string): unknown {
  const text = readFileSync(new URL(`../fixtures/${relativePath}`, import.meta.url), "utf8");
  const parsed: unknown = JSON.parse(text);
  return parsed;
}

/** Sorted *.json file names in a fixtures sub-folder. */
export function listFixtures(folder: string): string[] {
  return readdirSync(new URL(`../fixtures/${folder}/`, import.meta.url))
    .filter((name) => name.endsWith(".json"))
    .sort();
}
