import type { HwPlugStateData } from "@eduscope/contracts";
import { describe, expect, it } from "vitest";
import { planCommand, requiredAccess } from "../../src/commands/policies.ts";
import { derive } from "../../src/domain/derive.ts";
import { applyHwDown, applyHwEvent } from "../../src/domain/hw-events.ts";
import { initialModel } from "../../src/domain/initial.ts";
import { applyPlugReport } from "../../src/domain/plug.ts";
import { bootModel, hwEvent, RULES, snapshotEvent, T0 } from "../helpers.ts";
import { room } from "../commands/setup.ts";

// D-34: the general-purpose smart plug (hw `plug`, RoomState.plug, command `plug.set`).

const T1 = "2026-10-05T10:43:00Z";
const ON: HwPlugStateData = { online: true, on: true, watts: 42.5, volts: 231.2, amps: 0.21, kwh_today: 0.34 };
const TIMEOUTS = { zigbeeMs: 5000, irSendMs: 3000, irLearnMs: 25_000, hdmiMs: 5000, mixerMs: 2000, screenMs: 5000, projectorOffConfirmMs: 2000 };
const NO_IR = { find: () => ({ ok: false as const, message: "none" }) };

describe("applyPlugReport", () => {
  const boot = bootModel({ acSetpoints: [] }).state;

  it("starts unknown and offline", () => {
    expect(boot.plug).toMatchObject({ on: { value: null, confidence: "unknown", source: "switch" }, online: false });
    expect(boot.plug.reading).toMatchObject({ value: null, source: "power_meter" });
  });

  it("a report confirms on/off and the meter", () => {
    const plug = applyPlugReport(boot, ON, T1).plug;
    expect(plug.on).toMatchObject({ value: true, confidence: "confirmed", updated_at: T1 });
    expect(plug.reading).toMatchObject({ value: { watts: 42.5, volts: 231.2, amps: 0.21, kwh_today: 0.34 }, confidence: "confirmed" });
    expect(plug.online).toBe(true);
  });

  it("an availability-only report keeps the last values; null changes nothing", () => {
    const seen = applyPlugReport(boot, ON, T1);
    const offline = applyPlugReport(seen, { online: false, on: null, watts: null, volts: null, amps: null, kwh_today: null }, T1);
    expect(offline.plug).toEqual({ ...seen.plug, online: false });
    expect(applyPlugReport(seen, null, T1)).toBe(seen);
  });
});

describe("plug in the hw stream", () => {
  it("the snapshot and plug.state events land in RoomState.plug", () => {
    const live = applyHwEvent(bootModel({ acSetpoints: [] }), snapshotEvent());
    expect(live.state.plug).toMatchObject({ online: true, on: { value: true } });
    const off = applyHwEvent(live, hwEvent("plug.state", { ...ON, on: false, watts: 0 }, T1));
    expect(off.state.plug.on.value).toBe(false);
    expect(off.state.plug.reading.value?.watts).toBe(0);
  });

  it("after the hw grace the plug is offline and its values greyed (H8)", () => {
    const live = applyHwEvent(bootModel({ acSetpoints: [] }), snapshotEvent());
    const down = applyHwDown(live, T0);
    const later = derive(down, new Date(Date.parse(T0) + RULES.hwDownGraceMs), RULES).state.plug;
    expect(later.online).toBe(false);
    expect([later.on.stale, later.reading.stale]).toEqual([true, true]);
  });
});

describe("plug.set", () => {
  const live = () => derive(applyHwEvent(bootModel({ acSetpoints: [] }), snapshotEvent()), new Date(T0), RULES);

  it("needs control access, like the lights", () => {
    expect(requiredAccess({ kind: "plug.set", on: false })).toBe("control");
  });

  it("is refused while the plug is offline", () => {
    const offline = applyHwEvent(live(), hwEvent("plug.state", { ...ON, online: false }));
    const result = planCommand({ kind: "plug.set", on: false }, offline, NO_IR, TIMEOUTS);
    expect(result).toEqual({ ok: false, status: 409, code: "precondition", message: "Smart plug offline" });
  });

  it("plans one zigbee call keyed 'plug'", () => {
    const result = planCommand({ kind: "plug.set", on: false }, live(), NO_IR, TIMEOUTS);
    expect(result.ok && { key: result.plan.key, ir: result.plan.ir, timeoutMs: result.plan.timeoutMs }).toEqual({ key: "plug", ir: false, timeoutMs: 5000 });
  });

  it("is confirmed by the plug's report and attributed to the sender", async () => {
    const r = room();
    r.echo((method, body) => (method === "plugSet" && typeof body === "object" && body !== null && "on" in body && typeof body.on === "boolean"
      ? hwEvent("plug.state", { ...ON, on: body.on, watts: body.on ? 42.5 : 0 })
      : null));
    const command = r.send({ kind: "plug.set", on: false });
    await expect.poll(() => r.statuses(command).at(-1)).toBe("confirmed");
    expect(r.hw.calls).toEqual([{ method: "plugSet", body: { on: false } }]);
    expect(r.store.get().plug.on).toMatchObject({ value: false, changed_by: "phone" });
    expect(r.activities()).toEqual(["Smart plug turned off · phone"]);
  });

  it("a change by the plug's own button is 'by hand'", () => {
    const r = room();
    r.report(hwEvent("plug.state", { ...ON, on: false }));
    expect(r.store.get().plug.on).toMatchObject({ value: false, changed_by: "by hand" });
    expect(r.activities()).toEqual(["Smart plug turned off · by hand"]);
  });
});

describe("initialModel", () => {
  it("has the plug section", () => {
    const model = initialModel({
      room: { id: "R-101", hostname: "r-101" }, registry: [], acSetpoints: [], interlockBypassed: false, kwhBaseline: null, now: T0,
    });
    expect(model.state.plug.online).toBe(false);
  });
});
