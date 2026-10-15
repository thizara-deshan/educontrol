import { describe, expect, it } from "vitest";
import { acCommandName, acKindsOffered, clampTemp, commandInput, EMPTY_DEVICE_FORM, validateDeviceForm } from "./forms";

describe("validateDeviceForm (S3.E9)", () => {
  it("returns the IrDeviceCreate input, trimmed", () => {
    expect(validateDeviceForm({ name: " Screen relay ", brand: "Generic", transport: "ir_mcu", kind: "other" })).toEqual({
      ok: true, value: { name: "Screen relay", brand: "Generic", transport: "ir_mcu", kind: "other" },
    });
  });
  it("names the empty and too-long fields", () => {
    expect(validateDeviceForm(EMPTY_DEVICE_FORM)).toEqual({ ok: false, errors: { name: "Enter a name", brand: "Enter a brand" } });
    expect(validateDeviceForm({ ...EMPTY_DEVICE_FORM, name: "x".repeat(41), brand: "Epson" })).toEqual({
      ok: false, errors: { name: "40 characters at most" },
    });
  });
});

describe("commandInput (S3.E16)", () => {
  it("AC: a setpoint frame named like the seeded rows (AC5: 25 °C / cool / auto)", () => {
    expect(commandInput("ac", "", { temp_c: 25, mode: "cool", fan: "auto" })).toEqual({
      ok: true, value: { name: "25°", role: "setpoint", setpoint: { temp_c: 25, mode: "cool", fan: "auto" } },
    });
    expect(acCommandName({ temp_c: 22, mode: "heat", fan: "low" })).toBe("22° · heat · low");
  });
  it("other devices: a named command; an empty name is refused", () => {
    expect(commandInput("projector", " Freeze ", { temp_c: 24, mode: "cool", fan: "auto" })).toEqual({
      ok: true, value: { name: "Freeze", role: "other", setpoint: null },
    });
    expect(commandInput("other", "  ", { temp_c: 24, mode: "cool", fan: "auto" })).toEqual({ ok: false, errors: { name: "Enter a name" } });
  });
  it("AC Power on (D-26): the remote's own button, no setpoint", () => {
    expect(commandInput("ac", "", { temp_c: 25, mode: "cool", fan: "auto" }, "power_on")).toEqual({
      ok: true, value: { name: "Power on", role: "power_on", setpoint: null },
    });
  });
  it("Power on is offered only while the AC has none", () => {
    expect(acKindsOffered([{ role: "power_off" }, { role: "setpoint" }])).toEqual(["setpoint", "power_on"]);
    expect(acKindsOffered([{ role: "power_on" }, { role: "setpoint" }])).toEqual(["setpoint"]);
  });
  it("clampTemp keeps 16–30", () => {
    expect([clampTemp(15), clampTemp(25), clampTemp(31)]).toEqual([16, 25, 30]);
  });
});
