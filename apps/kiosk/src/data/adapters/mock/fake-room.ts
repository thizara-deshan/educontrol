import {
  ClientSession, Command, CommandRequest, LoginRequest, RoomState, ServerEvent, type ClientLabel, type ClientType,
  type LoginResult,
} from "@eduscope/contracts";
import roomNormal from "@eduscope/contracts/fixtures/state/room-normal.json";
import type { RealtimeConnection, RealtimeHandlers } from "@/data/api-client";
import { applyCommandToState, describeCommand, observe, statusFor } from "./mock-rules";

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
  private readonly random: () => number;
  private readonly now: () => number;

  constructor(options: FakeRoomOptions = {}) {
    this.random = options.random ?? Math.random;
    this.now = options.now ?? Date.now;
    this.state = RoomState.parse(roomNormal);
    // SPEC §2.3: a remote browser without a PIN starts at `view`.
    this.session = ClientSession.parse({
      public_id: OWN_PUBLIC_ID, client_type: "remote", label: this.helloLabel, access: "view",
      unlocked_at: null, last_activity: null, expires_at: null,
    });
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
    const expected = level === "control" ? MOCK_ROOM_PIN : MOCK_TECHNICIAN_PIN;
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
    await this.delay();
    const command: Command = {
      id: `mock-cmd-${++this.commandSeq}`,
      client_cmd_id: parsed.client_cmd_id,
      body: parsed.body,
      issued_by: { public_id: this.session.public_id, label: this.session.label },
      status: "pending",
      error: null,
      at: this.iso(),
    };
    this.process(command);
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

  /** H8: flip one device's online flag; the room status follows. */
  toggleDeviceOffline(deviceId: string): void {
    const at = this.iso();
    const devices = this.state.devices.map((device) =>
      device.id === deviceId
        ? { ...device, online: observe(device.online, device.online.value !== true, { at, by: "by hand" }) }
        : device,
    );
    const offline = devices.filter((device) => device.online.value === false);
    const first = offline[0];
    const status =
      first === undefined
        ? { level: "normal" as const, text: "All systems normal" }
        : { level: "degraded" as const, text: offline.length === 1 ? `${first.name} offline` : `${offline.length} devices offline` };
    this.commit({ ...this.state, devices, room: { ...this.state.room, status } });
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

  private setOccupancy(value: "detected" | "clear"): void {
    const { environment } = this.state;
    const occupancy = { ...environment.sensors.occupancy, kind: "occupancy" as const, value, at: this.iso(), stale: false };
    this.commit({ ...this.state, environment: { ...environment, sensors: { ...environment.sensors, occupancy } } });
  }

  private process(command: Command): void {
    if (this.timeoutNext) {
      this.timeoutNext = false;
      setTimeout(() => this.emitAll({ type: "command", command: { ...command, status: "timed_out" } }), MOCK_COMMAND_TIMEOUT_MS);
      return;
    }
    if (this.failNext) {
      this.failNext = false;
      setTimeout(
        () => this.emitAll({ type: "command", command: { ...command, status: "failed", error: "Command failed" } }),
        this.latency(),
      );
      return;
    }
    setTimeout(() => {
      this.emitAll({ type: "command", command: { ...command, status: "sent" } });
      const by = command.issued_by?.label ?? "schedule";
      this.commit(applyCommandToState(this.state, command.body, { at: this.iso(), by }));
      this.emitAll({ type: "command", command: { ...command, status: statusFor(command.body) } });
      if (command.body.kind !== "audio.level" || command.body.final) {
        this.emitAll({ type: "activity", text: describeCommand(command.body), by, public_id: command.issued_by?.public_id ?? null });
      }
    }, this.latency());
  }

  private applyExternal(body: Parameters<typeof applyCommandToState>[1], by: "phone" | "by hand", publicId: string | null): void {
    this.commit(applyCommandToState(this.state, body, { at: this.iso(), by }));
    this.emitAll({ type: "activity", text: describeCommand(body), by, public_id: publicId });
  }

  /** Bump rev and push `state`. Works while dropped: the next snapshot carries the change. */
  private commit(next: RoomState): void {
    this.state = { ...next, rev: this.state.rev + 1 };
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
    return new Promise((resolve) => setTimeout(resolve, this.latency()));
  }

  private iso(): string {
    return new Date(this.now()).toISOString();
  }
}
