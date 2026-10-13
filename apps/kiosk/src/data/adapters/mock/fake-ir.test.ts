import type { RoomState, ServerEvent } from "@eduscope/contracts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FakeRoom, MOCK_LATENCY_MAX_MS } from "./fake-room";
import { IR_CAPTURE_WINDOW_MS, MOCK_CAPTURE_MS } from "./fake-ir";

function connected() {
  const room = new FakeRoom({ random: () => 1 });
  const events: ServerEvent[] = [];
  room.connect("laptop", { onOpen: vi.fn(), onEvent: (e: ServerEvent) => events.push(e), onClose: vi.fn() });
  vi.advanceTimersByTime(MOCK_LATENCY_MAX_MS);
  const last = (): RoomState => {
    const found = events.findLast((e) => e.type === "state" || e.type === "snapshot");
    if (found === undefined || (found.type !== "state" && found.type !== "snapshot")) throw new Error("no state");
    return found.state;
  };
  const captures = () => events.flatMap((e) => (e.type === "ir_capture" ? [e] : []));
  /** Runs a mock call through its latency. */
  const settle = async <T>(promise: Promise<T>): Promise<T> => {
    await vi.advanceTimersByTimeAsync(MOCK_LATENCY_MAX_MS);
    return promise;
  };
  return { room, events, last, captures, settle };
}

describe("FakeIr (S3, H20–H22, H25)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-13T09:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("lists the registry's IR devices with their seeded commands (screenshot 03)", async () => {
    const { room, settle } = connected();
    const devices = await settle(room.ir.listDevices());
    expect(devices.map((d) => [d.name, d.brand, d.transport, d.commands.length])).toEqual([
      ["Air conditioning", "Panasonic", "ir_zs06", 14],
      ["Projector", "Epson", "ir_zs06", 2],
    ]);
    expect(devices[1]?.commands.map((c) => [c.name, c.captured, c.test, c.tested_at])).toEqual([
      ["Power on", true, "reacted", null],
      ["Power off", true, "reacted", null],
    ]);
  });

  it("creates a device in the registry and invalidates both lists (S3.E9)", async () => {
    const { room, events, last, settle } = connected();
    const created = await settle(room.ir.createDevice({ name: "Screen relay", brand: "Generic", kind: "other", transport: "ir_mcu" }));
    expect(created).toMatchObject({ name: "Screen relay", brand: "Generic", kind: "other", transport: "ir_mcu", commands: [] });
    expect(last().devices.at(-1)).toMatchObject({ id: created.device_id, kind: "other", transport: "ir_mcu", brand: "Generic" });
    expect(events).toContainEqual({ type: "invalidate", keys: [["ir", "devices"], ["devices"]] });
  });

  it("a new command starts not captured and untested (S3.E16)", async () => {
    const { room, settle } = connected();
    const command = await settle(
      room.ir.createCommand("ac", { name: "25°", role: "setpoint", setpoint: { temp_c: 25, mode: "cool", fan: "auto" } }),
    );
    expect(command).toMatchObject({ device_id: "ac", captured: false, test: "untested", captured_at: null });
  });

  it("learn: listening with a 20 s deadline, then captured + untested after 3 s (H21, R5)", async () => {
    const { room, captures, settle } = connected();
    await settle(room.ir.learn("ir-proj-on"));
    expect(captures().at(-1)).toEqual({
      type: "ir_capture", command_id: "ir-proj-on", status: "listening",
      deadline: new Date(Date.now() + IR_CAPTURE_WINDOW_MS).toISOString(),
    });
    await vi.advanceTimersByTimeAsync(MOCK_CAPTURE_MS);
    expect(captures().at(-1)).toMatchObject({ status: "captured", deadline: null });
    const projector = (await settle(room.ir.listDevices()))[1];
    expect(projector?.commands[0]).toMatchObject({ captured: true, test: "untested", tested_at: null });
  });

  it("panel 'nothing received': the next capture times out and the old code is kept (H21)", async () => {
    const { room, captures, settle } = connected();
    room.ir.captureNothingNext();
    await settle(room.ir.learn("ir-proj-on"));
    await vi.advanceTimersByTimeAsync(MOCK_CAPTURE_MS);
    expect(captures().at(-1)).toMatchObject({ status: "timeout" });
    const projector = (await settle(room.ir.listDevices()))[1];
    expect(projector?.commands[0]).toMatchObject({ captured: true, test: "reacted" });
  });

  it("cancel ends the capture without changing the code", async () => {
    const { room, captures, settle } = connected();
    await settle(room.ir.learn("ir-proj-on"));
    await settle(room.ir.cancelLearn("ir-proj-on"));
    expect(captures().at(-1)).toMatchObject({ status: "cancelled" });
    await vi.advanceTimersByTimeAsync(MOCK_CAPTURE_MS);
    expect(captures().at(-1)).toMatchObject({ status: "cancelled" });
  });

  it("a captured setpoint joins the AC's available setpoints (R4)", async () => {
    const { room, last, settle } = connected();
    const command = await settle(
      room.ir.createCommand("ac", { name: "16°", role: "setpoint", setpoint: { temp_c: 16, mode: "cool", fan: "auto" } }),
    );
    await settle(room.ir.learn(command.id));
    await vi.advanceTimersByTimeAsync(MOCK_CAPTURE_MS);
    expect(last().environment.ac.available_setpoints.slice(0, 2)).toEqual([16, 18]);
  });

  it("recordTest stores reacted / no_reaction with the time (H22)", async () => {
    const { room, settle } = connected();
    await settle(room.ir.test("ir-proj-on"));
    expect(await settle(room.ir.recordTest("ir-proj-on", false))).toMatchObject({ test: "no_reaction", tested_at: new Date().toISOString() });
    expect(await settle(room.ir.recordTest("ir-proj-on", true))).toMatchObject({ test: "reacted" });
  });

  it("blaster offline: learn and test on ZS06 devices fail with hw_unavailable (H25)", async () => {
    const { room, settle } = connected();
    room.toggleDeviceOffline("ir_blaster");
    const learn = room.ir.learn("ir-proj-on").catch((e: unknown) => e);
    const test = room.ir.test("ir-proj-on").catch((e: unknown) => e);
    expect(await settle(learn)).toMatchObject({ code: "hw_unavailable" });
    expect(await settle(test)).toMatchObject({ code: "hw_unavailable", message: "Couldn't reach the blaster" });
  });

  it("an MCU device still learns while the blaster is offline (R8)", async () => {
    const { room, captures, settle } = connected();
    const device = await settle(room.ir.createDevice({ name: "Screen relay", brand: "Generic", kind: "other", transport: "ir_mcu" }));
    const command = await settle(room.ir.createCommand(device.device_id, { name: "Lower", role: "other", setpoint: null }));
    room.toggleDeviceOffline("ir_blaster");
    await settle(room.ir.learn(command.id));
    expect(captures().at(-1)).toMatchObject({ command_id: command.id, status: "listening" });
  });

  it("test refuses a command that was never captured", async () => {
    const { room, settle } = connected();
    const command = await settle(room.ir.createCommand("projector", { name: "Freeze", role: "other", setpoint: null }));
    const test = room.ir.test(command.id).catch((e: unknown) => e);
    expect(await settle(test)).toMatchObject({ code: "precondition" });
  });
});
