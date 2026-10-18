import type { CommandBody, HwEvent } from "@eduscope/contracts";
import { describe, expect, it } from "vitest";
import type { IrCodeLookup } from "../../src/commands/ir-codes.ts";
import { FAILURE_TEXT, planCommand, requiredAccess } from "../../src/commands/policies.ts";
import { derive } from "../../src/domain/derive.ts";
import { applyHwDown, applyHwEvent } from "../../src/domain/hw-events.ts";
import type { RoomModel } from "../../src/domain/model.ts";
import { bootModel, fakeHw, hwEvent, must, RULES, snapshotEvent, T0 } from "../helpers.ts";

const TIMEOUTS = { zigbeeMs: 5000, irSendMs: 3000, irLearnMs: 25_000, hdmiMs: 5000, mixerMs: 2000, screenMs: 5000, projectorOffConfirmMs: 2000 };

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

  it("projector power off: the frame twice with the Epson confirm pause; power on once", () => {
    const codes = ir({ "projector.power_on": "ON", "projector.power_off": "OFF" });
    const off = planCommand({ kind: "projector.power", on: false }, live(), codes, TIMEOUTS);
    expect(off.ok && { calls: off.plan.calls.length, gapMs: off.plan.gapMs, timeoutMs: off.plan.timeoutMs }).toEqual({ calls: 2, gapMs: 2000, timeoutMs: 8000 });
    const on = planCommand({ kind: "projector.power", on: true }, live(), codes, TIMEOUTS);
    expect(on.ok && { calls: on.plan.calls.length, gapMs: on.plan.gapMs }).toEqual({ calls: 1, gapMs: undefined });
  });

  it("H8/H25: device offline and blaster offline", () => {
    const lights = must(live().state.zigbee.nodes.find((n) => n.friendly_name === "r101_lights"));
    expect(refusal({ kind: "lights.set", gang: "rear", on: true }, live(hwEvent("zigbee.node", { ...lights, online: false })))?.message).toBe("Lighting switch offline");
    expect(refusal({ kind: "ac.power", on: false }, live(hwEvent("ir.blaster", { online: false, lqi: null })))?.message).toBe("IR blaster offline");
  });

  it("AC power on without a captured power-on or setpoint frame", () => {
    const model = derive(applyHwEvent(bootModel({ acSetpoints: [] }), snapshotEvent()), new Date(T0), RULES);
    expect(refusal({ kind: "ac.power", on: true }, model)?.message).toBe("Air conditioning has no captured power-on or setpoint frame");
  });

  describe("AC power on (D-26)", () => {
    const WITH_POWER_ON = ir({ "ac.power_on": "AC-ON", "ac.power_off": "AC-OFF", "ac.setpoint_24": "AC-24", "ac.setpoint_26": "AC-26" });
    const sentCode = async (codes: IrCodeLookup): Promise<{ code: unknown; ac: ReturnType<typeof acAfter> }> => {
      const plan = planCommand({ kind: "ac.power", on: true }, live(), codes, TIMEOUTS);
      if (!plan.ok) throw new Error(plan.message);
      const hw = fakeHw();
      await plan.plan.calls[0]?.(hw);
      const body = hw.calls[0]?.body;
      return { code: typeof body === "object" && body !== null && "code" in body ? body.code : null, ac: acAfter(plan.plan, live()) };
    };
    const acAfter = (plan: { after?: (m: RoomModel, at: string, by: "phone") => RoomModel }, model: RoomModel) =>
      must(plan.after?.(model, T0, "phone")).state.environment.ac;

    it("sends the captured Power on code and leaves the setpoint as it was", async () => {
      const { code, ac } = await sentCode(WITH_POWER_ON);
      expect(code).toBe("AC-ON");
      expect(ac.power).toMatchObject({ value: "on", confidence: "assumed", changed_by: "phone" });
      expect(ac.setpoint_c).toEqual(live().state.environment.ac.setpoint_c);
    });

    it("falls back to the setpoint frame, which also sets the setpoint", async () => {
      const { code, ac } = await sentCode(CODES);
      expect(code).toMatch(/^AC-2[46]$/);
      expect(ac.power).toMatchObject({ value: "on", confidence: "assumed" });
      expect(ac.setpoint_c).toMatchObject({ confidence: "assumed" });
    });

    it("Power on code alone is enough, and − / + stay refused while the setpoint is unknown", () => {
      const onlyPowerOn = ir({ "ac.power_on": "AC-ON" });
      expect(refusal({ kind: "ac.power", on: true }, live(), onlyPowerOn)).toBeNull();
      expect(refusal({ kind: "ac.step", direction: "up" })?.message).toBe("Turn the air conditioning on first");
    });

    it("Power off is unchanged", () => {
      expect(refusal({ kind: "ac.power", on: false }, live(), WITH_POWER_ON)).toBeNull();
    });
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
