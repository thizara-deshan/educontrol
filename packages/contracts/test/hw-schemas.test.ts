import { describe, expect, it } from "vitest";
import type { z } from "zod";
import * as hw from "../src/hw/index.ts";
import { AT } from "./helpers.ts";

describe("hw contract", () => {
  it("exports only zod schemas from hw/index.ts", () => {
    const schemas: Record<string, z.ZodType> = { ...hw }; // compile-time check
    expect(Object.keys(schemas).length).toBeGreaterThan(30);
  });
  it("HwLightsSetRequest rejects an unknown gang and extra fields (extra=forbid)", () => {
    expect(hw.HwLightsSetRequest.safeParse({ gang: "rear", on: true }).success).toBe(true);
    expect(hw.HwLightsSetRequest.safeParse({ gang: "middle", on: true }).success).toBe(false);
    expect(hw.HwLightsSetRequest.safeParse({ gang: "rear", on: true, by: "phone" }).success).toBe(false);
  });
  it("HwAck is ok or a typed error", () => {
    expect(hw.HwAck.safeParse({ ok: true }).success).toBe(true);
    expect(hw.HwAck.safeParse({ ok: false, error: { code: "transport", message: "hardware intake pending" } }).success).toBe(true);
    expect(hw.HwAck.safeParse({ ok: false }).success).toBe(false);
  });
  it("HwEvent wraps data with type and at", () => {
    expect(hw.HwEvent.safeParse({ type: "lights.state", at: AT, data: { gang: "front", on: true } }).success).toBe(true);
    expect(hw.HwEvent.safeParse({ type: "lights.state", at: AT, data: { on: true } }).success).toBe(false);
    expect(hw.HwEvent.safeParse({ type: "heartbeat", at: AT, data: { extra: 1 } }).success).toBe(false);
  });
  it("hw facts carry no confidence (raw facts only)", () => {
    expect(hw.HwRelayStateData.safeParse({ on: true, confidence: "confirmed" }).success).toBe(false);
  });
});
