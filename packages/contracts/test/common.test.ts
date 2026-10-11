import { describe, expect, expectTypeOf, it } from "vitest";
import { z } from "zod";
import { AccessLevel, ChangedBy, Level, observed, Timestamp, type Observed } from "../src/common.ts";
import { AT, obs } from "./helpers.ts";

const ObservedBool = observed(z.boolean());

describe("Timestamp", () => {
  it("accepts ISO-8601 with Z or an offset", () => {
    expect(Timestamp.safeParse(AT).success).toBe(true);
    expect(Timestamp.safeParse("2026-10-05T10:42:00+02:00").success).toBe(true);
  });
  it("rejects a timestamp without offset", () => {
    expect(Timestamp.safeParse("2026-10-05T10:42:00").success).toBe(false);
  });
});

describe("observed()", () => {
  it("accepts a complete observed value", () => {
    expect(ObservedBool.safeParse(obs(true)).success).toBe(true);
  });
  it("accepts a never-reported value (H11)", () => {
    const never = obs(null, { confidence: "unknown", source: "none", updated_at: null });
    expect(ObservedBool.safeParse(never).success).toBe(true);
  });
  it("rejects a missing confidence", () => {
    const sample = obs(true);
    delete sample.confidence;
    expect(ObservedBool.safeParse(sample).success).toBe(false);
  });
  it("rejects a value of the wrong type", () => {
    expect(ObservedBool.safeParse(obs("yes")).success).toBe(false);
  });
  it("rejects an unknown confidence", () => {
    expect(ObservedBool.safeParse(obs(true, { confidence: "maybe" })).success).toBe(false);
  });
  it("matches the hand-written Observed<T>", () => {
    expectTypeOf<z.infer<typeof ObservedBool>>().toEqualTypeOf<Observed<boolean>>();
  });
});

describe("ChangedBy", () => {
  it.each(["phone", "podium PC", "by hand", "schedule"])("accepts %s", (label) => {
    expect(ChangedBy.safeParse(label).success).toBe(true);
  });
  it("rejects an unknown label", () => {
    expect(ChangedBy.safeParse("desktop").success).toBe(false);
  });
});

describe("Level and AccessLevel", () => {
  it("accepts 0 and 100, rejects 101 and 1.5", () => {
    expect(Level.safeParse(0).success).toBe(true);
    expect(Level.safeParse(100).success).toBe(true);
    expect(Level.safeParse(101).success).toBe(false);
    expect(Level.safeParse(1.5).success).toBe(false);
  });
  it("rejects an unknown access level", () => {
    expect(AccessLevel.safeParse("technician").success).toBe(true);
    expect(AccessLevel.safeParse("admin").success).toBe(false);
  });
});
