# Eduscope Central — Architecture

Status: v1, 2026-10-11 · Inputs: `docs/SPEC.md`, `guide/README.md` §7 · Changes only via a
decision record in `docs/decisions/` (prompt 08).

Conventions: `[ASSUMED]` = hardware assumption not yet confirmed by a hardware drop. SPEC IDs
(`S1.E14`, `H5`, `R1`, `Q2`…) are cited so every element has a home. Where SPEC and
`guide/README.md` disagree, **SPEC wins** (role names `view|control|technician`, hostname
`r-101.local`, breakpoints 600/1024).

---

## 1 Repo layout

```
edcontrol/
├── CLAUDE.md                     agent rules (auto-loaded)
├── package.json                  root scripts: dev, verify, build, typecheck, lint, test
├── pnpm-workspace.yaml           packages: apps/*, packages/*
├── tsconfig.base.json            strict, noUncheckedIndexedAccess, exactOptionalPropertyTypes
├── eslint.config.js              typescript-eslint strict; no-explicit-any = error
├── docs/                         SPEC, ARCHITECTURE, milestones/, plans/, reviews/, hardware/, decisions/
├── reference/                    screens/, hardware-drops/  (read-only, never imported)
│
├── packages/contracts/           @eduscope/contracts — zod v4, no runtime deps besides zod
│   ├── src/
│   │   ├── common.ts             Confidence, Source, ChangedBy, Observed<T>, Timestamp, ids
│   │   ├── domain/               room, device, display, audio, environment, zigbee, ir,
│   │   │                         interlock, schedule, session, command, system
│   │   ├── state.ts              RoomState (full snapshot)
│   │   ├── api/                  REST request/response schemas, one file per route group
│   │   ├── ws.ts                 ServerEvent union, ClientMessage union
│   │   ├── hw/                   core-api ↔ hw-service contract (commands, snapshot, events)
│   │   └── index.ts
│   ├── fixtures/                 golden JSON: hw/*.json, state/*.json (also read by pytest)
│   ├── scripts/export-hw-schema.ts
│   └── generated/hw.schema.json  committed output of z.toJSONSchema (reference for Python)
│
├── apps/kiosk/                   @eduscope/kiosk — Vite SPA, served by core-api in prod
│   └── src/
│       ├── app/                  main.tsx, router.tsx, providers.tsx, AppShell, Header,
│       │                         ConnectionBanner, Toaster, ErrorBoundary
│       ├── ui/                   shadcn primitives ONLY (button, sheet, dialog, switch,
│       │                         slider, tabs, table, skeleton, sonner…)
│       ├── components/           our shared pieces: StateDot, ObservedLine, Card, SectionLabel,
│       │                         CommandButton, ToggleRow, LevelSlider, SensorTile, MetricTile,
│       │                         KeyValueRow, PinPad, LockBadge, InlineError, DashedAddButton
│       ├── features/
│       │   ├── control/          S1: ControlPage, display/, audio/, environment/, BottomNav (phone)
│       │   ├── devices/          S2: DevicesPage, routers/, battery/, side/
│       │   ├── settings/         S3 shell + remote/ (S3), network/ (S3b), schedule/ (S3c),
│       │   │                     devices/ (S3d), about/ (S3e)
│       │   ├── pin/              S4 overlay, pin store, useRequireAccess
│       │   ├── session/          Lock button, session expiry handling (H24)
│       │   └── kiosk/            idle dim/blank (H23), wake-tap guard (R15), kiosk CSS guards
│       ├── data/
│       │   ├── api-client.ts     ApiClient interface
│       │   ├── adapters/http/    fetch + WebSocket
│       │   ├── adapters/mock/    in-memory fake room (latency, R1 ramps, other-client events)
│       │   ├── query-keys.ts
│       │   ├── realtime/         connection state machine, ServerEvent → query cache
│       │   └── commands/         pending store, useCommand, slider throttle
│       ├── lib/                  store.ts (tiny external store), server-time offset,
│       │                         formatters, client-label
│       └── styles/               tokens.css (the ONLY file with raw colour values), index.css
│
├── apps/core-api/                @eduscope/core-api — Fastify, one process, one origin
│   ├── drizzle/                  generated SQL migrations (committed, never hand-edited)
│   ├── drizzle.config.ts
│   └── src/
│       ├── main.ts               boot: config → db migrate/seed → store → hw stream → listen
│       ├── app.ts                buildApp(deps) — used by main and by tests (fastify.inject)
│       ├── config.ts             zod-parsed env
│       ├── db/                   schema.ts, client.ts, seed.ts
│       ├── plugins/              auth.ts, realtime.ts (WS hub), static.ts, origin-check.ts,
│       │                         errors.ts
│       ├── domain/               state-store.ts + pure rule modules: projector.ts (R1/R2/H7b),
│       │                         ac.ts (R3/R4), audio.ts (R9), sensors.ts (R13), lights.ts (R6),
│       │                         interlock.ts (R11), status.ts (S1.E4), attribution.ts (H13)
│       ├── hw/                   client.ts (HTTP), stream.ts (SSE consumer), ingest.ts
│       ├── commands/             dispatcher.ts, policies.ts (access + preconditions), timeouts.ts
│       ├── scheduler/            timed actions, class-block session end, midnight kWh baseline,
│       │                         event-log pruning
│       └── routes/               session, state, commands, ir, schedule, devices, settings,
│                                 system, health
│
├── services/hw/                  hw-service — FastAPI on 127.0.0.1 only
│   ├── pyproject.toml, uv.lock
│   ├── app/
│   │   ├── main.py               create_app(): mounts module routers, /v1/health, /v1/snapshot,
│   │   │                         /v1/events
│   │   ├── config.py             pydantic-settings
│   │   ├── registry.py           picks driver_fake / driver_real per module
│   │   ├── events.py             in-process async event bus + SSE endpoint
│   │   ├── contracts.py          shared pydantic bases (HwEvent envelope, errors)
│   │   ├── transports/           mqtt.py (one shared zigbee2mqtt client) [ASSUMED]
│   │   └── modules/<capability>/ router.py, service.py, schemas.py, driver_real.py, driver_fake.py
│   └── tests/                    test_<capability>.py, test_contract_fixtures.py
│
└── deploy/pi/
    ├── systemd/                  eduscope.target, eduscope-hw.service, eduscope-core.service
    ├── kiosk/                    labwc autostart, chromium launcher script
    ├── env/                      core.env.example, hw.env.example
    └── install.sh                idempotent: user, dirs, build, units, hostname, sudoers line
```

**Where new code goes:** a new entity or message → `packages/contracts` first. A new screen →
`apps/kiosk/src/features/<screen>/`. A visual piece used by ≥2 features →
`components/`. A shadcn primitive → `ui/` via the shadcn CLI. A domain rule → a pure function
in `core-api/src/domain/`. A new hardware capability → `services/hw/app/modules/<capability>/`.

---

## 2 Runtime topology

```
  LAN (shared, untrusted)                          Raspberry Pi  (hostname r-101, avahi mDNS)
 ┌───────────────┐                     ┌──────────────────────────────────────────────────────────┐
 │ phone/laptop/ │  http://r-101.local │  eduscope-core.service   (node 22, user eduscope)        │
 │ podium PC     │────────────────────▶│  core-api  0.0.0.0:80  (CAP_NET_BIND_SERVICE)           │
 └───────────────┘   GET /   (SPA)     │   ├─ static SPA (apps/kiosk/dist), history fallback      │
                     /api/*  (REST)    │   ├─ /api/*  REST; every mutation needs session + role   │
                     /ws  (push only)  │   ├─ /ws     fan-out to ALL clients (full RoomState)     │
 ┌───────────────┐                     │   └─ SQLite /var/lib/eduscope/eduscope.db (WAL)         │
 │ Chromium kiosk│── http://localhost ▶│              │ HTTP POST /v1/*   ▲ SSE GET /v1/events   │
 │ (optional,    │   (remote addr      │              ▼                   │ (snapshot, then events)│
 │  labwc user)  │    127.0.0.1)       │  eduscope-hw.service     hw-service 127.0.0.1:8081      │
 └───────────────┘                     │   FastAPI + uvicorn, HW_MODE=real (never on the LAN)     │
                                       │      │ MQTT localhost:1883 [ASSUMED]  │ serial/GPIO/ALSA  │
                                       │      ▼                                 [ASSUMED]         │
                                       │  mosquitto + zigbee2mqtt [ASSUMED] ── ZG-808Z coordinator │
                                       └──────────────────────────────────────────────────────────┘
```

| Process | Bind | Talks to | Started by |
|---|---|---|---|
| core-api | `0.0.0.0:80` prod, `0.0.0.0:3000` dev | hw-service (HTTP + SSE), SQLite | `eduscope-core.service` (`Wants=`/`After=` hw, starts even if hw fails) |
| hw-service | `127.0.0.1:8081` | MQTT broker, serial, GPIO, ALSA `[ASSUMED]` | `eduscope-hw.service` |
| Chromium kiosk (optional, Q13) | — | `http://localhost` | labwc autostart of the desktop user |
| mosquitto + zigbee2mqtt `[ASSUMED]` | `127.0.0.1:1883` | coordinator over USB/network | their own units, only if intake confirms |

- **One origin.** The SPA, REST and WS share `http://r-101.local`. No CORS, no proxy.
- **core-api is hw-service's only client.** Browsers never reach hw-service.
- **Dev on Arch:** `vite :5173` (with `--host`, proxies `/api` and `/ws`) → core-api `:3000`
  → hw-service `:8081` with `HW_MODE=fake`. Or run the kiosk alone with `VITE_API_MODE=mock`.
- **Boot order:** `eduscope.target` pulls in hw then core. The kiosk browser starts at desktop
  login and keeps retrying until core answers (it shows H1/H2 meanwhile).

---

## 3 Contracts

### 3.1 Rules

- `packages/contracts` is the **single source of truth** for every value crossing a boundary:
  kiosk ↔ core-api (REST + WS) and core-api ↔ hw-service.
- Wire format is JSON, `snake_case` field names (matches SPEC and Python), ISO-8601 timestamps
  with offset, generated by the server. Clients never use their own clock for state (S1.E2).
- Every inbound payload is parsed with zod at the boundary: request bodies in core-api route
  schemas, WS frames in the kiosk realtime layer, hw responses/events in `core-api/src/hw/`, env in
  `config.ts`. Types are `z.infer`, never hand-written duplicates.

### 3.2 Core schemas (actual code)

```ts
// packages/contracts/src/common.ts
import { z } from "zod";

export const Timestamp = z.iso.datetime({ offset: true });

export const Confidence = z.enum(["confirmed", "assumed", "unknown"]);
export const Source = z.enum([
  "switch", "power_meter", "hdmi_switch", "mixer", "ir", "sensor", "manual", "none",
]);
export const ClientLabel = z.enum(["room screen", "phone", "tablet", "laptop", "podium PC"]);
export const ChangedBy = z.union([ClientLabel, z.literal("by hand"), z.literal("schedule")]);

/** Wraps every hardware value: what the server believes and how sure it is. */
export const observed = <T extends z.ZodType>(value: T) =>
  z.object({
    value: value.nullable(),
    confidence: Confidence,
    source: Source,
    updated_at: Timestamp.nullable(), // null = never reported (H11)
    stale: z.boolean(),                // computed by core-api (R13)
    changed_by: ChangedBy.nullable(),
  });
export type Observed<T> = {
  value: T | null; confidence: z.infer<typeof Confidence>; source: z.infer<typeof Source>;
  updated_at: string | null; stale: boolean; changed_by: z.infer<typeof ChangedBy> | null;
};

export const AccessLevel = z.enum(["view", "control", "technician"]);
export const Level = z.number().int().min(0).max(100);
```

```ts
// packages/contracts/src/domain/*.ts (condensed)
export const RoomStatus = z.object({
  level: z.enum(["normal", "degraded", "fault"]),
  text: z.string(),                                     // "All systems normal"
});
export const Room = z.object({
  id: z.string(),                                       // "R-101"
  hostname: z.string(),                                 // "r-101.local"
  status: RoomStatus,
});

export const DeviceKind = z.enum([
  "projector", "hdmi_switch", "projection_screen", "lights", "ac", "audio",
  "power_socket", "sensor", "ir_blaster", "coordinator", "other", // "other": S3.E9
]);
export const Transport = z.enum(["zigbee", "ir_zs06", "ir_mcu", "local"]);
export const OutputKind = z.enum(["switch", "level", "select", "position", "momentary"]);
export const OutputId = z.enum([
  "display.source", "projector.ir", "projector.mains", "screen", "audio.mic", "audio.pc",
  "lights.front", "lights.rear", "ac",
]);
export const Output = z.object({ id: OutputId, name: z.string(), kind: OutputKind });
export const Device = z.object({
  id: z.string(), name: z.string(), kind: DeviceKind, transport: Transport,
  brand: z.string().nullable(), model: z.string().nullable(),
  hw_ref: z.string().nullable(),                        // z2m friendly name, port, …
  online: observed(z.boolean()),
  outputs: z.array(Output),
});

export const HdmiInput = z.enum(["podium_pc", "smart_board"]);
export const ProjectorState = z.enum(["standby", "warming_up", "running", "cooling_down", "unknown"]);
export const ScreenPosition = z.enum(["raised", "lowered", "moving", "unknown"]);
export const PowerReading = z.object({
  watts: z.number(), volts: z.number(), kwh_today: z.number(), rating_a: z.number(), at: Timestamp,
});
export const ProjectorFeedback = z.object({            // H7b
  last_ir: z.enum(["power_on", "power_off"]).nullable(),
  sent_at: Timestamp.nullable(),
  phase: z.enum(["idle", "waiting_for_draw", "no_change"]),
});

export const AudioChannel = z.enum(["mic", "pc"]);
export const AudioState = z.object({
  channels: z.object({ mic: observed(Level), pc: observed(Level) }),
  muted_all: observed(z.boolean()),
  saved_levels: z.object({ mic: Level.nullable(), pc: Level.nullable() }), // R9
});

export const LightGang = z.enum(["front", "rear"]);
export const AcState = z.object({                      // R3: never "confirmed"
  power: observed(z.enum(["on", "off"])),
  setpoint_c: observed(z.number().int()),
  available_setpoints: z.array(z.number().int()),       // R4: captured frames only, ascending
});

export const SensorKind = z.enum(["temperature", "humidity", "occupancy", "contact"]);
export const SensorReading = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("temperature"), value: z.number().nullable() }),
  z.object({ kind: z.literal("humidity"), value: z.number().int().nullable() }),
  z.object({ kind: z.literal("occupancy"), value: z.enum(["detected", "clear"]).nullable() }),
  z.object({ kind: z.literal("contact"), value: z.enum(["open", "closed"]).nullable() }),
]).and(z.object({ node: z.string(), at: Timestamp.nullable(), stale: z.boolean() }));

export const ZigbeeNode = z.object({
  ieee: z.string(), friendly_name: z.string(), model: z.string(),
  role: z.enum(["router", "end_device"]), power_source: z.enum(["mains", "battery"]),
  lqi: z.number().int().min(0).max(255).nullable(),
  battery_pct: z.number().int().min(0).max(100).nullable(),
  last_seen: Timestamp.nullable(), online: z.boolean(),
});
export const Coordinator = z.object({
  model: z.string(), chipset: z.string(), firmware: z.string(), channel: z.number().int(),
  tx_power_dbm: z.number(), port: z.string(), antenna: z.string(),
  status: z.enum(["online", "offline", "starting"]),
});
export const Mesh = z.object({
  paired: z.number().int(), routers: z.number().int(), end_devices: z.number().int(),
  joining: z.discriminatedUnion("state", [
    z.object({ state: z.literal("closed") }),
    z.object({ state: z.literal("open"), until: Timestamp }),
  ]),
});
export const IrBlaster = z.object({
  id: z.string(), topic: z.string(), lqi: z.number().int().nullable(),
  coverage: z.string(), power: z.literal("mains"), online: observed(z.boolean()),
});
export const Interlock = z.object({                    // R11, Q7
  status: z.enum(["armed", "holding", "bypassed"]), rule_text: z.string(),
});

export const IrTestStatus = z.enum(["untested", "reacted", "no_reaction"]);
export const IrCommand = z.object({
  id: z.string(), device_id: z.string(), name: z.string(),
  role: z.enum(["power_on", "power_off", "setpoint", "other"]),
  setpoint: z.object({ temp_c: z.number().int(), mode: z.string(), fan: z.string() }).nullable(),
  code_format: z.literal("tuya"),
  captured: z.boolean(),                                // code itself is technician-only (IrCommandDetail)
  captured_at: Timestamp.nullable(),
  test: IrTestStatus, tested_at: Timestamp.nullable(),
});
export const IrDevice = z.object({                     // a Device whose transport is ir_*
  device_id: z.string(), name: z.string(), brand: z.string(),
  kind: z.enum(["projector", "ac", "other"]), transport: z.enum(["ir_zs06", "ir_mcu"]),
  commands: z.array(IrCommand),
});
```

```ts
// packages/contracts/src/state.ts — the full snapshot pushed to every client
export const RoomState = z.object({
  rev: z.number().int().nonnegative(),                  // monotonic; client drops older revs
  server_time: Timestamp,
  room: Room,
  connection: z.object({ hw: z.enum(["up", "down"]) }),
  display: z.object({
    source: observed(HdmiInput),
    projector: z.object({
      state: observed(ProjectorState),
      power: observed(PowerReading),
      feedback: ProjectorFeedback,
      mains: observed(z.boolean()),
    }),
    screen: observed(ScreenPosition),
  }),
  audio: AudioState,
  environment: z.object({
    lights: z.object({ front: observed(z.boolean()), rear: observed(z.boolean()) }),
    ac: AcState,
    sensors: z.object({
      temperature: SensorReading, humidity: SensorReading,
      occupancy: SensorReading, contact: SensorReading,
      reporting: z.object({ count: z.number().int(), of: z.number().int() }), // S1.E41
    }),
  }),
  zigbee: z.object({ coordinator: Coordinator, mesh: Mesh, nodes: z.array(ZigbeeNode) }),
  ir_blaster: IrBlaster,
  interlock: Interlock,
  devices: z.array(Device),                              // online state per device (H8)
});
```

```ts
// packages/contracts/src/domain/command.ts
export const CommandBody = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("source.select"), input: HdmiInput }),
  z.object({ kind: z.literal("projector.power"), on: z.boolean() }),
  z.object({ kind: z.literal("projector.mains"), on: z.boolean() }),           // technician, R11
  z.object({ kind: z.literal("screen.move"), to: z.enum(["raise", "lower"]) }),
  z.object({ kind: z.literal("audio.level"), channel: AudioChannel, level: Level, final: z.boolean() }),
  z.object({ kind: z.literal("audio.mute_all"), muted: z.boolean() }),
  z.object({ kind: z.literal("lights.set"), gang: LightGang, on: z.boolean() }),
  z.object({ kind: z.literal("ac.power"), on: z.boolean() }),
  z.object({ kind: z.literal("ac.step"), direction: z.enum(["down", "up"]) }),
]);
export const CommandRequest = z.object({ client_cmd_id: z.uuid(), body: CommandBody });
export const CommandStatus = z.enum(["pending", "sent", "confirmed", "assumed", "failed", "timed_out"]);
export const Command = z.object({
  id: z.string(), client_cmd_id: z.uuid(), body: CommandBody,
  issued_by: z.object({ public_id: z.string(), label: ClientLabel }).nullable(), // null = schedule
  status: CommandStatus, error: z.string().nullable(), at: Timestamp,
});

// packages/contracts/src/domain/session.ts
export const ClientSession = z.object({
  public_id: z.string(),                                 // safe to broadcast; never the cookie id
  client_type: z.enum(["kiosk", "remote"]),
  label: ClientLabel,
  access: AccessLevel,
  unlocked_at: Timestamp.nullable(), last_activity: Timestamp.nullable(), expires_at: Timestamp.nullable(),
});
```

### 3.3 Full contract list

| File | Schemas |
|---|---|
| `common.ts` | Timestamp, Confidence, Source, ClientLabel, ChangedBy, `observed()`, AccessLevel, Level |
| `domain/room.ts` | Room, RoomStatus |
| `domain/device.ts` | DeviceKind, Transport, OutputKind, OutputId, Output, Device, DevicePatch |
| `domain/display.ts` | HdmiInput, ProjectorState, ScreenPosition, PowerReading, ProjectorFeedback |
| `domain/audio.ts` | AudioChannel, AudioState |
| `domain/environment.ts` | LightGang, AcState, SensorKind, SensorReading |
| `domain/zigbee.ts` | ZigbeeNode, Coordinator, Mesh |
| `domain/ir.ts` | IrBlaster, IrDevice, IrCommand, IrCommandDetail (+`code`), IrTestStatus, IrSetpoint, IrCaptureStatus |
| `domain/interlock.ts` | Interlock |
| `domain/schedule.ts` | Weekday, ClassBlock, TimedAction (steps: `CommandBody[]`) |
| `domain/session.ts` | ClientSession |
| `domain/command.ts` | CommandBody, CommandRequest, CommandStatus, Command |
| `domain/system.ts` | NetworkInfo (hostname, address, connection, controller, clients[]), AboutInfo (room, version, uptime_s, pi_model, url) |
| `state.ts` | RoomState |
| `api/session.ts` | `GET /api/session` → ClientSession · `POST /api/session/login` {level: control\|technician, pin, label} → ClientSession \| PinError {reason: wrong\|locked, retry_after_s, attempts_left} · `POST /api/session/lock` → ClientSession |
| `api/state.ts` | `GET /api/state` → RoomState |
| `api/commands.ts` | `POST /api/commands` CommandRequest → 202 Command · ApiError |
| `api/ir.ts` | `GET /api/ir/devices` → IrDevice[] · `POST /api/ir/devices` IrDeviceCreate · `PATCH /api/ir/devices/:id` · `POST /api/ir/devices/:id/commands` IrCommandCreate → IrCommand · `DELETE /api/ir/commands/:id` · `POST /api/ir/commands/:id/learn` · `POST /api/ir/commands/:id/learn/cancel` · `POST /api/ir/commands/:id/test` · `POST /api/ir/commands/:id/test-result` {reacted} |
| `api/schedule.ts` | CRUD `/api/schedule/blocks`, `/api/schedule/actions` (ClassBlockInput, TimedActionInput) |
| `api/devices.ts` | `GET /api/devices` → Device[] · `PATCH/DELETE /api/devices/:id` · `POST /api/zigbee/permit-join` {seconds: 240} |
| `api/settings.ts` | `PUT /api/settings/pins/room` {pin: 4 digits} · `PUT /api/settings/pins/technician` {pin: 6 digits} |
| `api/system.ts` | `GET /api/system/network` → NetworkInfo · `GET /api/system/about` → AboutInfo · `POST /api/system/restart` |
| `api/errors.ts` | ApiError {code: unauthorized\|forbidden\|validation\|precondition\|hw_unavailable\|not_found, message} |
| `ws.ts` | ServerEvent: `snapshot` {state} · `state` {state} · `command` {command} · `activity` {text, by: ChangedBy, public_id} · `ir_capture` {command_id, status: listening\|captured\|timeout\|cancelled\|failed, deadline} · `invalidate` {keys} · `session` {session} · `ping` · ClientMessage: `hello` {label} · `pong` |
| `hw/*.ts` | §3.4 |

Every SPEC entity has a home: Room/Observed/Device/Output/derived states/PowerReading/
SensorReading/IrDevice/IrCommand/IrBlaster/ZigbeeNode/Coordinator/Mesh/Interlock/Command/
ClientSession/Schedule above. SPEC's generic `Output.state` is realised by the typed sections of
`RoomState`; `Output` itself is registry metadata and the command target id.

### 3.4 core-api ↔ hw-service contract

hw-service reports **raw facts**; it knows nothing about confidence, attribution, staleness,
projector phases or sessions. All of that is derived in core-api (§6.4).

**HTTP commands** (core-api → hw, `http://127.0.0.1:8081`, JSON, timeout per transport):

| Endpoint | Body | Response |
|---|---|---|
| `GET /v1/health` | — | `{ok, mode: fake\|real, modules: {name: fake\|real}}` |
| `GET /v1/snapshot` | — | `HwSnapshot` |
| `POST /v1/lights/set` | `{gang: front\|rear, on}` | `HwAck` |
| `POST /v1/projector_power/relay` | `{on}` | `HwAck` |
| `POST /v1/ir/send` | `{transport: ir_zs06\|ir_mcu, code_format: tuya, code}` | `HwAck` |
| `POST /v1/ir/learn` | `{transport, timeout_s}` (blocks ≤ timeout) | `{status: captured, code_format, code}` \| `{status: timeout\|cancelled}` |
| `POST /v1/ir/learn/cancel` | — | `HwAck` |
| `POST /v1/hdmi/select` | `{input: podium_pc\|smart_board}` | `HwAck` |
| `POST /v1/projection_screen/move` | `{to: raise\|lower}` | `HwAck` |
| `POST /v1/audio/level` | `{channel: mic\|pc, level}` | `HwAck` |
| `POST /v1/audio/mute` | `{channel, muted}` | `HwAck` |
| `POST /v1/zigbee_status/permit_join` | `{seconds}` | `HwAck` |
| `POST /v1/_fake/<module>/<event>` | module-specific | fake mode only (simulate "by hand", sensor changes, offline) |

`HwAck = {ok: true} | {ok: false, error: {code: device_offline|timeout|transport|invalid, message}}`.
An ack means "accepted by the transport", **not** "state changed". State changes only arrive as
events.

**Event stream:** `GET /v1/events` (Server-Sent Events). On connect the first event is always
`snapshot` (full `HwSnapshot`); then incremental events. Each event:
`{type, at, data}`, SSE `event:` = `type`.

| `type` | `data` |
|---|---|
| `snapshot` | HwSnapshot (every field below, nullable when unknown) |
| `lights.state` | `{gang, on}` |
| `projector_power.relay` | `{on}` |
| `projector_power.reading` | `{watts, volts, energy_kwh_total}` |
| `hdmi.state` | `{input}` |
| `projection_screen.state` | `{position: raised\|lowered\|moving\|unknown}` |
| `audio.state` | `{channel, level, muted}` |
| `sensors.reading` | `{node, kind, value}` |
| `zigbee.node` | ZigbeeNode-shaped raw (ieee, friendly_name, model, role, power_source, lqi, battery_pct, last_seen, online) |
| `zigbee.coordinator` | Coordinator-shaped raw |
| `zigbee.mesh` | `{joining_until: ts\|null}` (counts are derived by core from nodes) |
| `ir.blaster` | `{online, lqi}` |
| `ir.learn` | `{status: listening\|captured\|timeout\|cancelled}` |
| `hw.error` | `{module, code, message}` |
| `heartbeat` | `{}` every 5 s |

**Keeping pydantic in sync:**
1. zod in `packages/contracts/src/hw/` is the source of truth. `pnpm --filter @eduscope/contracts
   export-hw-schema` writes `generated/hw.schema.json` (committed, for reference/review).
2. Pydantic models in `services/hw/app/modules/*/schemas.py` and `app/contracts.py` are
   hand-written, field-for-field, with `model_config = ConfigDict(extra="forbid")`.
3. `packages/contracts/fixtures/hw/*.json` holds one golden example per request, response and
   event type. Vitest parses each with zod; `services/hw/tests/test_contract_fixtures.py` parses
   each with the matching pydantic model and re-serialises it (`model_dump(mode="json")`) and
   compares. Both run in `pnpm verify`.
4. A hw contract change touches zod + pydantic + fixtures in **one commit**. A fixture without a
   pydantic match fails pytest by design (the test maps fixture filename → model).

---

## 4 Frontend architecture (apps/kiosk)

### 4.1 Responsive layout

- **Mobile-first, one component tree per screen.** Base classes = phone (<600). Tailwind
  breakpoints are redefined to SPEC §2.2: `sm` = 600px, `lg` = 1024px. Only `sm:` and `lg:` are
  used; `md`, `xl`, `2xl` are removed from the theme.
- **S1:** `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`. At `sm`, Display + Audio stack in the
  left column (`sm:col-start-1`), Environment spans the right column (`sm:row-span-2`). At 1280×800
  `lg` must fit without scrolling: page is `lg:h-dvh lg:overflow-hidden` with flex columns.
  Phone: section anchors + sticky `BottomNav` (`sm:hidden`) with three 48px segments.
- **S2/S3:** `grid lg:grid-cols-[3fr_1fr]` (S3: `lg:grid-cols-[22%_1fr]`); side column drops below
  under `lg`. Battery table: `<table>` at `sm:` and up, card list below (`sm:hidden` /
  `hidden sm:table`) — same data, two markups in one component, allowed only for tables.
- **S3 remote config on phone:** master → detail through the route
  (`/settings/remote` = list, `/settings/remote/:deviceId` = detail). At `lg` both panes render
  side by side for either route.
- Header: one `Header` component; clock/date `hidden lg:flex`, labels collapse to icons below `sm`.
- 16px gutter (`px-4`) below `lg`, 24px (`lg:px-6`). No horizontal page scroll at any width
  (`overflow-x-clip` on the shell; S3 tab strip scrolls inside itself).

### 4.2 Design tokens → Tailwind v4

`src/styles/tokens.css` is the **only** file containing colour literals:

```css
@import "tailwindcss";
@theme {
  --breakpoint-sm: 600px;  --breakpoint-md: initial;  --breakpoint-lg: 1024px;
  --breakpoint-xl: initial; --breakpoint-2xl: initial;
  --color-bg: #0E1621;  --color-header: #121B27;  --color-surface: #151F2C;
  --color-surface-2: #1B2635;  --color-control: #1C2938;  --color-border: #243140;
  --color-border-strong: #33414F;  --color-border-dashed: #3A4757;
  --color-text-1: #E6EBF0;  --color-text-2: #9AA6B2;  --color-text-3: #6C7A88;
  --color-accent: #34D399;  --color-accent-fill: #1E3A2B;  --color-accent-border: #3FCF7F;
  --color-selected-fill: #1B3A48;  --color-toggle-on: #3A9A5F;  --color-toggle-off: #2A3644;
  --color-knob: #F2F4F6;  --color-warn: #F2A93B;  --color-warn-fill: #3B2A10;
  --color-brand: #E5483F;  --color-danger: #F0524F;  --color-danger-fill: #3A1618;
  --color-callout-fill: #11261C;  --color-callout-border: #2F7A50;
  --color-badge-router-fill: #1F4A33;  --color-badge-router-text: #4ADE80;
  --radius-card: 10px; --radius-btn: 8px; --radius-chip: 6px;
  --font-sans: "Inter Variable", system-ui, sans-serif;
  --font-mono: "JetBrains Mono Variable", ui-monospace, monospace;
  /* type scale from SPEC §3.2 as --text-* tokens: wordmark, clock, title, section, card-title,
     caption, button, value, sensor-label */
}
/* shadcn variables mapped onto our tokens, never new colours */
:root { --background: var(--color-bg); --foreground: var(--color-text-1);
        --card: var(--color-surface); --border: var(--color-border); --input: var(--color-border-strong);
        --primary: var(--color-accent); --destructive: var(--color-danger); --ring: var(--color-text-2);
        --radius: 8px; color-scheme: dark; }
```

Fonts are self-hosted via `@fontsource-variable/inter` and `@fontsource-variable/jetbrains-mono`
(the Pi may have no internet). Spacing uses Tailwind's default 4px scale (matches SPEC §3.3).
State styling (SPEC §3.4) lives in one place: `components/state-styles.ts` maps
`(confidence, active, pending, offline)` → class names; components never pick state colours
themselves.

### 4.3 Routing

`react-router` v7 (library mode, `createBrowserRouter`):

| Path | Screen | Guard |
|---|---|---|
| `/` | S1 Control | — |
| `/devices` | S2 Zigbee devices | — |
| `/settings` | redirect → `/settings/remote` | technician |
| `/settings/remote(/:deviceId)` | S3 | technician |
| `/settings/network` · `/schedule` · `/devices` · `/about` | S3b–S3e | technician |
| `*` | redirect → `/` | — |

S4 PIN is an overlay (not a route) rendered by `AppShell`. The settings guard calls
`requireAccess("technician")`; cancel → navigate to `/`. Losing technician while on `/settings/*`
navigates to `/` (H24). core-api serves `index.html` for any non-`/api`, non-`/ws` GET.

### 4.4 Data layer

```ts
// src/data/api-client.ts
export interface ApiClient {
  getSession(): Promise<ClientSession>;
  login(req: LoginRequest): Promise<LoginResult>;          // ClientSession | PinError
  lock(): Promise<ClientSession>;
  getState(): Promise<RoomState>;
  sendCommand(req: CommandRequest): Promise<Command>;
  ir: { listDevices(): Promise<IrDevice[]>; createDevice(...); updateDevice(...);
        createCommand(...); deleteCommand(...); learn(id): Promise<void>; cancelLearn(id): Promise<void>;
        test(id): Promise<void>; recordTest(id, reacted: boolean): Promise<IrCommand> };
  schedule: { list(): Promise<Schedule>; upsertBlock(...); deleteBlock(...);
              upsertAction(...); deleteAction(...) };
  devices: { list(): Promise<Device[]>; update(...); remove(...); permitJoin(): Promise<void> };
  settings: { setRoomPin(pin): Promise<void>; setTechnicianPin(pin): Promise<void> };
  system: { network(): Promise<NetworkInfo>; about(): Promise<AboutInfo>; restart(): Promise<void> };
  connect(handlers: RealtimeHandlers): RealtimeConnection;  // WS (http) or in-memory (mock)
}
```

- `VITE_API_MODE=mock|http` (default `mock` in `.env.development` until M06, `http` in prod
  build). `createApiClient()` picks the adapter; nothing else knows which is active.
- **http adapter:** `fetch` with `credentials: "same-origin"`, every response parsed with the
  contracts schema; non-2xx → typed `ApiError`. WS at `ws(s)://${location.host}/ws`.
- **mock adapter:** an in-memory `FakeRoom` that owns a `RoomState`, applies commands with
  200–600 ms latency, runs the R1 draw ramp, AC assumed, mute/restore, PIN `1234` / `123456`,
  and emits the **same `ServerEvent`s** through `connect()`. A dev-only panel (`?mock-panel`)
  can fire "by hand", "from phone", offline, disconnect. The mock approximates the domain rules
  in its own code; it never imports from `apps/core-api` (`packages/contracts` stays schema-only).
- **Query keys** (`query-keys.ts`, the only place keys are built):
  `["session"]`, `["state"]`, `["ir","devices"]`, `["schedule"]`, `["devices"]`,
  `["system","network"]`, `["system","about"]`.
- `["state"]` uses `staleTime: Infinity`, `refetchOnWindowFocus: false`; the WS is the only
  updater after the first fetch. Selectors (`useRoomState(s => s.display.projector)`) keep
  re-renders local.

### 4.5 Realtime: WS → cache, reconnect, resync

`data/realtime/connection.ts` is a small state machine exposed via a `lib/store.ts` external store
(`useSyncExternalStore`, no extra library):

```
connecting ──open+snapshot──▶ live ──close/err/ping-miss──▶ reconnecting ──10 s──▶ unreachable
     ▲                          ▲                               │  backoff 0.5,1,2,4,8 s ±20%   │
     └──────── Retry button / visibilitychange(visible) / online event ────────────────────────┘
                                └── on snapshot after a drop: "back_online" for 2 s, then live
```

- Server sends `ping` every 10 s; no frame for 25 s ⇒ treat as dead and reconnect.
- On `visibilitychange` → `visible` (phone wakes, H4) or `online`: if not `live` or last frame >
  15 s ago, close and reconnect immediately (reset backoff). Until the new `snapshot` arrives the
  UI shows reconnecting, never pre-sleep values as current.
- Event handling (`apply-event.ts`, pure, unit-tested):
  - `snapshot` → `setQueryData(["state"])`, clear all pending commands, `invalidate` all
    non-state queries, set `back_online` if previously dropped.
  - `state` → `setQueryData(["state"])` only if `rev` > cached `rev`.
  - `command` → update pending store; terminal status clears the overlay; `failed`/`timed_out`
    → InlineError on that card for 6 s (H6a/H6b).
  - `activity` → toast (H13) unless `public_id` = own session.
  - `ir_capture` → capture store for the S3 row (H21); `invalidate` → `invalidateQueries`.
  - `session` → `setQueryData(["session"])` (expiry/lock pushed by the server, H24).
- On connect the client sends `hello {label}` (client label from `lib/client-label.ts`: kiosk is
  decided by the server; otherwise width/touch → phone/tablet/laptop; `?podium=1` once stores
  "podium PC" in localStorage, Q19).
- **Connection-status indicator:** `ConnectionBanner` (S1.E9/H2–H4) reads the connection store.
  `useControlGate()` = `{enabled, reason: "locked"|"disconnected"|"offline"|null}` combines
  connection, session access and device online; every control uses it, so "reconnecting ⇒
  all controls disabled, values greyed" is enforced in one hook.
- Server clock: `server_time` from each state frame updates a time-offset; the header clock
  renders server time (S1.E2).

### 4.6 Command flow (pending → confirmed / assumed / failed)

SPEC forbids optimistic values (R12, H5). The only optimistic thing is the pending overlay:

1. `useCommand(outputId)` → `send(body)`: if gate closed → open PIN (view) or ignore
   (disconnected). If a command for this output is pending → ignore (H5).
2. Generate `client_cmd_id`, add `{outputId, client_cmd_id, status: "pending"}` to the pending
   store, POST `/api/commands`.
3. HTTP error → remove pending, show InlineError. 202 → keep pending.
4. WS `command` events advance status: `sent` (keep), `confirmed`/`assumed` (clear),
   `failed`/`timed_out` (clear + InlineError). Displayed values only change via `state`.
5. Safety net: pending older than (transport timeout + 5 s) is cleared locally.

**Sliders (`LevelSlider`):** while the pointer is down the thumb follows local state; sends
`audio.level` with `final: false` at most every 200 ms and `final: true` on release; incoming
state for that channel is ignored while dragging and applied on release (SPEC §2.4). Dragging
while `muted_all` sends `audio.mute_all {muted:false}` first (Q8b assumption).

### 4.7 PIN screen and session handling

- `features/pin/`: `PinOverlay` (S4) with `PinPad` (64×64 keys, lower half on phone), auto-submit
  at 4/6 digits, shake + "Wrong PIN", lockout countdown from `retry_after_s` (H17).
- `useRequireAccess(level)` returns `ensure(): Promise<boolean>`; opens the overlay if
  `session.access` is insufficient. After unlock the original tap is **not** replayed (SPEC S1).
- `session` query is the client's view of access; it only decides **what to show** (padlocks,
  Lock button, Settings guard). Every enforcement happens in core-api (§5).
- Kiosk (`client_type === "kiosk"`): `features/kiosk/` adds idle timers (2 min → navigate `/`
  and `lock()` technician; 5 min → dim overlay 80% black; 15 min → black), the wake-tap guard
  (a capture-phase `pointerdown` listener swallows the first tap while dimmed/blank, R15),
  occupancy `detected` transition wakes, and CSS guards (`user-select:none`,
  `-webkit-touch-callout:none`, `touch-action:manipulation`, `cursor:none`, contextmenu
  prevented).

### 4.8 Component layering

| Layer | Contains | May import |
|---|---|---|
| `ui/` | shadcn primitives, restyled with tokens only | nothing app-specific |
| `components/` | domain-aware visual pieces (StateDot, ObservedLine, CommandButton…) | `ui/`, contracts types, `lib/` |
| `features/<screen>/` | pages and cards for one screen, hooks that select state | `components/`, `ui/`, `data/` |
| `data/` | ApiClient, adapters, realtime, commands, query keys | contracts, `lib/` |
| `app/` | shell, router, providers | everything |

Features never import from other features (shared things move to `components/`).
Pressed state on touch-down: `active:` styles plus `data-pressed` set on `pointerdown`.
No `hover:`-only affordances.

---

## 5 Access control

| Level | Granted by | Can |
|---|---|---|
| `view` | default, no cookie | `GET /api/state`, `GET /api/session`, WS |
| `control` | room PIN (4 digits); kiosk always | + `POST /api/commands` (except technician kinds) |
| `technician` | technician PIN (6 digits), on every client incl. kiosk | + everything under `/api/ir`, `/schedule`, `/devices`, `/settings`, `/system`, `projector.mains` |

- **PIN storage:** `settings` rows `room_pin_hash`, `technician_pin_hash` =
  `scrypt$N$r$p$salt$hash` via `node:crypto.scrypt`; compared with `timingSafeEqual`. Seeded from
  `INITIAL_ROOM_PIN` / `INITIAL_TECH_PIN` on first boot only; changed in S3d.
- **Login:** `POST /api/session/login {level, pin, label}`. Success → new `sessions` row
  (random 32-byte id, `public_id`, access, client_type, label, ip, timestamps) and cookie
  `ec_sid` = signed id (`@fastify/cookie`, `COOKIE_SECRET`), `HttpOnly; SameSite=Strict; Path=/`,
  no `Secure` (plain HTTP). Technician login upgrades the existing session row.
- **Lock:** `POST /api/session/lock` deletes the row (kiosk: drops back to `control`), clears the
  cookie, pushes `session` to that session's sockets.
- **Expiry (server-side, checked on every request and by a 15 s sweep):**
  control = min(last_activity + 2 h, end of current class block); technician = last_activity +
  15 min (kiosk: 2 min). Activity = any authorised mutation. Expiry downgrades the row and pushes
  a `session` event.
- **Kiosk exemption:** if `LOCALHOST_IS_KIOSK=true` and `request.socket.remoteAddress` ∈
  {`127.0.0.1`, `::1`, `::ffff:127.0.0.1`}, the request is `client_type: kiosk`, label
  "room screen", baseline `control`. `trustProxy` is false, so headers can't fake it. A kiosk
  session row is only honoured from a loopback address. Dev sets `LOCALHOST_IS_KIOSK=false`
  (the Vite proxy makes everyone look local).
- **Guard:** `plugins/auth.ts` decorates `request.session` (resolved access) and exports
  `requireAccess(level)`. Every non-GET route declares
  `config: { access: "control" | "technician" }`; an `onRoute` hook **throws at startup** if a
  non-GET route lacks it (public exceptions: `login`, `lock`). Command access is per `kind`
  (`commands/policies.ts`). Technician-only GETs declare it too.
- **CSRF:** mutations require `Content-Type: application/json` and an `Origin` whose host equals
  `Host` (`plugins/origin-check.ts`); WS upgrade checks `Origin` the same way.
- **WS is receive-only.** Commands only go over HTTP, so the guard above covers them all.
  Inbound frames other than `hello`/`pong` are dropped; >4 KB frames close the socket.
- **Throttle (in memory):** per `(ip, level)`: 5 wrong → locked 60 s (H17), response carries
  `retry_after_s`. Global: >20 failures/min across all IPs locks PIN entry for everyone for 60 s.
  Failures are written to `event_log`.
- Out of scope: user accounts, OAuth, HTTPS. Accepted risk: cookies can be sniffed on the LAN
  (D-12); revisit with a decision record if IT requires HTTPS.

---

## 6 core-api architecture

### 6.1 Plugins and routes

`buildApp(deps)` registers, in order: `errors` → `@fastify/cookie` → `auth` → `origin-check` →
`@fastify/websocket` + `realtime` → route plugins under `/api` → `@fastify/static`
(`KIOSK_DIST`, SPA fallback). Route handlers are thin: validate with contracts (zod via
`fastify-type-provider-zod`), call a service, return. `deps` = `{db, store, hw, clock, config}`
so tests inject fakes (fake hw client, fixed clock, `:memory:` SQLite).

### 6.2 Drizzle schema (SQLite, WAL, `foreign_keys=ON`)

| Table | Columns | SPEC home |
|---|---|---|
| `settings` | `key` PK, `value` (json text), `updated_at` | room id, hostname, PIN hashes, kWh midnight baseline, interlock bypass |
| `devices` | `id` PK, `name`, `kind`, `transport`, `brand`, `model`, `hw_ref`, `sort` | Device/Output registry, S3d, IrDevice (transport ir_*) |
| `ir_commands` | `id` PK, `device_id` FK→devices (cascade), `name`, `role`, `setpoint_temp_c`, `setpoint_mode`, `setpoint_fan`, `code_format`, `code` (nullable), `captured_at`, `test`, `tested_at` | IrCommand, R4, R5 |
| `sessions` | `id` PK, `public_id` unique, `access`, `client_type`, `label`, `ip`, `created_at`, `last_activity`, `expires_at` | ClientSession |
| `class_blocks` | `id` PK, `days` (json Weekday[]), `start` "HH:MM", `end` "HH:MM" | Schedule.class_blocks, §2.3 |
| `timed_actions` | `id` PK, `name`, `time` "HH:MM", `days` json, `enabled`, `steps` (json CommandBody[]) | Schedule.actions |
| `event_log` | `id` autoinc, `at`, `type` (command\|state\|session\|pin_failure\|hw\|system), `actor` (label/"by hand"/"schedule"/null), `public_id`, `subject`, `payload` json, `result` | Command history, audit; pruned to 30 days nightly |

Live hardware state is **not** stored (it is re-reported by hw on connect; AC is "Unknown" after
start per R3). `seed.ts` (idempotent) inserts the R-101 devices: projector (ir_zs06, Epson, 2
commands placeholders), AC (ir_zs06, Panasonic), lights (zigbee, `r101_lights`), projector socket
(zigbee, `r101_proj_plug`), sensors, HDMI switch, screen, audio, ZS06, coordinator.

**Migrations:** edit `db/schema.ts` → `pnpm --filter @eduscope/core-api db:generate`
(drizzle-kit) → commit the SQL in `drizzle/`. `main.ts` runs `migrate()` on startup before
listening. Generated SQL is never hand-edited; a wrong migration is fixed by a new one.

### 6.3 hw client

- `hw/client.ts`: typed methods per §3.4 command, `fetch` with per-transport timeout
  (`AbortSignal.timeout`): zigbee 5 s, IR send 3 s, IR learn 25 s, hdmi 5 s, mixer 2 s, screen
  5 s (Q12 — all in `config.ts`). Responses parsed with `hw/*` zod. Connection refused / timeout
  → `HwUnavailable` error.
- `hw/stream.ts`: `fetch('/v1/events')` + `eventsource-parser`; every event zod-parsed (invalid
  → logged + dropped); backoff 0.5 → 5 s on drop; no frame for 15 s ⇒ reconnect.
- `hw/ingest.ts`: maps each HwEvent to a `store.update()` call that runs the domain rules.

### 6.4 State store and domain rules

- `domain/state-store.ts`: holds the single `RoomState` in memory. `update(fn, cause)` applies a
  pure mutation, recomputes derived fields (`status`, `sensors.reporting`, `mesh` counts,
  interlock), bumps `rev`, and schedules a broadcast (coalesced to one per 50 ms).
- Pure rule modules (all unit-tested with a fixed clock):
  - `projector.ts` — R1/R2 phases from watts + last IR + direction; H7b `waiting_for_draw` /
    `no_change` after 90 s; confidence `assumed` after IR, `confirmed` once draw agrees.
  - `ac.ts` — R3 always `assumed`/`unknown`; R4 next lower/higher captured setpoint; bounds (H19);
    `ac.step` rejected while off (Q5).
  - `audio.ts` — R9 save levels on mute, restore on unmute.
  - `lights.ts` — R6; a gang change with no matching in-flight command ⇒ `changed_by: "by hand"`.
  - `sensors.ts` — R13 staleness (periodic: 2× interval; event sensors: last_seen > 60 min); a
    10 s timer re-evaluates staleness.
  - `interlock.ts` — R11: `projector.mains off` rejected (precondition error) while watts ≥ 5 and
    not bypassed.
  - `status.ts` — S1.E4 summary: fault (hw down, coordinator offline) > degraded (device offline,
    sensor not reporting, battery ≤ 20 %, one router left R7) > normal.
  - `attribution.ts` — builds the `activity` text "Rear of room turned on · from phone".
- `kwh_today` = `energy_kwh_total` − midnight baseline (baseline persisted in `settings`, reset by
  the scheduler at local midnight).

### 6.5 Commands

`commands/dispatcher.ts`: parse `CommandRequest` → `policies.ts` (required access per kind,
preconditions: device online, blaster online H25, interlock, AC bounds) → create `Command`
(`pending`), log, broadcast `command` → call hw → `sent` or `failed` → await correlating state
event within the transport timeout → `confirmed` (zigbee, mixer, hdmi, screen) / `assumed` (IR:
AC always, projector until draw confirms) / `timed_out`. On confirmation the state change gets
`changed_by` = issuer label and an `activity` broadcast. **Last write wins:** commands are
dispatched in arrival order, no locking; a newer command on the same output supersedes the older
one's correlation. `audio.level` with `final:false` skips logging and activity.

### 6.6 WebSocket fan-out

`plugins/realtime.ts` keeps a `Set` of sockets with `{public_id|null, label, access}` (resolved
from the cookie at upgrade). On connect: send `snapshot` immediately. Every store broadcast sends
`state` (full RoomState) to **all** sockets; `command`, `activity`, `ir_capture`, `invalidate` go
to all; `session` only to that session's sockets. `ping` every 10 s; sockets that miss 2 pongs are
terminated. Connected-clients list (S3b) comes from this set. Sensitive data (IR codes, PIN
anything) never goes over WS.

### 6.7 When hw-service is down

- core-api keeps serving UI, state and auth. `connection.hw = "down"`, after 10 s every
  hw-backed device `online.value=false` (last values kept, marked stale) ⇒ H8/H9, status `fault`
  "Hardware service offline".
- Commands fail fast with `hw_unavailable` (H6a "Command failed"); IR learn/test disabled (H25).
- The stream reconnects with backoff; the first `snapshot` reconciles everything and the status
  recovers. systemd restarts hw-service independently.

### 6.8 Scheduler

One `setInterval` (30 s) in `scheduler/`: runs enabled timed actions due this minute (each step
dispatched as a command with `issued_by: null`, attribution "schedule"), ends control sessions at
class-block end, sweeps expired sessions, resets the kWh baseline at midnight, prunes `event_log`.

### 6.9 IR flows (S3, H20–H22)

Learn: `POST /api/ir/commands/:id/learn` → 202, broadcast `ir_capture listening` with deadline
(20 s) → hw `/v1/ir/learn` → captured ⇒ store code, `test=untested`, broadcast `captured` +
`invalidate ["ir","devices"]`; timeout/cancel ⇒ old code untouched. Test: send the stored code via
hw `/v1/ir/send`; the technician answers via `test-result` (R5). Codes are never compared as text.

---

## 7 hw-service architecture (services/hw)

### 7.1 Module pattern

```
app/modules/<capability>/
  schemas.py      pydantic v2 request/response/event models (mirror packages/contracts/src/hw)
  driver_fake.py  class Fake<Cap>Driver(<Cap>Driver): deterministic, in-memory, emits events
  driver_real.py  class Real<Cap>Driver(<Cap>Driver): talks to hardware (stub until intake)
  service.py      class <Cap>Driver(Protocol) + <Cap>Service(driver, bus): validation, events
  router.py       APIRouter(prefix="/v1/<capability>"); thin, calls the service
```

- `registry.py` builds each service with `fake` or `real` driver from config:
  `HW_MODE=fake|real` plus optional per-module override `HW_DRIVERS="lights=real,ir=fake"`
  (lets Day 5 run real lights while IR is still fake). `/v1/health` reports the choice.
- `config.py`: `pydantic-settings` `Settings` (env prefix `HW_`, `.env` support): `MODE`,
  `DRIVERS`, `HOST=127.0.0.1`, `PORT=8081`, `MQTT_HOST`, `MQTT_PORT`, `Z2M_BASE_TOPIC`, friendly
  names (`LIGHTS_NODE=r101_lights`, `PROJ_PLUG_NODE`, `IR_NODE=r101_ir`, sensor nodes), serial
  ports, `FAKE_TIME_SCALE`. No hardware value is hardcoded in a driver.
- `events.py`: `EventBus` (asyncio; each SSE subscriber gets its own bounded queue; slow
  subscriber ⇒ dropped and must reconnect). `GET /v1/events` (`sse-starlette`) sends `snapshot`
  (assembled from every service's `snapshot()`) then queued events and a 5 s `heartbeat`.
- `transports/mqtt.py` `[ASSUMED]`: one shared `aiomqtt` client used by all zigbee-backed real
  drivers; started in the FastAPI lifespan only when any real zigbee driver is active.
- Fake mode adds `/v1/_fake/...` routes to simulate hardware events (by hand, offline, readings).
- uvicorn is started with `--host 127.0.0.1`; `main.py` refuses to start if `HW_HOST` is not a
  loopback address.

### 7.2 Capability modules (PLACEHOLDERS — real drivers come from hardware intake)

| Module | Commands | Events | Real driver assumption |
|---|---|---|---|
| `lights` | set gang | `lights.state` | ZBM5-2C-86W via zigbee2mqtt `state_l1/state_l2` `[ASSUMED]` |
| `projector_power` | relay on/off | `projector_power.relay`, `.reading` | S60ZBTPG via zigbee2mqtt (power, voltage, energy) `[ASSUMED]` |
| `ir` | send, learn, cancel | `ir.blaster`, `ir.learn` | ZS06 via zigbee2mqtt `ir_code_to_send` / `learn_ir_code` `[ASSUMED]`; `ir_mcu` = ESP32 on GPIO 16/17 via serial `[ASSUMED]` |
| `hdmi` | select | `hdmi.state` | model and read-back unknown (Q1); serial `[ASSUMED]` |
| `projection_screen` | raise/lower | `projection_screen.state` | relay or IR, position source unknown (Q2) `[ASSUMED]` |
| `audio` | level, mute per channel | `audio.state` | ALSA mixer on the Pi via `amixer` (Q8) `[ASSUMED]` |
| `sensors` | — | `sensors.reading` | SNZB-02P/03P/04PR2 via zigbee2mqtt `[ASSUMED]` |
| `zigbee_status` | permit join | `zigbee.node`, `.coordinator`, `.mesh` | zigbee2mqtt `bridge/*` topics; ZG-808Z coordinator `[ASSUMED]` |

### 7.3 Hardware assumptions (all `[ASSUMED]`, confirmed/corrected by prompt 07)

- Zigbee runs through **zigbee2mqtt + mosquitto on the Pi, localhost only** `[ASSUMED]`.
- ZS06 is the Zigbee variant of the Tuya IR blaster, so it is reached via zigbee2mqtt `[ASSUMED]`;
  whether it is in the R-101 mesh is open (Q4).
- Tuya IR codes are opaque base64 strings `[ASSUMED]`.
- Power meter reports at least every 60 s; climate sensor every ~5 min `[ASSUMED]` (Q12).
- HDMI switch has a read-back channel (Q1), screen has a position source (Q2) `[ASSUMED]`.
- Audio mixer is local to the Pi `[ASSUMED]` (Q8).

---

## 8 Testing policy

| What | Tool | How |
|---|---|---|
| Contracts | Vitest | each schema accepts its fixture and rejects a few wrong shapes; all `fixtures/hw` parse |
| Kiosk data layer | Vitest | `apply-event` reducer, connection state machine (fake timers), pending store, query-key builder, mock adapter behaviours |
| Kiosk state logic | Vitest | `state-styles` mapping, `useControlGate`, slider throttle, client-label, formatters |
| core-api domain | Vitest | every rule module R1–R13 with fixed clock and table-driven cases |
| core-api routes + auth | Vitest + `fastify.inject` | every mutating route: 401/403 by level, origin check, PIN throttle/lockout, session expiry, localhost exemption on/off, startup fails if a route lacks `access` |
| core-api commands | Vitest | dispatcher with fake hw client: confirmed / assumed / failed / timed_out / hw down |
| hw-service | pytest + `httpx`/`TestClient` | each module with its fake driver: commands, events on the bus, snapshot; contract fixtures; registry picks drivers |
| Real drivers | pytest, marked `@pytest.mark.hardware` | only run on the Pi (`pytest -m hardware`), excluded from verify |

**Not tested:** pure markup/layout, snapshots, shadcn primitives, CSS. Visual correctness is
checked by eye against `reference/screens` at 1280×800 and 390px during review.

**The one command, green after every task:**

```
pnpm verify   # = pnpm -r typecheck && pnpm lint && pnpm -r test && pnpm hw:check
              #   hw:check = uv run --directory services/hw ruff check . &&
              #              uv run --directory services/hw ruff format --check . &&
              #              uv run --directory services/hw pytest -m "not hardware"
```

---

## 9 Pi deployment (detail in the deploy milestone)

**systemd units.** `eduscope.target` groups `eduscope-hw.service` and `eduscope-core.service`,
both `User=eduscope`, `Restart=always`, `RestartSec=2`, env from `/etc/eduscope/{hw,core}.env`
(mode 600, holds `COOKIE_SECRET`, initial PINs). core runs `node apps/core-api/dist/main.js` with
`AmbientCapabilities=CAP_NET_BIND_SERVICE` and `CapabilityBoundingSet=CAP_NET_BIND_SERVICE` to
bind port 80 without root; it `Wants=`/`After=` hw but does not `Requires=` it, so it serves the
UI while hw is down. Hardening: `NoNewPrivileges`, `ProtectSystem=strict`,
`ReadWritePaths=/var/lib/eduscope`. hw runs `uv run uvicorn app.main:app --host 127.0.0.1 --port
8081` and gets `SupplementaryGroups=dialout gpio audio` for serial/GPIO/ALSA.

**Hostname + mDNS.** `install.sh` sets `hostnamectl set-hostname r-101`; avahi-daemon (on by
default in Bookworm) publishes `r-101.local`. Ask IT for a DHCP reservation and confirm the Wi-Fi
does not isolate clients. The about screen shows URL + QR from `ROOM_HOSTNAME` config.

**Chromium kiosk (optional, Q13).** If a display exists, the desktop user autologins to labwc
(Wayland) and `~/.config/labwc/autostart` runs `deploy/pi/kiosk/launch.sh`:
`chromium --kiosk --noerrdialogs --disable-infobars --disable-pinch --overscroll-history-navigation=0
--check-for-update-interval=31536000 http://localhost`, in a restart loop. Headless Pis skip this;
LAN access is unaffected.

**Screen blanking.** OS blanking is disabled (`raspi-config nonint do_blanking 1`, no
swayidle) so the app owns sleep: dim at 5 min and blank at 15 min are in-app overlays (H23) and the
first tap only wakes (R15). Driving the real backlight is a later hw capability `[ASSUMED]`.

**Crash recovery.** Both services `Restart=always`; core re-runs migrations idempotently, hw
re-sends a snapshot on reconnect, clients resync from the WS snapshot. SQLite in WAL survives
power loss. A `WatchdogSec` + `sd_notify` heartbeat and the hardware watchdog are added in the
hardening milestone. "Restart controller" (S3e) runs `sudo systemctl restart eduscope.target` via
a single-command sudoers entry for `eduscope`.

**Logs.** Both services log to journald (core: pino JSON; hw: uvicorn + stdlib logging):
`journalctl -u eduscope-core -u eduscope-hw -f`. Journald is set persistent with
`SystemMaxUse=200M`. Domain events (commands, PIN failures, hw up/down) also go to `event_log`
in SQLite (30-day retention). Kiosk browser output goes to `~/.cache/eduscope-kiosk.log`.

---

## 10 Decisions log

| # | Decision | Alternatives rejected | Why |
|---|---|---|---|
| D-01 | SPEC wins on role names, hostname `r-101.local`, breakpoints 600/1024 | README/prompt values | SPEC is the approved product source of truth |
| D-02 | Push full `RoomState` on every change (coalesced 50 ms, `rev`) | JSON patches, per-entity events | State is a few KB; resync is trivial; no ordering bugs |
| D-03 | WS is receive-only; commands via HTTP | Commands over WS | One auth path, one guard, easy to test |
| D-04 | No optimistic values; pending overlay only (sliders local while dragging) | Optimistic cache writes | SPEC R12/H5 |
| D-05 | core → hw: HTTP commands + SSE stream that starts with a snapshot | WS, MQTT from core | One-way, simple in FastAPI; reconnect = full truth |
| D-06 | Derived rules (R1–R13) live in core-api; hw reports raw facts | Rules in hw | Pure TS, Vitest-tested; intake only touches drivers |
| D-07 | Server-side `sessions` table + signed cookie id | Stateless JWT | Lock/expiry need revocation; S3b needs a client list |
| D-08 | scrypt (`node:crypto`), hand-written throttle | bcrypt/argon2 natives, @fastify/rate-limit | No extra native builds on the Pi; ~30 lines |
| D-09 | Localhost socket address = kiosk (`control`) | Kiosk token/cookie | Unspoofable from the LAN, nothing to provision |
| D-10 | Tailwind v4 `@theme` tokens in `tokens.css`; shadcn vars mapped onto them | JS theme config, raw hex | One file of colours |
| D-11 | `react-router` v7 library mode | TanStack Router, hand-rolled | Small, well known to agents |
| D-12 | Plain HTTP on the LAN; SameSite=Strict + Origin check | HTTPS with local CA | Certificate handling on a LAN is out of scope this week |
| D-13 | Extra libs: `@fastify/{static,websocket,cookie}`, `fastify-type-provider-zod`, `eventsource-parser`, `react-router`, `lucide-react`, `sonner`, `qrcode`, `@fontsource-variable/*`; py: `pydantic-settings`, `sse-starlette`, `httpx`, `aiomqtt` | — | Each fills one gap |
| D-14 | One gate: `pnpm verify` | Per-package checks | One green/red signal per task |
| D-15 | Live hardware state not persisted | Last-known-state table | R3 ("Unknown" after start); hw re-reports the rest |
| D-16 | Sleep/dim as in-app overlays; OS blanking off | DPMS/backlight | Guarantees "first tap only wakes" |
| D-17 | No Docker, no reverse proxy, no broker of our own | nginx, Docker, Redis | Fewest moving parts on a Pi; mosquitto exists only as a zigbee2mqtt dependency `[ASSUMED]` |
| D-18 | Python: ruff (incl. `ANN` rules) for type-hint enforcement; no mypy this week | mypy/pyright strict | Time; revisit in hardening |
| D-19 | Per-module driver override `HW_DRIVERS` | All-or-nothing `HW_MODE` | Hardware arrives piece by piece |
