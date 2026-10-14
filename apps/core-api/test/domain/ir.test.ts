import type { IrCommand, IrDevice } from "@eduscope/contracts";
import { describe, expect, it } from "vitest";
import { captureFields, duplicateSetpoint, irKind, isIrTransport, sortIrDevices, testResultFields } from "../../src/domain/ir.ts";

const command = (temp: number | null): IrCommand => ({
  id: `c${temp ?? "x"}`, device_id: "ac", name: temp === null ? "Power off" : `${temp}°`, role: temp === null ? "power_off" : "setpoint",
  setpoint: temp === null ? null : { temp_c: temp, mode: "cool", fan: "auto" },
  code_format: "tuya", captured: true, captured_at: null, test: "reacted", tested_at: null,
});
const device = (name: string): IrDevice => ({ device_id: name, name, brand: "", kind: "other", transport: "ir_zs06", commands: [] });

describe("IR rules", () => {
  it("only ir_* transports are IR devices", () => {
    expect(isIrTransport("ir_zs06")).toBe(true);
    expect(isIrTransport("ir_mcu")).toBe(true);
    expect(isIrTransport("zigbee")).toBe(false);
    expect(isIrTransport("local")).toBe(false);
  });

  it("maps device kinds to IR kinds", () => {
    expect(irKind("projector")).toBe("projector");
    expect(irKind("ac")).toBe("ac");
    expect(irKind("other")).toBe("other");
    expect(irKind("lights")).toBe("other");
  });

  it("lists devices by name", () => {
    expect(sortIrDevices([device("Projector"), device("Air conditioning")]).map((d) => d.name)).toEqual(["Air conditioning", "Projector"]);
  });

  it("a capture stores the code untested (R5); an answer records reacted / no reaction (H22)", () => {
    expect(captureFields("QUJD", "2026-10-05T10:42:00.000Z")).toEqual({
      code: "QUJD", captured_at: "2026-10-05T10:42:00.000Z", test: "untested", tested_at: null,
    });
    expect(testResultFields(true, "2026-10-05T10:43:00.000Z")).toEqual({ test: "reacted", tested_at: "2026-10-05T10:43:00.000Z" });
    expect(testResultFields(false, "2026-10-05T10:43:00.000Z")).toEqual({ test: "no_reaction", tested_at: "2026-10-05T10:43:00.000Z" });
  });

  it("refuses a second command for the same setpoint (R4)", () => {
    expect(duplicateSetpoint([command(null), command(24)], 24)).toBe("A 24° setpoint already exists");
    expect(duplicateSetpoint([command(null), command(24)], 31)).toBeNull();
  });
});
