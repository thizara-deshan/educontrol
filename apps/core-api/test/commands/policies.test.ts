import type { CommandBody, HwEvent } from "@eduscope/contracts";
import { describe, expect, it } from "vitest";
import type { IrCodeLookup } from "../../src/commands/ir-codes.ts";
import { FAILURE_TEXT, planCommand, requiredAccess } from "../../src/commands/policies.ts";
import { derive } from "../../src/domain/derive.ts";
import { applyHwDown, applyHwEvent } from "../../src/domain/hw-events.ts";
import type { RoomModel } from "../../src/domain/model.ts";
import { bootModel, hwEvent, must, RULES, snapshotEvent, T0 } from "../helpers.ts";

const TIMEOUTS = { zigbeeMs: 5000, irSendMs: 3000, irLearnMs: 25_000, hdmiMs: 5000, mixerMs: 2000, screenMs: 5000 };

const ir = (codes: Record<string, string>): IrCodeLookup => ({
  find(deviceId, match) {
    const key = "role" in match ? `${deviceId}.${match.role}` : `${deviceId}.setpoint_${match.setpoint_c}`;
    const code = codes[key];
    return code === undefined ? { ok: false, message: `${key} has no captured IR code` } : { ok: true, code, transport: "ir_zs06" };
  },
});
const CODES = ir({ "projector.power_on": "ON", "ac.power_off": "AC-OFF", "ac.setpoint_24": "AC-24", "ac.setpoint_26": "AC-26" });

/** R-101 live (snapshot applied, derived), plus any extra hw events. */
function live(...events: HwEvent[]): RoomModel {
  let model = applyHwEvent(bootModel({ acSetpoints: [24, 26] }), snapshotEvent());
  for (const event of events) model = applyHwEvent(model, event);
  return derive(model, new Date(T0), RULES);
}

const refusal = (body: CommandBody, model: RoomModel = live(), codes: IrCodeLookup = CODES) => {
  const result = planCommand(body, model, codes, TIMEOUTS);
  return result.ok ? null : { status: result.status, code: result.code, message: result.message };
};

describe("command policies (§6.5)", () => {
  it("R14: projector mains needs technician, everything else control", () => {
    expect(requiredAccess({ kind: "projector.mains", on: false })).toBe("technician");
    expect(requiredAccess({ kind: "lights.set", gang: "rear", on: true })).toBe("control");
  });

  it("hw down → 503 hw_unavailable for every kind", () => {
    const down = derive(applyHwDown(live(), T0), new Date(T0), RULES);
    expect(refusal({ kind: "lights.set", gang: "rear", on: true }, down)).toEqual({ status: 503, code: "hw_unavailable", message: "Hardware service offline" });
  });

  it.each([
    [{ kind: "projector.mains", on: false }, "Projector still draws 287 W · mains stays on until it cools"], // R11
    [{ kind: "ac.step", direction: "up" }, "Turn the air conditioning on first"], // Q5
    [{ kind: "projector.power", on: false }, "projector.power_off has no captured IR code"], // ir_code_missing
  ] as const)("%j → 409 %s", (body, message) => {
    expect(refusal(body)).toEqual({ status: 409, code: "precondition", message });
  });

  it("H8/H25: device offline and blaster offline", () => {
    const lights = must(live().state.zigbee.nodes.find((n) => n.friendly_name === "r101_lights"));
    expect(refusal({ kind: "lights.set", gang: "rear", on: true }, live(hwEvent("zigbee.node", { ...lights, online: false })))?.message).toBe("Lighting switch offline");
    expect(refusal({ kind: "ac.power", on: false }, live(hwEvent("ir.blaster", { online: false, lqi: null })))?.message).toBe("IR blaster offline");
  });

  it("AC power on without any captured setpoint frame", () => {
    const model = derive(applyHwEvent(bootModel({ acSetpoints: [] }), snapshotEvent()), new Date(T0), RULES);
    expect(refusal({ kind: "ac.power", on: true }, model)?.message).toBe("Air conditioning has no captured setpoint frame");
  });

  it("plans carry the output key, the transport timeout and the H6a text", () => {
    const lights = planCommand({ kind: "lights.set", gang: "front", on: false }, live(), CODES, TIMEOUTS);
    expect(lights.ok && { key: lights.plan.key, timeoutMs: lights.plan.timeoutMs, failureText: lights.plan.failureText, ir: lights.plan.ir })
      .toEqual({ key: "lights.front", timeoutMs: 5000, failureText: FAILURE_TEXT.zigbee, ir: false });
    const ac = planCommand({ kind: "ac.power", on: true }, live(), CODES, TIMEOUTS);
    expect(ac.ok && { key: ac.plan.key, timeoutMs: ac.plan.timeoutMs, failureText: ac.plan.failureText, ir: ac.plan.ir })
      .toEqual({ key: "ac", timeoutMs: 3000, failureText: "Couldn't reach the blaster", ir: true });
    const unmute = planCommand({ kind: "audio.mute_all", muted: false }, live(), CODES, TIMEOUTS);
    expect(unmute.ok && unmute.plan.calls.length).toBe(2); // nothing saved yet: no level restore
  });
});
