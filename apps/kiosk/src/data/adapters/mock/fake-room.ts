import {
  ClientSession, Command, CommandRequest, RoomState, ServerEvent, type ClientLabel,
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
    // M02: the mock client may control. M03 makes `view` the default and adds PIN login.
    this.session = ClientSession.parse({
      public_id: OWN_PUBLIC_ID, client_type: "remote", label: "laptop", access: "control",
      unlocked_at: null, last_activity: null, expires_at: null,
    });
  }

  // ── ApiClient surface ────────────────────────────────────────────────────────────────

  async getSession(): Promise<ClientSession> {
    await this.delay();
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
    this.session = { ...this.session, label };
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
