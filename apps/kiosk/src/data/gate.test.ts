import { describe, expect, it } from "vitest";
import { computeControlGate, gateDisablesControl, type ControlGate, type GateInput } from "./gate";

describe("computeControlGate", () => {
  it.each<[GateInput, ReturnType<typeof computeControlGate>]>([
    [{ connection: "live", access: "control" }, { enabled: true, reason: null }],
    [{ connection: "back_online", access: "technician" }, { enabled: true, reason: null }],
    [{ connection: "live", access: "control", deviceOnline: true }, { enabled: true, reason: null }],
    [{ connection: "live", access: "control", deviceOnline: null }, { enabled: true, reason: null }],
    [{ connection: "connecting", access: "control" }, { enabled: false, reason: "disconnected" }],
    [{ connection: "reconnecting", access: "control" }, { enabled: false, reason: "disconnected" }],
    [{ connection: "unreachable", access: "technician" }, { enabled: false, reason: "disconnected" }],
    [{ connection: "reconnecting", access: "view", deviceOnline: false }, { enabled: false, reason: "disconnected" }],
    [{ connection: "live", access: "control", deviceOnline: false }, { enabled: false, reason: "offline" }],
    [{ connection: "live", access: "view", deviceOnline: false }, { enabled: false, reason: "offline" }],
    [{ connection: "live", access: "view" }, { enabled: false, reason: "locked" }],
    [{ connection: "live", access: undefined }, { enabled: false, reason: "locked" }],
  ])("%o → %o", (input, expected) => {
    expect(computeControlGate(input)).toEqual(expected);
  });
});

describe("gateDisablesControl", () => {
  it.each<[ControlGate, boolean]>([
    [{ enabled: true, reason: null }, false],
    [{ enabled: false, reason: "locked" }, false],
    [{ enabled: false, reason: "disconnected" }, true],
    [{ enabled: false, reason: "offline" }, true],
  ])("%o → %s", (gate, expected) => {
    expect(gateDisablesControl(gate)).toBe(expected);
  });
});
