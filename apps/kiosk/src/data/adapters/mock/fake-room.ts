import {
  ClientSession, Command, CommandRequest, DevicePatch, LoginRequest, RoomPinRequest, RoomState, ServerEvent,
  TechnicianPinRequest, type AboutInfo, type ChangedBy, type ClientLabel, type ClientType, type CommandBody,
  type Device, type LoginResult, type NetworkInfo,
} from "@eduscope/contracts";
import roomNormal from "@eduscope/contracts/fixtures/state/room-normal.json";
import { ApiRequestError, type RealtimeConnection, type RealtimeHandlers } from "@/data/api-client";
import { FakeIr } from "./fake-ir";
import { FakeSchedule } from "./fake-schedule";
import type { MockHost } from "./mock-host";
import {
  applyCommandToState, applyProjectorStep, describeCommand, observe, projectorRamp, rebaseNodeTimes, RUNNING_WATTS,
  setProjectorPhase, statusFor, withDerived, withNodesOnline, type ProjectorStep, type RampTimes,
} from "./mock-rules";

// In-memory room (ARCHITECTURE §4.4). Emits the SAME ServerEvents the real server will, through
// the same handlers the http adapter calls, so apply-event is the only writer of the cache.

export const MOCK_LATENCY_MIN_MS = 200;
export const MOCK_LATENCY_MAX_MS = 600;
export const MOCK_PING_MS = 10_000;
/** Mock transport timeout for "Time out next command" (real values: Q12). */
export const MOCK_COMMAND_TIMEOUT_MS = 5_000;
/** How long a refused connect takes to fail. */
export const MOCK_REFUSE_MS = 300;
/** ARCHITECTURE §4.4: the mock's PINs (the real ones are hashed in core-api, M08). */
export const MOCK_ROOM_PIN = "1234";
export const MOCK_TECHNICIAN_PIN = "123456";
/** H17 / ARCHITECTURE §5: 5 wrong → locked for 60 s (per level, like core-api's per (ip, level)). */
export const MOCK_MAX_PIN_ATTEMPTS = 5;
export const MOCK_PIN_LOCKOUT_S = 60;
/** "Occupancy detected" first reports clear, then detected this much later (a real transition). */
export const MOCK_OCCUPANCY_REDETECT_MS = 1000;
/** Timed behaviour at time scale 1 (`?time-scale=` shortens it). R1 ramp, H7b, screen travel. */
export const MOCK_IR_TO_DRAW_MS = 3_000;
export const MOCK_WARM_UP_MS = 30_000;
export const MOCK_COOL_DOWN_MS = 60_000;
/** H7b: "no change in draw" after 90 s. */
export const MOCK_NO_DRAW_CHANGE_MS = 90_000;
/** Live wattage update while the draw moves. */
export const MOCK_POWER_TICK_MS = 1_000;
export const MOCK_SCREEN_TRAVEL_MS = 8_000;
/** "Toggle climate stale" backdates the reading by this much (H10 "· 14 min ago"). */
export const MOCK_STALE_AGE_MS = 14 * 60_000;
/** "Open joining": the window the panel opens, so S2.E21 starts at "Open · 4:12 left". Not time-scaled. */
export const MOCK_JOIN_WINDOW_MS = (4 * 60 + 12) * 1000;
/** "Toggle interlock holding": the projector is cooling at this draw (H15 "… · 112 W"). */
export const MOCK_HOLDING_WATTS = 112;
/** S3d "Permit joining": the mesh opens for 4 min (PermitJoinRequest). Not time-scaled. */
export const MOCK_PERMIT_JOIN_MS = 240_000;
/** PLAN-H05 "Pair devices": this long after Permit joining, every mock node is heard (as if reset and rejoined). */
export const MOCK_PAIR_HEARD_MS = 3_000;
/** S3e "Restart controller": sockets drop, then the controller accepts connections again. */
export const MOCK_RESTART_MS = 5_000;
/** S3e About: the mock controller has been up 3 d 4 h when the page loads. */
export const MOCK_UPTIME_AT_START_S = (3 * 24 + 4) * 3600;
export const MOCK_VERSION = "0.6.0";
export const MOCK_PI_MODEL = "Raspberry Pi 5 Model B Rev 1.0";
export const MOCK_ADDRESS = "192.168.10.41";
/** SPEC §2.3 session lengths, shown in `expires_at` only (the mock never expires on its own). */
const CONTROL_SESSION_MS = 2 * 60 * 60_000;
const TECHNICIAN_SESSION_MS = 15 * 60_000;
const KIOSK_TECHNICIAN_SESSION_MS = 2 * 60_000;
const OWN_PUBLIC_ID = "mock-self";
const PHONE_PUBLIC_ID = "mock-phone";

interface Listener {
  handlers: RealtimeHandlers;
  open: boolean;
}

export interface FakeRoomOptions {
  random?: () => number;
  now?: () => number;
  /** Multiplies every timed behaviour (1 = real time). Latency and timeouts are not scaled. */
  timeScale?: number;
}

export class FakeRoom {
  private state: RoomState;
  private session: ClientSession;
  /** The label from the last `hello` (a remote client's own label; the kiosk is "room screen"). */
  private helloLabel: ClientLabel = "laptop";
  private readonly pinFailures = { control: 0, technician: 0 };
  /** Epoch ms until which PIN entry is locked, per level. */
  private readonly lockedUntil = { control: 0, technician: 0 };
  private readonly listeners = new Set<Listener>();
  private reachable = true;
  private silent = false;
  private failNext = false;
  private timeoutNext = false;
  private commandSeq = 0;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  /** Epoch ms at which the last accepted command lands: commands land in arrival order. */
  private lastDueAt = 0;
  private projectorTimer: ReturnType<typeof setTimeout> | null = null;
  private screenTimer: ReturnType<typeof setTimeout> | null = null;
  private noDrawChangeNext = false;
  private joinTimer: ReturnType<typeof setTimeout> | null = null;
  private pairTimer: ReturnType<typeof setTimeout> | null = null;
  private roomPin = MOCK_ROOM_PIN;
  private technicianPin = MOCK_TECHNICIAN_PIN;
  /** Epoch ms of the (mock) controller start; uptime counts from here. */
  private bootedAt: number;
  private uptimeAtBootS = MOCK_UPTIME_AT_START_S;
  /** S3 Remote configuration and S3c Schedule stores (they share this room's state and events). */
  readonly ir: FakeIr;
  readonly schedule: FakeSchedule;
  private readonly random: () => number;
  private readonly now: () => number;
  private readonly timeScale: number;

  constructor(options: FakeRoomOptions = {}) {
    this.random = options.random ?? Math.random;
    this.now = options.now ?? Date.now;
    this.timeScale = options.timeScale ?? 1;
    this.state = rebaseNodeTimes(RoomState.parse(roomNormal), this.now());
    // SPEC §2.3: a remote browser without a PIN starts at `view`.
    this.session = ClientSession.parse({
      public_id: OWN_PUBLIC_ID, client_type: "remote", label: this.helloLabel, access: "view",
      unlocked_at: null, last_activity: null, expires_at: null,
    });
    this.bootedAt = this.now();
    const host: MockHost = {
      state: () => this.state,
      commit: (next) => this.commit(next),
      emit: (event) => this.emitAll(event),
      delay: () => this.delay(),
      now: () => this.now(),
    };
    this.ir = new FakeIr(host);
    this.schedule = new FakeSchedule(host);
  }

  // ── ApiClient surface ────────────────────────────────────────────────────────────────

  async getSession(): Promise<ClientSession> {
    await this.delay();
    return this.session;
  }

  /** Room PIN → `control`, technician PIN → `technician` (upgrades the session in place). */
  async login(request: LoginRequest): Promise<LoginResult> {
    const { level, pin } = LoginRequest.parse(request);
    await this.delay();
    const now = this.now();
    if (now < this.lockedUntil[level]) {
      return { reason: "locked", retry_after_s: Math.ceil((this.lockedUntil[level] - now) / 1000), attempts_left: 0 };
    }
    const expected = level === "control" ? this.roomPin : this.technicianPin;
    if (pin !== expected) {
      this.pinFailures[level] += 1;
      if (this.pinFailures[level] >= MOCK_MAX_PIN_ATTEMPTS) {
        this.pinFailures[level] = 0;
        this.lockedUntil[level] = now + MOCK_PIN_LOCKOUT_S * 1000;
        return { reason: "locked", retry_after_s: MOCK_PIN_LOCKOUT_S, attempts_left: 0 };
      }
      return { reason: "wrong", retry_after_s: null, attempts_left: MOCK_MAX_PIN_ATTEMPTS - this.pinFailures[level] };
    }
    this.pinFailures[level] = 0;
    const kiosk = this.session.client_type === "kiosk";
    const lengthMs = level === "control" ? CONTROL_SESSION_MS : kiosk ? KIOSK_TECHNICIAN_SESSION_MS : TECHNICIAN_SESSION_MS;
    this.session = {
      ...this.session,
      access: level,
      unlocked_at: this.iso(),
      last_activity: this.iso(),
      expires_at: new Date(now + lengthMs).toISOString(),
    };
    return this.session;
  }

  /** Lock (S1.E8): remote → `view`, kiosk → `control`; pushes `session` like core-api does. */
  async lock(): Promise<ClientSession> {
    await this.delay();
    this.setSession(this.downgraded());
    return this.session;
  }

  async getState(): Promise<RoomState> {
    await this.delay();
    return this.stamped();
  }

  async sendCommand(request: CommandRequest): Promise<Command> {
    const parsed = CommandRequest.parse(request);
    const ackMs = this.latency();
    const command: Command = {
      id: `mock-cmd-${++this.commandSeq}`,
      client_cmd_id: parsed.client_cmd_id,
      body: parsed.body,
      issued_by: { public_id: this.session.public_id, label: this.session.label },
      status: "pending",
      error: null,
      at: this.iso(),
    };
    this.process(command, ackMs); // queued now, so commands keep their arrival order (unmute → level)
    await this.wait(ackMs);
    return command;
  }

  connect(label: ClientLabel, handlers: RealtimeHandlers): RealtimeConnection {
    const listener: Listener = { handlers, open: true };
    if (!this.reachable) {
      setTimeout(() => {
        if (listener.open) handlers.onClose();
      }, MOCK_REFUSE_MS);
      return { close: () => { listener.open = false; } };
    }
    this.helloLabel = label;
    if (this.session.client_type === "remote") this.session = { ...this.session, label };
    this.listeners.add(listener);
    this.ensurePing();
    setTimeout(() => {
      if (!listener.open) return;
      handlers.onOpen();
      this.emitTo(listener, { type: "snapshot", state: this.stamped() });
    }, this.latency());
    return {
      close: () => {
        listener.open = false;
        this.listeners.delete(listener);
      },
    };
  }

  // ── Settings (S3b–S3e) ───────────────────────────────────────────────────────────────

  /** S3d registry = the room's devices. */
  async listDevices(): Promise<Device[]> {
    await this.delay();
    return this.state.devices;
  }

  /** S3d edit sheet: rename, transport, hardware id. S1/S2/S3 follow through `state` + invalidate. */
  async updateDevice(id: string, patch: DevicePatch): Promise<Device> {
    const parsed = DevicePatch.parse(patch);
    await this.delay();
    const current = this.state.devices.find((device) => device.id === id);
    if (current === undefined) throw new ApiRequestError("not_found", "Device not found", 404);
    const updated: Device = {
      ...current,
      ...(parsed.name === undefined ? {} : { name: parsed.name }),
      ...(parsed.transport === undefined ? {} : { transport: parsed.transport }),
      ...(parsed.hw_ref === undefined ? {} : { hw_ref: parsed.hw_ref }),
    };
    this.commit({ ...this.state, devices: this.state.devices.map((device) => (device.id === id ? updated : device)) });
    this.invalidateDevices();
    return updated;
  }

  async removeDevice(id: string): Promise<void> {
    await this.delay();
    if (!this.state.devices.some((device) => device.id === id)) throw new ApiRequestError("not_found", "Device not found", 404);
    this.ir.forgetDevice(id);
    this.commit({ ...this.state, devices: this.state.devices.filter((device) => device.id !== id) });
    this.invalidateDevices();
  }

  /** S3d "Permit joining": the mesh opens for 4 min; S2.E21 counts down from `joining.until`. */
  async permitJoin(): Promise<void> {
    await this.delay();
    this.openJoiningFor(MOCK_PERMIT_JOIN_MS);
    // PLAN-H05: the devices rejoin a moment later, so S3d "Pair devices" turns "Heard just now".
    if (this.pairTimer !== null) clearTimeout(this.pairTimer);
    this.pairTimer = setTimeout(() => {
      this.pairTimer = null;
      const { zigbee } = this.state;
      const nodes = zigbee.nodes.map((node) => ({ ...node, online: true, last_seen: this.iso() }));
      this.commit({ ...this.state, zigbee: { ...zigbee, nodes } });
    }, MOCK_PAIR_HEARD_MS);
  }

  async setRoomPin(pin: string): Promise<void> {
    const parsed = RoomPinRequest.parse({ pin });
    await this.delay();
    this.roomPin = parsed.pin;
  }

  async setTechnicianPin(pin: string): Promise<void> {
    const parsed = TechnicianPinRequest.parse({ pin });
    await this.delay();
    this.technicianPin = parsed.pin;
  }

  /** S3b: this client plus a room screen and two phones. */
  async network(): Promise<NetworkInfo> {
    await this.delay();
    return {
      hostname: this.state.room.hostname,
      address: MOCK_ADDRESS,
      connection: { kind: "ethernet" },
      controller: { hw: this.state.connection.hw },
      clients: [
        { public_id: null, label: "room screen", client_type: "kiosk", access: "control" },
        { public_id: PHONE_PUBLIC_ID, label: "phone", client_type: "remote", access: "control" },
        { public_id: null, label: "phone", client_type: "remote", access: "view" },
        {
          public_id: this.session.public_id, label: this.session.label, client_type: this.session.client_type,
          access: this.session.access,
        },
      ],
    };
  }

  /** S3e. The URL comes from the room's hostname, never from the page's own address. */
  async about(): Promise<AboutInfo> {
    await this.delay();
    return {
      room: this.state.room.id,
      version: MOCK_VERSION,
      uptime_s: this.uptimeAtBootS + Math.floor((this.now() - this.bootedAt) / 1000),
      pi_model: MOCK_PI_MODEL,
      url: `http://${this.state.room.hostname}`,
    };
  }

  /**
   * S3e "Restart controller": answers first, then drops every socket (H3), forgets the AC state
   * (R3) and accepts connections again after MOCK_RESTART_MS; the client resyncs (H4).
   */
  async restart(): Promise<void> {
    await this.delay();
    setTimeout(() => {
      this.dropConnection();
      this.restartController();
      setTimeout(() => {
        this.bootedAt = this.now();
        this.uptimeAtBootS = 0;
        this.restore();
      }, MOCK_RESTART_MS);
    }, 0);
  }

  /** D-32 "Power off": answers first, then drops every socket and refuses reconnects (mock panel Restore brings it back). */
  async shutdown(): Promise<void> {
    await this.delay();
    setTimeout(() => this.dropConnection(), 0);
  }

  // ── Mock panel (`?mock-panel`) ───────────────────────────────────────────────────────

  /** Close every socket now and refuse reconnects until restore(). */
  dropConnection(): void {
    this.reachable = false;
    for (const listener of [...this.listeners]) {
      listener.open = false;
      this.listeners.delete(listener);
      listener.handlers.onClose();
    }
  }

  /** Go silent without closing: the client notices through its 25 s ping-miss timer. */
  makeUnreachable(): void {
    this.reachable = false;
    this.silent = true;
  }

  /** Accept connections again. Silent sockets stay dead; the client reconnects. */
  restore(): void {
    this.reachable = true;
    if (this.silent) {
      this.silent = false;
      for (const listener of [...this.listeners]) {
        listener.open = false;
        this.listeners.delete(listener);
      }
    }
  }

  /** Another client toggles Rear of room (H13 "· from phone"). */
  changeFromPhone(): void {
    const on = this.state.environment.lights.rear.value !== true;
    this.applyExternal({ kind: "lights.set", gang: "rear", on }, "phone", PHONE_PUBLIC_ID);
  }

  /** The wall plate toggles Front of room (R6 "· by hand"). */
  changeByHand(): void {
    const on = this.state.environment.lights.front.value !== true;
    this.applyExternal({ kind: "lights.set", gang: "front", on }, "by hand", null);
  }

  /** H7b: the next projector Power on/off leaves the draw unchanged. */
  noDrawChangeNextCommand(): void {
    this.noDrawChangeNext = true;
  }

  /**
   * H8: flip one device's online flag; status and sensor count follow. "projector_socket" is the
   * S1.E13 power meter; "ir_blaster" is H25 (its `ir_blaster.online` follows).
   */
  toggleDeviceOffline(deviceId: string): void {
    const online = this.state.devices.find((device) => device.id === deviceId)?.online.value !== true;
    this.commit(this.withDevicesOnline((device) => device.id === deviceId, online));
  }

  /** H9: the coordinator and every Zigbee device go offline (or all come back). */
  toggleCoordinatorOffline(): void {
    const { coordinator } = this.state.zigbee;
    const online = coordinator.status === "offline";
    const next = this.withDevicesOnline((device) => device.kind === "coordinator" || device.transport === "zigbee", online);
    this.commit({ ...next, zigbee: { ...next.zigbee, coordinator: { ...coordinator, status: online ? "online" : "offline" } } });
  }

  /** S1.E11 "Selected, assumed": the HDMI switch stops confirming the selected input. */
  sourceAssumed(): void {
    const { display } = this.state;
    this.commit({ ...this.state, display: { ...display, source: { ...display.source, confidence: "assumed" } } });
  }

  /** Another client moves PC audio (SPEC §2.4: not applied to a slider while it is dragged). */
  changePcAudioFromPhone(): void {
    const current = this.state.audio.channels.pc.value ?? 0;
    const level = current >= 50 ? 20 : 80;
    this.applyExternal({ kind: "audio.level", channel: "pc", level, final: true }, "phone", PHONE_PUBLIC_ID);
  }

  /** S1.E17 "Unknown": the screen's position source stops reporting (Q2). */
  screenPositionUnknown(): void {
    const { display } = this.state;
    this.commit({ ...this.state, display: { ...display, screen: { ...display.screen, value: "unknown", confidence: "unknown" } } });
  }

  /** R3: a controller restart forgets the AC state → "Unknown" until the next command. */
  restartController(): void {
    const { environment } = this.state;
    const unknown = { value: null, confidence: "unknown" as const, source: "none" as const, updated_at: null, stale: false, changed_by: null };
    this.commit({
      ...this.state,
      environment: { ...environment, ac: { ...environment.ac, power: unknown, setpoint_c: unknown } },
    });
  }

  /** H10: the climate sensor (temperature + humidity) is 14 min old, and so is its node's last seen; again → fresh. */
  toggleClimateStale(): void {
    const { environment, zigbee } = this.state;
    const { sensors } = environment;
    const stale = !sensors.temperature.stale;
    const at = stale ? new Date(this.now() - MOCK_STALE_AGE_MS).toISOString() : this.iso();
    const nodes = zigbee.nodes.map((node) => (node.friendly_name === sensors.temperature.node ? { ...node, last_seen: at } : node));
    this.commit({
      ...this.state,
      environment: { ...environment, sensors: { ...sensors, temperature: { ...sensors.temperature, stale, at }, humidity: { ...sensors.humidity, stale, at } } },
      zigbee: { ...zigbee, nodes },
    });
  }

  /** S1.E45: door Open (amber) ↔ Closed. */
  toggleDoor(): void {
    const { sensors } = this.state.environment;
    const value = sensors.contact.kind === "contact" && sensors.contact.value === "open" ? "closed" : "open";
    this.setSensors({ ...sensors, contact: { kind: "contact", value, node: sensors.contact.node, at: this.iso(), stale: false } });
  }

  /** H11: the door sensor has never reported ("—", "No reading yet"). */
  doorNoReading(): void {
    const { sensors } = this.state.environment;
    this.setSensors({ ...sensors, contact: { kind: "contact", value: null, node: sensors.contact.node, at: null, stale: false } });
  }

  /** S2.E16 / H16: set one battery node's level (18 → amber, 8 → red, 98 → back to normal). */
  setBattery(friendlyName: string, pct: number): void {
    const { zigbee } = this.state;
    const nodes = zigbee.nodes.map((node) => (node.friendly_name === friendlyName ? { ...node, battery_pct: pct } : node));
    this.commit({ ...this.state, zigbee: { ...zigbee, nodes } });
  }

  /** S2.E19: every battery end device is unpaired (reload the page to undo). */
  noBatteryDevices(): void {
    const { zigbee } = this.state;
    const nodes = zigbee.nodes.filter((node) => node.power_source !== "battery");
    const routers = nodes.filter((node) => node.role === "router").length;
    this.commit({
      ...this.state,
      zigbee: { ...zigbee, nodes, mesh: { ...zigbee.mesh, paired: nodes.length, routers, end_devices: nodes.length - routers } },
    });
  }

  /** S2.E3 "Coordinator starting…" ↔ online. */
  toggleCoordinatorStarting(): void {
    const { zigbee } = this.state;
    const status = zigbee.coordinator.status === "starting" ? "online" : "starting";
    this.commit({ ...this.state, zigbee: { ...zigbee, coordinator: { ...zigbee.coordinator, status } } });
  }

  /** S2.E21: joining opens for 4:12 and closes by itself (permit join itself is S3d, M06). */
  openJoining(): void {
    this.openJoiningFor(MOCK_JOIN_WINDOW_MS);
  }

  /** H15 / S2.E23: the projector is cooling at 112 W and the interlock holds; again → running, armed. */
  toggleInterlockHolding(): void {
    const step: ProjectorStep =
      this.state.interlock.status === "holding"
        ? { watts: RUNNING_WATTS, state: "running", phase: "idle", done: true }
        : { watts: MOCK_HOLDING_WATTS, state: "cooling_down", phase: "idle", done: true };
    this.commit(applyProjectorStep(this.state, step, this.iso())); // cooling_down → holding, running → armed
  }

  /** S2.E23 "Bypassed" ↔ armed (the bypass itself is a technician action, not built). */
  toggleInterlockBypassed(): void {
    const status = this.state.interlock.status === "bypassed" ? "armed" : "bypassed";
    this.commit({ ...this.state, interlock: { ...this.state.interlock, status } });
  }

  /** H24: the session times out on the server → remote `view`, kiosk `control`. */
  expireSession(): void {
    this.setSession(this.downgraded());
  }

  /** "Be kiosk" / "be remote": the server decides client_type (never the user agent). */
  setClientType(clientType: ClientType): void {
    this.setSession({
      ...this.session,
      client_type: clientType,
      label: clientType === "kiosk" ? "room screen" : this.helloLabel,
      access: clientType === "kiosk" ? "control" : "view",
      unlocked_at: null,
      last_activity: null,
      expires_at: null,
    });
  }

  /** H23: occupancy goes clear, then detected a second later (the kiosk wakes on the transition). */
  occupancyDetected(): void {
    this.setOccupancy("clear");
    setTimeout(() => this.setOccupancy("detected"), MOCK_OCCUPANCY_REDETECT_MS);
  }

  failNextCommand(): void {
    this.failNext = true;
  }

  timeOutNextCommand(): void {
    this.timeoutNext = true;
  }

  /** Read-only view for the panel (e.g. listing devices). */
  peek(): RoomState {
    return this.state;
  }

  // ── internals ────────────────────────────────────────────────────────────────────────

  private downgraded(): ClientSession {
    const access = this.session.client_type === "kiosk" ? "control" : "view";
    return { ...this.session, access, unlocked_at: null, last_activity: null, expires_at: null };
  }

  private setSession(next: ClientSession): void {
    this.session = next;
    this.emitAll({ type: "session", session: next });
  }

  private withDevicesOnline(match: (device: Device) => boolean, online: boolean): RoomState {
    const ctx = { at: this.iso(), by: "by hand" as const };
    const devices = this.state.devices.map((device) =>
      match(device) ? { ...device, online: observe(device.online, online, ctx) } : device,
    );
    const blasterOnline = devices.find((device) => device.id === "ir_blaster")?.online.value !== false;
    const irBlaster = this.state.ir_blaster;
    // S2: the matching Zigbee nodes follow (online flag + last seen).
    const nodeNames = new Set(
      this.state.devices.flatMap((device) => (match(device) && device.transport === "zigbee" && device.hw_ref !== null ? [device.hw_ref] : [])),
    );
    const next = { ...this.state, devices, ir_blaster: { ...irBlaster, online: observe(irBlaster.online, blasterOnline, ctx) } };
    return withNodesOnline(next, nodeNames, online, this.now());
  }

  private openJoiningFor(ms: number): void {
    if (this.joinTimer !== null) clearTimeout(this.joinTimer);
    const until = new Date(this.now() + ms).toISOString();
    this.setJoining({ state: "open", until });
    this.joinTimer = setTimeout(() => {
      this.joinTimer = null;
      this.setJoining({ state: "closed" });
    }, ms);
  }

  private invalidateDevices(): void {
    this.emitAll({ type: "invalidate", keys: [["devices"], ["ir", "devices"]] });
  }

  private setJoining(joining: RoomState["zigbee"]["mesh"]["joining"]): void {
    const { zigbee } = this.state;
    this.commit({ ...this.state, zigbee: { ...zigbee, mesh: { ...zigbee.mesh, joining } } });
  }

  private setSensors(sensors: RoomState["environment"]["sensors"]): void {
    this.commit({ ...this.state, environment: { ...this.state.environment, sensors } });
  }

  private setOccupancy(value: "detected" | "clear"): void {
    const { environment } = this.state;
    const occupancy = { ...environment.sensors.occupancy, kind: "occupancy" as const, value, at: this.iso(), stale: false };
    this.commit({ ...this.state, environment: { ...environment, sensors: { ...environment.sensors, occupancy } } });
  }

  private process(command: Command, ackMs: number): void {
    if (this.timeoutNext) {
      this.timeoutNext = false;
      setTimeout(() => this.emitAll({ type: "command", command: { ...command, status: "timed_out" } }), ackMs + MOCK_COMMAND_TIMEOUT_MS);
      return;
    }
    if (this.failNext) {
      this.failNext = false;
      setTimeout(
        () => this.emitAll({ type: "command", command: { ...command, status: "failed", error: "Command failed" } }),
        ackMs + this.latency(),
      );
      return;
    }
    this.inOrder(() => {
      this.emitAll({ type: "command", command: { ...command, status: "sent" } });
      const by = command.issued_by?.label ?? "schedule";
      this.commit(applyCommandToState(this.state, command.body, { at: this.iso(), by }));
      this.startTimedEffects(command.body, by);
      this.emitAll({ type: "command", command: { ...command, status: statusFor(command.body) } });
      if (command.body.kind !== "audio.level" || command.body.final) {
        this.emitAll({ type: "activity", text: describeCommand(command.body), by, public_id: command.issued_by?.public_id ?? null });
      }
    }, ackMs + this.latency());
  }

  /** Runs `fn` after `delayMs`, but never before an earlier command (core-api dispatches in arrival order). */
  private inOrder(fn: () => void, delayMs: number): void {
    const due = Math.max(this.now() + delayMs, this.lastDueAt + 1);
    this.lastDueAt = due;
    setTimeout(fn, due - this.now());
  }

  /** The parts of a command that take time: the R1 draw ramp (+ H7b) and the screen travel. */
  private startTimedEffects(body: CommandBody, by: ChangedBy): void {
    if (body.kind === "projector.power") this.startProjectorRamp(body.on);
    if (body.kind === "screen.move") {
      if (this.screenTimer !== null) clearTimeout(this.screenTimer);
      this.screenTimer = setTimeout(() => {
        this.screenTimer = null;
        const to = body.to === "raise" ? "raised" : "lowered";
        this.commit({ ...this.state, display: { ...this.state.display, screen: observe(this.state.display.screen, to, { at: this.iso(), by }) } });
      }, this.scaled(MOCK_SCREEN_TRAVEL_MS));
    }
  }

  private startProjectorRamp(on: boolean): void {
    if (this.projectorTimer !== null) clearTimeout(this.projectorTimer);
    this.projectorTimer = null;
    const current = this.state.display.projector.state.value;
    if ((on && current === "running") || (!on && current === "standby")) {
      this.commit(setProjectorPhase(this.state, "idle")); // the draw already agrees
      return;
    }
    if (this.noDrawChangeNext) {
      this.noDrawChangeNext = false;
      this.projectorTimer = setTimeout(() => {
        this.projectorTimer = null;
        this.commit(setProjectorPhase(this.state, "no_change"));
      }, this.scaled(MOCK_NO_DRAW_CHANGE_MS));
      return;
    }
    const startedAt = this.now();
    const times: RampTimes = {
      irToDrawMs: this.scaled(MOCK_IR_TO_DRAW_MS),
      warmUpMs: this.scaled(MOCK_WARM_UP_MS),
      coolDownMs: this.scaled(MOCK_COOL_DOWN_MS),
    };
    const tick = (): void => {
      const step = projectorRamp(on, this.now() - startedAt, times);
      if (step.phase !== "waiting_for_draw") this.commit(applyProjectorStep(this.state, step, this.iso()));
      this.projectorTimer = step.done ? null : setTimeout(tick, this.scaled(MOCK_POWER_TICK_MS));
    };
    this.projectorTimer = setTimeout(tick, this.scaled(MOCK_POWER_TICK_MS));
  }

  private scaled(ms: number): number {
    return Math.max(50, Math.round(ms * this.timeScale));
  }

  private applyExternal(body: Parameters<typeof applyCommandToState>[1], by: "phone" | "by hand", publicId: string | null): void {
    this.commit(applyCommandToState(this.state, body, { at: this.iso(), by }));
    this.emitAll({ type: "activity", text: describeCommand(body), by, public_id: publicId });
  }

  /** Derive, bump rev and push `state`. Works while dropped: the next snapshot carries the change. */
  private commit(next: RoomState): void {
    this.state = { ...withDerived(next), rev: this.state.rev + 1 };
    this.emitAll({ type: "state", state: this.stamped() });
  }

  private stamped(): RoomState {
    return { ...this.state, server_time: this.iso() };
  }

  private emitAll(event: ServerEvent): void {
    for (const listener of this.listeners) this.emitTo(listener, event);
  }

  private emitTo(listener: Listener, event: ServerEvent): void {
    if (!listener.open || this.silent) return;
    listener.handlers.onEvent(ServerEvent.parse(event)); // catches mock bugs like a real boundary
  }

  private ensurePing(): void {
    if (this.pingTimer !== null) return;
    this.pingTimer = setInterval(() => this.emitAll({ type: "ping" }), MOCK_PING_MS);
  }

  private latency(): number {
    return Math.round(MOCK_LATENCY_MIN_MS + this.random() * (MOCK_LATENCY_MAX_MS - MOCK_LATENCY_MIN_MS));
  }

  private delay(): Promise<void> {
    return this.wait(this.latency());
  }

  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private iso(): string {
    return new Date(this.now()).toISOString();
  }
}
