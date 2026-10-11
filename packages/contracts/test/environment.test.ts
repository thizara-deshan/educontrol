import { describe, expect, it } from "vitest";
import { AcState, SensorReading } from "../src/domain/environment.ts";
import { AT, obs } from "./helpers.ts";

const meta = { at: AT, stale: false };

describe("SensorReading", () => {
  it.each([
    { kind: "temperature", value: 26.4, node: "r101_temp" },
    { kind: "humidity", value: 61, node: "r101_temp" },
    { kind: "occupancy", value: "detected", node: "r101_motion" },
    { kind: "contact", value: "closed", node: "r101_door" },
    { kind: "contact", value: null, node: "r101_door" },
  ])("accepts $kind = $value", (reading) => {
    expect(SensorReading.safeParse({ ...reading, ...meta }).success).toBe(true);
  });
  it('rejects {kind:"occupancy", value:"open"}', () => {
    expect(SensorReading.safeParse({ kind: "occupancy", value: "open", node: "r101_motion", ...meta }).success).toBe(false);
  });
  it("rejects a fractional humidity", () => {
    expect(SensorReading.safeParse({ kind: "humidity", value: 61.5, node: "r101_temp", ...meta }).success).toBe(false);
  });
  it("rejects a reading without node", () => {
    expect(SensorReading.safeParse({ kind: "temperature", value: 26.4, ...meta }).success).toBe(false);
  });
});

describe("AcState", () => {
  const ac = {
    power: obs("on", { confidence: "assumed", source: "ir" }),
    setpoint_c: obs(24, { confidence: "assumed", source: "ir" }),
    available_setpoints: [18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30],
  };
  it("accepts On · assumed at 24°", () => {
    expect(AcState.safeParse(ac).success).toBe(true);
  });
  it("rejects a fractional setpoint", () => {
    expect(AcState.safeParse({ ...ac, setpoint_c: obs(24.5, { confidence: "assumed", source: "ir" }) }).success).toBe(false);
  });
});
