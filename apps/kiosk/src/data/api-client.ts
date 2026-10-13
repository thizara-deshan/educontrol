import type {
  AboutInfo, ApiErrorCode, ClassBlock, ClassBlockInput, ClientLabel, ClientSession, Command, CommandRequest, Device,
  DevicePatch, IrCommand, IrCommandCreate, IrDevice, IrDeviceCreate, LoginRequest, LoginResult, NetworkInfo, RoomState,
  Schedule, ServerEvent, TimedAction, TimedActionInput,
} from "@eduscope/contracts";

// ARCHITECTURE §4.4. Components never see which adapter is active.

/** S3 Remote configuration (SPEC §7.1, ARCHITECTURE §6.9). Capture progress arrives as `ir_capture`. */
export interface IrApi {
  listDevices(): Promise<IrDevice[]>;
  createDevice(input: IrDeviceCreate): Promise<IrDevice>;
  createCommand(deviceId: string, input: IrCommandCreate): Promise<IrCommand>;
  /** 202: the capture runs on the server; `ir_capture` events report it (H21). */
  learn(commandId: string): Promise<void>;
  cancelLearn(commandId: string): Promise<void>;
  /** Sends the stored code once (R5); the technician then answers with recordTest. */
  test(commandId: string): Promise<void>;
  recordTest(commandId: string, reacted: boolean): Promise<IrCommand>;
}

/** S3c. */
export interface ScheduleApi {
  get(): Promise<Schedule>;
  createBlock(input: ClassBlockInput): Promise<ClassBlock>;
  deleteBlock(id: string): Promise<void>;
  createAction(input: TimedActionInput): Promise<TimedAction>;
  updateAction(id: string, input: TimedActionInput): Promise<TimedAction>;
  deleteAction(id: string): Promise<void>;
}

/** S3d registry + permit joining. */
export interface DevicesApi {
  list(): Promise<Device[]>;
  update(id: string, patch: DevicePatch): Promise<Device>;
  remove(id: string): Promise<void>;
  /** Opens the Zigbee mesh for 4 min; `zigbee.mesh.joining` in the next state shows it. */
  permitJoin(): Promise<void>;
}

/** S3d PIN changes. */
export interface SettingsApi {
  setRoomPin(pin: string): Promise<void>;
  setTechnicianPin(pin: string): Promise<void>;
}

/** S3b / S3e. */
export interface SystemApi {
  network(): Promise<NetworkInfo>;
  about(): Promise<AboutInfo>;
  /** 202, then the controller drops every socket and comes back (H3 → H4). */
  restart(): Promise<void>;
}

export interface RealtimeHandlers {
  /** The transport is open (the snapshot follows as the first event). */
  onOpen(): void;
  /** A zod-parsed server frame. */
  onEvent(event: ServerEvent): void;
  /** The transport closed or failed to open. Called at most once per connection. */
  onClose(): void;
}

export interface RealtimeConnection {
  close(): void;
}

export interface ApiClient {
  getSession(): Promise<ClientSession>;
  /** A wrong or locked PIN resolves to a PinError (H17); only transport/contract failures throw. */
  login(request: LoginRequest): Promise<LoginResult>;
  /** Ends this client's session → the downgraded ClientSession (remote `view`, kiosk `control`). */
  lock(): Promise<ClientSession>;
  /** Exists for M08 and tests; the UI takes `["state"]` from the WS snapshot only. */
  getState(): Promise<RoomState>;
  /** 202 → the accepted Command (status `pending`). Throws ApiRequestError. */
  sendCommand(request: CommandRequest): Promise<Command>;
  /** Opens the realtime channel and sends `hello {label}` on open. */
  connect(label: ClientLabel, handlers: RealtimeHandlers): RealtimeConnection;
  ir: IrApi;
  schedule: ScheduleApi;
  devices: DevicesApi;
  settings: SettingsApi;
  system: SystemApi;
}

/** Every adapter failure. `network` = no response, `bad_response` = body failed zod. */
export type ApiFailureCode = ApiErrorCode | "network" | "bad_response";

export class ApiRequestError extends Error {
  readonly code: ApiFailureCode;
  readonly status: number | null;

  constructor(code: ApiFailureCode, message: string, status: number | null) {
    super(message);
    this.name = "ApiRequestError";
    this.code = code;
    this.status = status;
  }
}
