import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildHwJsonSchema } from "../scripts/hw-json-schema.ts";

describe("generated/hw.schema.json", () => {
  it("is up to date (run export-hw-schema after changing src/hw)", () => {
    const committed = readFileSync(new URL("../generated/hw.schema.json", import.meta.url), "utf8");
    expect(committed).toBe(buildHwJsonSchema());
  });
  it("forbids extra properties on requests", () => {
    const doc: unknown = JSON.parse(buildHwJsonSchema());
    expect(doc).toMatchObject({ schemas: { HwLightsSetRequest: { additionalProperties: false } } });
  });
});
