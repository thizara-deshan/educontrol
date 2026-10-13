import { describe, expect, it } from "vitest";
import { HealthResponse } from "../src/api/health.ts";

describe("HealthResponse", () => {
  it("accepts ok with the hw link state and rev", () => {
    expect(HealthResponse.safeParse({ ok: true, hw: "down", rev: 0 }).success).toBe(true);
  });
  it("rejects ok:false, an unknown hw state and a negative rev", () => {
    expect(HealthResponse.safeParse({ ok: false, hw: "up", rev: 1 }).success).toBe(false);
    expect(HealthResponse.safeParse({ ok: true, hw: "maybe", rev: 1 }).success).toBe(false);
    expect(HealthResponse.safeParse({ ok: true, hw: "up", rev: -1 }).success).toBe(false);
  });
});
