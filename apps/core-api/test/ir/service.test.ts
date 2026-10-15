import type { ServerEvent } from "@eduscope/contracts";
import { describe, expect, it } from "vitest";
import { fixedClock } from "../../src/clock.ts";
import { openDb } from "../../src/db/client.ts";
import type { LogEntry } from "../../src/db/event-log.ts";
import { findIrCommand } from "../../src/db/ir.ts";
import { seed } from "../../src/db/seed.ts";
import { applyHwEvent } from "../../src/domain/hw-events.ts";
import { createStateStore } from "../../src/domain/state-store.ts";
import type { IrLearnOutcome } from "../../src/hw/client.ts";
import { createIrService } from "../../src/ir/service.ts";
import { createRegistrySync } from "../../src/registry-sync.ts";
import { bootModel, fakeHw, hwEvent, must, RULES, snapshotEvent, T0, testConfig } from "../helpers.ts";

const TECH = { public_id: "pub-tech", label: "laptop" } as const;
const OLD_CODE = "C/8hRgHrBkYBgAMH"; // SEED_FAKE_IR_CODES: projector power on

async function setup() {
  const { db } = openDb(":memory:");
  await seed(db, testConfig({ SEED_FAKE_IR_CODES: "true" }), T0);
  const clock = fixedClock(T0);
  const store = createStateStore({ initial: bootModel(), clock, rules: RULES, coalesceMs: 0 });
  store.update((model) => applyHwEvent(model, snapshotEvent())); // hw up, blaster online
  const hw = fakeHw();
  const events: ServerEvent[] = [];
  const logs: LogEntry[] = [];
  let seq = 0;
  const ir = createIrService({
    db, store, hw, clock, emit: (event) => events.push(event), log: (entry) => logs.push(entry),
    sync: createRegistrySync(db, store), newId: () => `id-${++seq}`,
  });
  return { db, store, hw, events, logs, ir };
}

/** A learn answer the test releases later. */
function held(): { promise: Promise<IrLearnOutcome>; release: (outcome: IrLearnOutcome) => void } {
  let release: (outcome: IrLearnOutcome) => void = () => undefined;
  const promise = new Promise<IrLearnOutcome>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

const captureEvents = (events: ServerEvent[]) => events.flatMap((e) => (e.type === "ir_capture" ? [[e.command_id, e.status, e.deadline]] : []));

describe("IR learn (H21)", () => {
  it("listening with a 20 s deadline → captured: new code stored untested, list invalidated", async () => {
    const { db, hw, events, logs, ir } = await setup();
    ir.learn("projector.power_on", TECH);
    await ir.idle();
    expect(hw.calls).toEqual([{ method: "irLearn", body: { transport: "ir_zs06", timeout_s: 20 } }]);
    expect(captureEvents(events)).toEqual([
      ["projector.power_on", "listening", "2026-10-05T10:42:20.000Z"],
      ["projector.power_on", "captured", null],
    ]);
    expect(events.at(-1)).toEqual({ type: "invalidate", keys: [["ir", "devices"]] });
    expect(findIrCommand(db, "projector.power_on")).toMatchObject({ code: "Q0FQVFVSRUQ=", test: "untested", captured_at: T0 });
    expect(logs.at(-1)).toMatchObject({ type: "command", actor: "laptop", subject: "ir.learn", result: "captured" });
  });

  it.each([
    [{ status: "timeout" }, "timeout"],
    [{ status: "cancelled" }, "cancelled"],
    [{ status: "failed", message: "hw-service unreachable" }, "failed"],
  ] as const)("hw answers %j → %s, the old code is kept", async (outcome, status) => {
    const { db, hw, events, ir } = await setup();
    hw.nextLearns.push(outcome);
    ir.learn("projector.power_on", TECH);
    await ir.idle();
    expect(captureEvents(events).at(-1)).toEqual(["projector.power_on", status, null]);
    expect(events.some((e) => e.type === "invalidate")).toBe(false);
    expect(findIrCommand(db, "projector.power_on")?.code).toBe(OLD_CODE);
  });

  it("one capture per blaster: a second learn → 409 until the first ends", async () => {
    const { hw, ir } = await setup();
    const first = held();
    hw.nextLearns.push(first.promise);
    ir.learn("projector.power_on", TECH);
    expect(() => ir.learn("ac.setpoint_24", TECH)).toThrow(expect.objectContaining({ status: 409, code: "precondition", message: "Another capture is running" }));
    first.release({ status: "timeout" });
    await ir.idle();
    expect(() => ir.learn("ac.setpoint_24", TECH)).not.toThrow();
    await ir.idle();
  });

  it("cancel asks hw to stop and ends as cancelled even if hw still captured", async () => {
    const { db, hw, events, ir } = await setup();
    const pending = held();
    hw.nextLearns.push(pending.promise);
    ir.learn("projector.power_on", TECH);
    await ir.cancelLearn("projector.power_on");
    expect(hw.calls.map((c) => c.method)).toEqual(["irLearn", "irLearnCancel"]);
    pending.release({ status: "captured", code_format: "tuya", code: "TEFURQ==" });
    await ir.idle();
    expect(captureEvents(events).at(-1)).toEqual(["projector.power_on", "cancelled", null]);
    expect(findIrCommand(db, "projector.power_on")?.code).toBe(OLD_CODE);
    await ir.cancelLearn("projector.power_on"); // nothing running: no-op
    expect(hw.calls).toHaveLength(2);
  });

  it("refuses with hw down or the ZS06 offline (503), unknown command (404)", async () => {
    const { store, ir } = await setup();
    expect(() => ir.learn("nope", TECH)).toThrow(expect.objectContaining({ status: 404, code: "not_found" }));
    store.update((model) => applyHwEvent(model, hwEvent("ir.blaster", { online: false, lqi: null })));
    expect(() => ir.learn("projector.power_on", TECH)).toThrow(expect.objectContaining({ status: 503, message: "Couldn't reach the blaster" }));
    store.update((model) => ({ ...model, state: { ...model.state, connection: { hw: "down" } } }));
    expect(() => ir.learn("projector.power_on", TECH)).toThrow(expect.objectContaining({ status: 503, message: "Hardware service offline" }));
  });

  it("an ir_mcu device learns while the ZS06 is offline (R8)", async () => {
    const { store, hw, ir } = await setup();
    ir.updateDevice("projector", { transport: "ir_mcu" });
    store.update((model) => applyHwEvent(model, hwEvent("ir.blaster", { online: false, lqi: null })));
    ir.learn("projector.power_on", TECH);
    await ir.idle();
    expect(hw.calls).toEqual([{ method: "irLearn", body: { transport: "ir_mcu", timeout_s: 20 } }]);
  });

  it("R4: capturing a new 31° setpoint extends S1's range", async () => {
    const { store, ir } = await setup();
    const command = ir.createCommand("ac", { name: "31°", role: "setpoint", setpoint: { temp_c: 31, mode: "cool", fan: "auto" } });
    expect(store.get().environment.ac.available_setpoints.at(-1)).toBe(30);
    ir.learn(command.id, TECH);
    await ir.idle();
    expect(store.get().environment.ac.available_setpoints.at(-1)).toBe(31);
  });
});

describe("IR test (R5, H22)", () => {
  it("sends the stored code once, then records the answer", async () => {
    const { db, hw, events, ir } = await setup();
    await ir.test("projector.power_on", TECH);
    expect(hw.calls).toEqual([{ method: "irSend", body: { transport: "ir_zs06", code_format: "tuya", code: OLD_CODE } }]);
    expect(ir.recordTest("projector.power_on", true)).toMatchObject({ test: "reacted", tested_at: T0 });
    expect(ir.recordTest("projector.power_on", false)).toMatchObject({ test: "no_reaction" });
    expect(findIrCommand(db, "projector.power_on")?.test).toBe("no_reaction");
    expect(events.at(-1)).toEqual({ type: "invalidate", keys: [["ir", "devices"]] });
  });

  it("refuses a command without a code (409) and reports a refused send (503)", async () => {
    const { hw, ir } = await setup();
    const command = ir.createCommand("projector", { name: "Freeze", role: "other", setpoint: null });
    await expect(ir.test(command.id, TECH)).rejects.toMatchObject({ status: 409, message: "Nothing captured yet" });
    expect(() => ir.recordTest(command.id, true)).toThrow(expect.objectContaining({ status: 409 }));
    hw.nextAcks.push({ ok: false, error: { code: "device_offline", message: "r101_ir is offline" } });
    await expect(ir.test("projector.power_on", TECH)).rejects.toMatchObject({ status: 503, message: "Couldn't reach the blaster" });
  });
});

describe("IR devices and commands", () => {
  it("a new device joins the registry and both lists are invalidated", async () => {
    const { store, events, ir } = await setup();
    const device = ir.createDevice({ name: "Fan", brand: "Acme", kind: "other", transport: "ir_mcu" });
    expect(device.device_id).toBe("id-1");
    expect(store.get().devices.find((d) => d.id === "id-1")).toMatchObject({ name: "Fan", transport: "ir_mcu", kind: "other" });
    expect(events.at(-1)).toEqual({ type: "invalidate", keys: [["ir", "devices"], ["devices"]] });
    expect(ir.list().map((d) => d.name)).toEqual(["Air conditioning", "Fan", "Projector"]);
  });

  it("refuses a duplicate setpoint, an unknown device and removing a command that is capturing", async () => {
    const { hw, ir } = await setup();
    expect(() => ir.createCommand("ac", { name: "24 again", role: "setpoint", setpoint: { temp_c: 24, mode: "cool", fan: "auto" } })).toThrow(
      expect.objectContaining({ status: 409, message: "A 24° setpoint already exists" }),
    );
    expect(() => ir.createCommand("lights", { name: "x", role: "other", setpoint: null })).toThrow(expect.objectContaining({ status: 404 }));
    const pending = held();
    hw.nextLearns.push(pending.promise);
    ir.learn("projector.power_off", TECH);
    expect(() => ir.deleteCommand("projector.power_off")).toThrow(expect.objectContaining({ status: 409, message: "Cancel the capture first" }));
    pending.release({ status: "timeout" });
    await ir.idle();
  });

  it("R4: removing a captured setpoint shrinks S1's range", async () => {
    const { store, ir } = await setup();
    ir.deleteCommand("ac.setpoint_30");
    expect(store.get().environment.ac.available_setpoints.at(-1)).toBe(29);
    expect(must(ir.list()[0]).commands).toHaveLength(14);
  });
});
