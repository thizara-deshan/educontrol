import { randomUUID } from "node:crypto";
import type {
  ClientLabel, IrCaptureStatus, IrCommand, IrCommandCreate, IrDevice, IrDeviceCreate, IrDeviceUpdate, IrTransport, ServerEvent,
} from "@eduscope/contracts";
import type { Clock } from "../clock.ts";
import type { Db } from "../db/client.ts";
import type { EventLogger } from "../db/event-log.ts";
import {
  createIrCommand, createIrDevice, deleteIrCommand, findIrCommand, findIrDevice, listIrDevices, storeCapture, storeTestResult,
  updateIrDevice, type IrCommandRow,
} from "../db/ir.ts";
import { duplicateSetpoint, IR_CAPTURE_WINDOW_S } from "../domain/ir.ts";
import type { StateStore } from "../domain/state-store.ts";
import { ApiFailure } from "../errors.ts";
import type { HwClient, IrLearnOutcome } from "../hw/client.ts";
import type { RegistrySync } from "../registry-sync.ts";

// S3 Remote configuration (ARCHITECTURE §6.9, H20–H22, H25, R4, R5). Learn answers at once (202);
// the hw call runs in the background, one capture per blaster, and reports through `ir_capture`.
// A new code replaces the old one only when the capture succeeds. Codes never leave core-api
// except to hw-service.

/** Who asked (for the event log). */
export interface IrActor {
  public_id: string | null;
  label: ClientLabel;
}

export interface IrService {
  list(): IrDevice[];
  createDevice(input: IrDeviceCreate): IrDevice;
  updateDevice(id: string, patch: IrDeviceUpdate): IrDevice;
  createCommand(deviceId: string, input: IrCommandCreate): IrCommand;
  deleteCommand(id: string): void;
  /** Starts a capture (H21) or throws 404 / 409 / 503. Progress arrives as `ir_capture`. */
  learn(id: string, actor: IrActor): void;
  /** Ends this command's capture as `cancelled`; a no-op when it is not capturing. */
  cancelLearn(id: string): Promise<void>;
  /** Sends the stored code once (R5); the technician answers with recordTest. */
  test(id: string, actor: IrActor): Promise<void>;
  recordTest(id: string, reacted: boolean): IrCommand;
  /** Resolves when every running capture has finished (tests). */
  idle(): Promise<void>;
}

interface Capture {
  commandId: string;
  cancelled: boolean;
  done: Promise<void>;
}

const IR_KEYS = [["ir", "devices"]];
const IR_AND_REGISTRY_KEYS = [["ir", "devices"], ["devices"]];

const notFound = (what: string): ApiFailure => new ApiFailure(404, "not_found", `${what} not found`);
const precondition = (message: string): ApiFailure => new ApiFailure(409, "precondition", message);

export function createIrService(deps: {
  db: Db;
  store: StateStore;
  hw: HwClient;
  clock: Clock;
  emit: (event: ServerEvent) => void;
  log: EventLogger;
  sync: RegistrySync;
  newId?: () => string;
}): IrService {
  const { db, store, hw, clock, emit, log, sync } = deps;
  const newId = deps.newId ?? randomUUID;
  const captures = new Map<IrTransport, Capture>(); // one per blaster
  const invalidate = (keys: string[][]): void => emit({ type: "invalidate", keys });

  const commandOrThrow = (id: string): { row: IrCommandRow; device: IrDevice } => {
    const row = findIrCommand(db, id);
    const device = row === null ? null : findIrDevice(db, row.device_id);
    if (row === null || device === null) throw notFound("Command");
    return { row, device };
  };

  /** H25 + §6.7: hw must be up; the ZS06 must be online (ir_mcu codes go out on the ESP32, R8). */
  const requireBlaster = (transport: IrTransport): void => {
    const state = store.get();
    if (state.connection.hw === "down") throw new ApiFailure(503, "hw_unavailable", "Hardware service offline");
    if (transport === "ir_zs06" && state.ir_blaster.online.value !== true) throw new ApiFailure(503, "hw_unavailable", "Couldn't reach the blaster");
  };

  const capturing = (commandId: string): Capture | undefined => [...captures.values()].find((capture) => capture.commandId === commandId);

  /** The capture's end state; stores the code only for a capture that was not cancelled. */
  const settle = (capture: Capture, outcome: IrLearnOutcome): IrCaptureStatus => {
    if (capture.cancelled) return "cancelled";
    if (outcome.status !== "captured") return outcome.status;
    const stored = storeCapture(db, capture.commandId, outcome.code, clock.now().toISOString());
    if (stored === null) return "failed"; // removed while listening
    if (stored.role === "setpoint") sync.acSetpoints(); // R4
    return "captured";
  };

  async function run(capture: Capture, transport: IrTransport, actor: IrActor): Promise<void> {
    const outcome = await hw.irLearn({ transport, timeout_s: IR_CAPTURE_WINDOW_S });
    captures.delete(transport);
    const status = settle(capture, outcome);
    emit({ type: "ir_capture", command_id: capture.commandId, status, deadline: null });
    if (status === "captured") invalidate(IR_KEYS);
    log({ type: "command", actor: actor.label, public_id: actor.public_id, subject: "ir.learn", payload: { command_id: capture.commandId }, result: status });
  }

  return {
    list: () => listIrDevices(db),
    createDevice(input) {
      const device = createIrDevice(db, newId(), input);
      sync.registry();
      invalidate(IR_AND_REGISTRY_KEYS);
      return device;
    },
    updateDevice(id, patch) {
      const device = updateIrDevice(db, id, patch);
      if (device === null) throw notFound("Device");
      sync.registry();
      invalidate(IR_AND_REGISTRY_KEYS);
      return device;
    },
    createCommand(deviceId, input) {
      const device = findIrDevice(db, deviceId);
      if (device === null) throw notFound("Device");
      const duplicate = input.setpoint === null ? null : duplicateSetpoint(device.commands, input.setpoint.temp_c);
      if (duplicate !== null) throw precondition(duplicate);
      const command = createIrCommand(db, newId(), deviceId, input);
      invalidate(IR_KEYS);
      return command;
    },
    deleteCommand(id) {
      const { row } = commandOrThrow(id);
      if (capturing(id) !== undefined) throw precondition("Cancel the capture first");
      deleteIrCommand(db, id);
      if (row.role === "setpoint") sync.acSetpoints(); // R4
      invalidate(IR_KEYS);
    },
    learn(id, actor) {
      const { device } = commandOrThrow(id);
      requireBlaster(device.transport);
      if (captures.has(device.transport)) throw precondition("Another capture is running");
      const deadline = new Date(clock.now().getTime() + IR_CAPTURE_WINDOW_S * 1000).toISOString();
      const capture: Capture = { commandId: id, cancelled: false, done: Promise.resolve() };
      captures.set(device.transport, capture);
      emit({ type: "ir_capture", command_id: id, status: "listening", deadline });
      capture.done = run(capture, device.transport, actor);
    },
    async cancelLearn(id) {
      const capture = capturing(id);
      if (capture === undefined || capture.cancelled) return;
      capture.cancelled = true;
      await hw.irLearnCancel(); // best effort: the learn call ends by itself at its deadline
    },
    async test(id, actor) {
      const { row, device } = commandOrThrow(id);
      if (row.code === null) throw precondition("Nothing captured yet");
      requireBlaster(device.transport);
      if (captures.has(device.transport)) throw precondition("Another capture is running");
      const ack = await hw.irSend({ transport: device.transport, code_format: "tuya", code: row.code });
      log({ type: "command", actor: actor.label, public_id: actor.public_id, subject: "ir.test", payload: { command_id: id }, result: ack.ok ? "sent" : "failed" });
      if (!ack.ok) throw new ApiFailure(503, "hw_unavailable", "Couldn't reach the blaster");
    },
    recordTest(id, reacted) {
      const { row } = commandOrThrow(id);
      if (row.code === null) throw precondition("Nothing captured yet");
      const command = storeTestResult(db, id, reacted, clock.now().toISOString());
      if (command === null) throw notFound("Command");
      invalidate(IR_KEYS);
      return command;
    },
    async idle() {
      await Promise.all([...captures.values()].map((capture) => capture.done));
    },
  };
}
