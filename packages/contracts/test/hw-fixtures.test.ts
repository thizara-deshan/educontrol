import { describe, expect, it } from "vitest";
import type { z } from "zod";
import * as hw from "../src/hw/index.ts";
import { hwFixtureTarget } from "./hw-fixture-name.ts";
import { listFixtures, readFixture } from "./helpers.ts";

const schemas: Record<string, z.ZodType> = { ...hw };
const files = listFixtures("hw");
const targets = files.map((file) => hwFixtureTarget(file));

describe("hw fixtures", () => {
  it.each(files)("%s parses with its schema", (file) => {
    const target = hwFixtureTarget(file);
    const schema = schemas[target.schema];
    expect(schema, `no exported schema named ${target.schema}`).toBeDefined();
    if (schema === undefined) return;
    const result = schema.safeParse(readFixture(`hw/${file}`));
    expect(result.error?.issues ?? []).toEqual([]);
    if (target.kind === "event") {
      expect(result.data).toMatchObject({ type: target.eventType });
    }
  });

  it("has exactly one fixture per HwEvent type", () => {
    const eventTypes = hw.HwEvent.options.map((option) => option.shape.type.value).sort();
    const fixtureTypes = targets.flatMap((t) => (t.kind === "event" ? [t.eventType] : [])).sort();
    expect(fixtureTypes).toEqual(eventTypes);
  });

  it("has a fixture for every Hw*Request schema", () => {
    const covered = new Set(targets.map((t) => t.schema));
    const missing = Object.keys(schemas).filter((name) => name.endsWith("Request") && !covered.has(name));
    expect(missing).toEqual([]);
  });

  it("has fixtures for every response schema", () => {
    const covered = new Set(targets.map((t) => t.schema));
    for (const name of ["HwAck", "HwHealth", "HwSnapshot", "HwIrLearnResult"]) {
      expect(covered.has(name), name).toBe(true);
    }
  });
});
