import { describe, expect, it } from "vitest";
import { ClassBlockInput, TimedActionInput } from "../src/api/schedule.ts";
import { ApiError } from "../src/api/errors.ts";
import { IrCommandCreate } from "../src/api/ir.ts";
import { PermitJoinRequest } from "../src/api/devices.ts";
import { LoginRequest, LoginResult } from "../src/api/session.ts";
import { RoomPinRequest, TechnicianPinRequest } from "../src/api/settings.ts";
import { AT } from "./helpers.ts";

describe("LoginRequest", () => {
  it("room PIN is 4 digits, technician PIN is 6", () => {
    expect(LoginRequest.safeParse({ level: "control", pin: "1234", label: "phone" }).success).toBe(true);
    expect(LoginRequest.safeParse({ level: "technician", pin: "123456", label: "laptop" }).success).toBe(true);
    expect(LoginRequest.safeParse({ level: "control", pin: "123456", label: "phone" }).success).toBe(false);
    expect(LoginRequest.safeParse({ level: "technician", pin: "1234", label: "phone" }).success).toBe(false);
  });
  it("rejects non-digit PINs and level view", () => {
    expect(LoginRequest.safeParse({ level: "control", pin: "12a4", label: "phone" }).success).toBe(false);
    expect(LoginRequest.safeParse({ level: "view", pin: "1234", label: "phone" }).success).toBe(false);
  });
});

describe("LoginResult", () => {
  it("accepts a session or a PIN error", () => {
    const session = { public_id: "p1", client_type: "remote", label: "phone", access: "control",
      unlocked_at: AT, last_activity: AT, expires_at: AT };
    expect(LoginResult.safeParse(session).success).toBe(true);
    expect(LoginResult.safeParse({ reason: "locked", retry_after_s: 58, attempts_left: 0 }).success).toBe(true);
    expect(LoginResult.safeParse({ reason: "nope", retry_after_s: null, attempts_left: null }).success).toBe(false);
  });
});

describe("IR, schedule, devices, settings, errors", () => {
  it("IrCommandCreate requires setpoint exactly for role setpoint", () => {
    const frame = { temp_c: 24, mode: "cool", fan: "auto" };
    expect(IrCommandCreate.safeParse({ name: "24°", role: "setpoint", setpoint: frame }).success).toBe(true);
    expect(IrCommandCreate.safeParse({ name: "24°", role: "setpoint", setpoint: null }).success).toBe(false);
    expect(IrCommandCreate.safeParse({ name: "Power on", role: "power_on", setpoint: frame }).success).toBe(false);
    expect(IrCommandCreate.safeParse({ name: "Power on", role: "power_on", setpoint: null }).success).toBe(true);
  });
  it("ClassBlockInput has no id and validates order", () => {
    expect(ClassBlockInput.safeParse({ days: ["fri"], start: "13:00", end: "14:30" }).success).toBe(true);
    expect(ClassBlockInput.safeParse({ days: ["fri"], start: "14:30", end: "13:00" }).success).toBe(false);
  });
  it("TimedActionInput has no id", () => {
    const action = { name: "All off", time: "18:00", days: ["mon"], enabled: true, steps: [{ kind: "ac.power", on: false }] };
    expect(TimedActionInput.safeParse(action).success).toBe(true);
  });
  it("permit join is always 240 s", () => {
    expect(PermitJoinRequest.safeParse({ seconds: 240 }).success).toBe(true);
    expect(PermitJoinRequest.safeParse({ seconds: 60 }).success).toBe(false);
  });
  it("PIN change lengths", () => {
    expect(RoomPinRequest.safeParse({ pin: "4321" }).success).toBe(true);
    expect(RoomPinRequest.safeParse({ pin: "54321" }).success).toBe(false);
    expect(TechnicianPinRequest.safeParse({ pin: "654321" }).success).toBe(true);
    expect(TechnicianPinRequest.safeParse({ pin: "4321" }).success).toBe(false);
  });
  it("ApiError rejects unknown codes", () => {
    expect(ApiError.safeParse({ code: "hw_unavailable", message: "Hardware service offline" }).success).toBe(true);
    expect(ApiError.safeParse({ code: "teapot", message: "" }).success).toBe(false);
  });
});
