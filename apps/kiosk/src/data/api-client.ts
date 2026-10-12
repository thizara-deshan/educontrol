import type {
  ApiErrorCode, ClientLabel, ClientSession, Command, CommandRequest, LoginRequest, LoginResult, RoomState,
  ServerEvent,
} from "@eduscope/contracts";

// ARCHITECTURE §4.4. M03 subset: M06 adds ir/schedule/devices/settings/system. Components never
// see which adapter is active.

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
