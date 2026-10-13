import {
  IrCommandCreate, IrDeviceCreate, type Device, type IrCommand, type IrDevice, type IrDeviceKind,
} from "@eduscope/contracts";
import { ApiRequestError } from "@/data/api-client";
import type { MockHost } from "./mock-host";

// S3 Remote configuration in the mock (ARCHITECTURE §6.9). IR devices ARE the registry devices
// whose transport is ir_* (so S3d renames and transport changes show here); this store keeps
// their commands. Codes never exist in the mock: the kiosk only ever sees `captured`.

/** H21: the capture window the row counts down. */
export const IR_CAPTURE_WINDOW_MS = 20_000;
/** Milestone: the mock "hears" the remote this long after Learn. */
export const MOCK_CAPTURE_MS = 3_000;
const SEEDED_AT = "2026-10-01T09:00:00.000Z";
const AC_SETPOINTS = [18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30] as const;

/**
 * Screenshot 03: every seeded code is captured and was tested before this system kept test
 * times (`reacted`, `tested_at: null` → "Tuya code · captured"). Projector 2, AC 14 (Q23).
 */
function seededCommands(): IrCommand[] {
  const base = { code_format: "tuya" as const, captured: true, captured_at: SEEDED_AT, test: "reacted" as const, tested_at: null };
  return [
    { ...base, id: "ir-proj-on", device_id: "projector", name: "Power on", role: "power_on", setpoint: null },
    { ...base, id: "ir-proj-off", device_id: "projector", name: "Power off", role: "power_off", setpoint: null },
    { ...base, id: "ir-ac-off", device_id: "ac", name: "Power off", role: "power_off", setpoint: null },
    ...AC_SETPOINTS.map((temp_c): IrCommand => ({
      ...base, id: `ir-ac-${temp_c}`, device_id: "ac", name: `${temp_c}°`, role: "setpoint",
      setpoint: { temp_c, mode: "cool", fan: "auto" },
    })),
  ];
}

const irKind = (device: Device): IrDeviceKind => (device.kind === "projector" || device.kind === "ac" ? device.kind : "other");

/** Registry devices with an IR transport, by name (screenshot 03: Air conditioning, Projector), each with its commands. */
export function irDevicesFrom(devices: readonly Device[], commands: readonly IrCommand[]): IrDevice[] {
  const byName = [...devices].sort((a, b) => a.name.localeCompare(b.name));
  return byName.flatMap((device): IrDevice[] =>
    device.transport === "ir_zs06" || device.transport === "ir_mcu"
      ? [{
          device_id: device.id, name: device.name, brand: device.brand ?? "", kind: irKind(device),
          transport: device.transport, commands: commands.filter((command) => command.device_id === device.id),
        }]
      : [],
  );
}

interface ActiveCapture {
  commandId: string;
  timer: ReturnType<typeof setTimeout>;
}

export class FakeIr {
  private commands: IrCommand[] = seededCommands();
  private active: ActiveCapture | null = null;
  private nothingNext = false;
  private seq = 0;

  constructor(private readonly host: MockHost) {}

  async listDevices(): Promise<IrDevice[]> {
    await this.host.delay();
    return irDevicesFrom(this.host.state().devices, this.commands);
  }

  async createDevice(input: IrDeviceCreate): Promise<IrDevice> {
    const parsed = IrDeviceCreate.parse(input);
    await this.host.delay();
    const state = this.host.state();
    const device: Device = {
      id: `mock-dev-${++this.seq}`, name: parsed.name, kind: parsed.kind, transport: parsed.transport,
      brand: parsed.brand, model: null, hw_ref: null, outputs: [],
      online: { value: true, confidence: "confirmed", source: "none", updated_at: new Date(this.host.now()).toISOString(), stale: false, changed_by: null },
    };
    this.host.commit({ ...state, devices: [...state.devices, device] });
    this.invalidate();
    const created = irDevicesFrom([device], []).at(0);
    if (created === undefined) throw new ApiRequestError("validation", "Not an IR device", 400);
    return created;
  }

  async createCommand(deviceId: string, input: IrCommandCreate): Promise<IrCommand> {
    const parsed = IrCommandCreate.parse(input);
    await this.host.delay();
    if (!this.host.state().devices.some((device) => device.id === deviceId)) {
      throw new ApiRequestError("not_found", "Device not found", 404);
    }
    const command: IrCommand = {
      id: `mock-ir-${++this.seq}`, device_id: deviceId, name: parsed.name, role: parsed.role, setpoint: parsed.setpoint,
      code_format: "tuya", captured: false, captured_at: null, test: "untested", tested_at: null,
    };
    this.commands = [...this.commands, command];
    this.invalidate();
    return command;
  }

  /** H21: `listening` now; after MOCK_CAPTURE_MS `captured` (or `timeout` when armed by the panel). */
  async learn(commandId: string): Promise<void> {
    await this.host.delay();
    this.requireBlaster(this.find(commandId));
    if (this.active !== null) throw new ApiRequestError("precondition", "Another capture is running", 409);
    const deadline = new Date(this.host.now() + IR_CAPTURE_WINDOW_MS).toISOString();
    const timer = setTimeout(() => this.finishCapture(commandId), MOCK_CAPTURE_MS);
    this.active = { commandId, timer };
    this.host.emit({ type: "ir_capture", command_id: commandId, status: "listening", deadline });
  }

  async cancelLearn(commandId: string): Promise<void> {
    await this.host.delay();
    if (this.active?.commandId !== commandId) return;
    clearTimeout(this.active.timer);
    this.active = null;
    this.host.emit({ type: "ir_capture", command_id: commandId, status: "cancelled", deadline: null });
  }

  /** R5: sends the code once; the technician answers with recordTest. */
  async test(commandId: string): Promise<void> {
    await this.host.delay();
    const command = this.find(commandId);
    if (!command.captured) throw new ApiRequestError("precondition", "Nothing captured yet", 409);
    this.requireBlaster(command);
  }

  async recordTest(commandId: string, reacted: boolean): Promise<IrCommand> {
    await this.host.delay();
    const updated: IrCommand = {
      ...this.find(commandId), test: reacted ? "reacted" : "no_reaction", tested_at: new Date(this.host.now()).toISOString(),
    };
    this.replace(updated);
    this.invalidate();
    return updated;
  }

  /** Mock panel: the next capture hears nothing (H21 "Nothing received"). */
  captureNothingNext(): void {
    this.nothingNext = true;
  }

  /** S3d remove: the device's commands go with it. */
  forgetDevice(deviceId: string): void {
    this.commands = this.commands.filter((command) => command.device_id !== deviceId);
  }

  private finishCapture(commandId: string): void {
    this.active = null;
    if (this.nothingNext) {
      this.nothingNext = false;
      this.host.emit({ type: "ir_capture", command_id: commandId, status: "timeout", deadline: null }); // old code kept
      return;
    }
    const command = this.commands.find((candidate) => candidate.id === commandId);
    if (command === undefined) return;
    const at = new Date(this.host.now()).toISOString();
    this.replace({ ...command, captured: true, captured_at: at, test: "untested", tested_at: null }); // R5
    if (command.setpoint !== null) this.addSetpoint(command.setpoint.temp_c);
    this.host.emit({ type: "ir_capture", command_id: commandId, status: "captured", deadline: null });
    this.invalidate();
  }

  /** R4: S1's −/+ step through captured setpoints only. */
  private addSetpoint(tempC: number): void {
    const state = this.host.state();
    const { ac } = state.environment;
    if (ac.available_setpoints.includes(tempC)) return;
    const available_setpoints = [...ac.available_setpoints, tempC].sort((a, b) => a - b);
    this.host.commit({ ...state, environment: { ...state.environment, ac: { ...ac, available_setpoints } } });
  }

  /** H25: ZS06 codes need the blaster; `ir_mcu` codes go out on the ESP32 (R8). */
  private requireBlaster(command: IrCommand): void {
    const state = this.host.state();
    const device = state.devices.find((candidate) => candidate.id === command.device_id);
    if (device?.transport === "ir_zs06" && state.ir_blaster.online.value !== true) {
      throw new ApiRequestError("hw_unavailable", "Couldn't reach the blaster", 503);
    }
  }

  private find(commandId: string): IrCommand {
    const command = this.commands.find((candidate) => candidate.id === commandId);
    if (command === undefined) throw new ApiRequestError("not_found", "Command not found", 404);
    return command;
  }

  private replace(command: IrCommand): void {
    this.commands = this.commands.map((candidate) => (candidate.id === command.id ? command : candidate));
  }

  private invalidate(): void {
    this.host.emit({ type: "invalidate", keys: [["ir", "devices"], ["devices"]] });
  }
}
