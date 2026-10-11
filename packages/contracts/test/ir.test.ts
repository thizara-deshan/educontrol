import { describe, expect, it } from "vitest";
import { IrCaptureStatus, IrCommand, IrCommandDetail, IrDevice } from "../src/domain/ir.ts";
import { AT } from "./helpers.ts";

const powerOn = {
  id: "cmd_proj_on",
  device_id: "projector",
  name: "Power on",
  role: "power_on",
  setpoint: null,
  code_format: "tuya",
  captured: true,
  captured_at: AT,
  test: "reacted",
  tested_at: AT,
};

describe("IR", () => {
  it("accepts a captured, tested projector command", () => {
    expect(IrCommand.safeParse(powerOn).success).toBe(true);
  });
  it("accepts an AC setpoint frame", () => {
    const frame = { ...powerOn, id: "cmd_ac_24", device_id: "ac", name: "24°", role: "setpoint",
      setpoint: { temp_c: 24, mode: "cool", fan: "auto" }, test: "untested", tested_at: null };
    expect(IrCommand.safeParse(frame).success).toBe(true);
  });
  it("IrCommandDetail requires the code key (null allowed)", () => {
    expect(IrCommandDetail.safeParse(powerOn).success).toBe(false);
    expect(IrCommandDetail.safeParse({ ...powerOn, code: null }).success).toBe(true);
  });
  it("rejects a non-IR transport on an IR device", () => {
    const device = { device_id: "projector", name: "Projector", brand: "Epson", kind: "projector",
      transport: "zigbee", commands: [powerOn] };
    expect(IrDevice.safeParse(device).success).toBe(false);
    expect(IrDevice.safeParse({ ...device, transport: "ir_zs06" }).success).toBe(true);
  });
  it("capture status includes failed", () => {
    expect(IrCaptureStatus.safeParse("failed").success).toBe(true);
  });
});
