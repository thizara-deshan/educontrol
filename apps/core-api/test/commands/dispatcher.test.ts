import { describe, expect, it } from "vitest";
import { CommandRejected, SCHEDULE_ISSUER } from "../../src/commands/dispatcher.ts";
import { applyHwDown } from "../../src/domain/hw-events.ts";
import { hwEvent, T0 } from "../helpers.ts";
import { LAPTOP, PHONE, room } from "./setup.ts";

describe("dispatcher outcomes", () => {
  it("assumed: AC power on sends the 24° frame; values become assumed (R3)", async () => {
    const r = room();
    const command = r.send({ kind: "ac.power", on: true });
    expect(command).toMatchObject({ status: "pending", issued_by: { public_id: "pub-phone", label: "phone" }, at: T0 });
    await expect.poll(() => r.statuses(command)).toEqual(["pending", "sent", "assumed"]);
    expect(r.hw.calls).toEqual([{ method: "irSend", body: { transport: "ir_zs06", code_format: "tuya", code: "AC-24" } }]);
    const { ac } = r.store.get().environment;
    expect(ac.power).toMatchObject({ value: "on", confidence: "assumed", changed_by: "phone" });
    expect(ac.setpoint_c.value).toBe(24);
    expect(r.activities()).toEqual(["Air conditioning turned on · phone"]);
    expect(r.logs).toEqual([expect.objectContaining({ type: "command", actor: "phone", subject: "ac.power", result: "assumed" })]);
  });

  it("assumed: AC + steps to the next captured setpoint (R4)", async () => {
    const r = room();
    const on = r.send({ kind: "ac.power", on: true });
    await expect.poll(() => r.statuses(on).at(-1)).toBe("assumed");
    const step = r.send({ kind: "ac.step", direction: "up" });
    await expect.poll(() => r.statuses(step).at(-1)).toBe("assumed");
    expect(r.hw.calls.at(-1)?.body).toMatchObject({ code: "AC-26" }); // 25 never captured
    expect(r.store.get().environment.ac.setpoint_c.value).toBe(26);
  });

  it("assumed: projector power on waits for draw (H7b) and never confirms by IR (R2)", async () => {
    const r = room();
    r.report(hwEvent("projector_power.reading", { watts: 3, volts: 231, energy_kwh_total: 412.7 }));
    const command = r.send({ kind: "projector.power", on: true });
    expect(r.store.get().display.projector.feedback).toEqual({ last_ir: "power_on", sent_at: T0, phase: "waiting_for_draw" });
    await expect.poll(() => r.statuses(command)).toEqual(["pending", "sent", "assumed"]);
    expect(r.store.get().display.projector.state.value).toBe("standby");
    r.report(hwEvent("projector_power.reading", { watts: 24, volts: 231, energy_kwh_total: 412.7 }));
    expect(r.store.get().display.projector.state.value).toBe("warming_up");
    expect(r.store.get().display.projector.feedback.phase).toBe("idle");
  });

  it("assumed: projector power off sends the frame, pauses, and sends it again to confirm the Epson prompt", async () => {
    const r = room();
    const command = r.send({ kind: "projector.power", on: false });
    await expect.poll(() => r.hw.calls.length).toBe(1);
    expect(r.statuses(command)).toEqual(["pending"]);
    await expect.poll(() => r.statuses(command)).toEqual(["pending", "sent", "assumed"]);
    const off = { method: "irSend", body: { transport: "ir_zs06", code_format: "tuya", code: "OFF" } };
    expect(r.hw.calls).toEqual([off, off]);
  });

  it("projector power off superseded during the pause: the confirming frame is not sent", async () => {
    const r = room();
    const off = r.send({ kind: "projector.power", on: false });
    await expect.poll(() => r.hw.calls.length).toBe(1);
    const on = r.send({ kind: "projector.power", on: true });
    await expect.poll(() => r.statuses(on).at(-1)).toBe("assumed");
    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(r.hw.calls.map((c) => c.body)).toEqual([expect.objectContaining({ code: "OFF" }), expect.objectContaining({ code: "ON" })]);
    expect(r.statuses(off)).toEqual(["pending", "assumed"]);
  });

  it("failed: hw refuses → H6a text per transport; projector feedback is reverted", async () => {
    const r = room();
    r.hw.nextAcks.push({ ok: false, error: { code: "device_offline", message: "r101_lights is offline" } });
    const lights = r.send({ kind: "lights.set", gang: "front", on: false });
    await expect.poll(() => r.statuses(lights)).toEqual(["pending", "failed"]);
    expect(r.events.find((e) => e.type === "command" && e.command.status === "failed")).toMatchObject({ command: { error: "Switch didn't respond" } });

    r.report(hwEvent("projector_power.reading", { watts: 3, volts: 231, energy_kwh_total: 412.7 }));
    r.hw.nextAcks.push({ ok: false, error: { code: "transport", message: "hw-service unreachable" } });
    const projector = r.send({ kind: "projector.power", on: true });
    await expect.poll(() => r.statuses(projector).at(-1)).toBe("failed");
    expect(r.events.findLast((e) => e.type === "command")).toMatchObject({ command: { error: "Couldn't reach the blaster" } });
    expect(r.store.get().display.projector.feedback.phase).toBe("idle");
    expect(r.activities()).toEqual([]);
  });

  it("timed_out: no read-back within the transport timeout; a hw timeout ack too", async () => {
    const r = room();
    const silent = r.send({ kind: "lights.set", gang: "rear", on: true });
    await expect.poll(() => r.statuses(silent)).toEqual(["pending", "sent", "timed_out"]);
    r.hw.nextAcks.push({ ok: false, error: { code: "timeout", message: "no answer" } });
    const slow = r.send({ kind: "screen.move", to: "raise" });
    await expect.poll(() => r.statuses(slow)).toEqual(["pending", "timed_out"]);
    expect(r.dispatcher.inflightCount()).toBe(0);
  });

  it("hw down: 503 hw_unavailable, no command, no hw call (§6.7)", () => {
    const r = room();
    r.store.update((model, at) => applyHwDown(model, at));
    expect(() => r.send({ kind: "lights.set", gang: "rear", on: true })).toThrow(
      expect.objectContaining({ status: 503, code: "hw_unavailable", message: "Hardware service offline" }),
    );
    expect(r.hw.calls).toEqual([]);
    expect(r.events.filter((e) => e.type === "command")).toEqual([]);
  });

  it("last write wins: a newer command on the same output supersedes the older one quietly", () => {
    const r = room();
    const first = r.send({ kind: "lights.set", gang: "rear", on: true }, PHONE);
    const second = r.send({ kind: "lights.set", gang: "rear", on: false }, LAPTOP);
    expect(r.statuses(first)).toEqual(["pending", "assumed"]); // no longer awaited, no toast
    expect(r.statuses(second)).toEqual(["pending"]);
    expect(r.dispatcher.inflightCount()).toBe(1);
    expect(r.activities()).toEqual([]);
  });

  it("access: projector mains as control → 403 CommandRejected", () => {
    const r = room();
    expect(() => r.send({ kind: "projector.mains", on: true }, PHONE)).toThrow(CommandRejected);
    expect(() => r.send({ kind: "projector.mains", on: true }, PHONE)).toThrow(expect.objectContaining({ status: 403, code: "forbidden" }));
  });
});

describe("schedule as issuer (§6.8)", () => {
  it("issued_by null, attribution 'schedule' on the value and the activity, logged as schedule", async () => {
    const r = room();
    r.echo((method) => (method === "lightsSet" ? hwEvent("lights.state", { gang: "rear", on: false }) : null));
    r.report(hwEvent("lights.state", { gang: "rear", on: true }));
    const command = r.send({ kind: "lights.set", gang: "rear", on: false }, SCHEDULE_ISSUER);
    expect(command.issued_by).toBeNull();
    await expect.poll(() => r.statuses(command).at(-1)).toBe("confirmed");
    expect(r.store.get().environment.lights.rear).toMatchObject({ value: false, changed_by: "schedule" });
    expect(r.events.filter((e) => e.type === "activity").at(-1)).toEqual({
      type: "activity", text: "Rear of room turned off", by: "schedule", public_id: null,
    });
    expect(r.logs.at(-1)).toMatchObject({ type: "command", actor: "schedule", public_id: null, result: "confirmed" });
  });

  it("may run technician kinds", () => {
    const r = room();
    r.report(hwEvent("projector_power.reading", { watts: 0, volts: 231, energy_kwh_total: 412.7 }));
    expect(() => r.send({ kind: "projector.mains", on: false }, SCHEDULE_ISSUER)).not.toThrow();
  });
});
