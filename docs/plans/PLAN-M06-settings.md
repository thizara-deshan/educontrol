# PLAN-M06 — Settings (S3, S3b–S3e)
Milestone: `docs/milestones/M06-settings.md` · Start tag: `m06-start` · Verify-all: `pnpm verify`

Inputs read for this plan: M06; SPEC §2.2 (S3 phone), §2.3–2.5, §3.1–3.4, S3.E1–E17, S3b–S3e, S4, H1–H6, H20–H25,
§6 (IrDevice/IrCommand, IrBlaster, Schedule, ClientSession), §7.1 (S3 rows), R3–R5, R8, Q22–Q25; ARCHITECTURE §1,
§3.2–3.3, §4.1–4.7, §6.9; CLAUDE.md; PLAN-M05 (format) + REVIEW-M05, D-20 and the M00 backlog;
`reference/screens/03-settings-remote-config.png` (looked at directly; there is no `reference/prototype/`); the current
code (`apps/kiosk`, `packages/contracts`). **No contract changes are needed** (decision D1).

## Executor notes (read once, apply to every task)

- Paths are relative to the repo root `/home/rust-cohle/edcontrol`. Kiosk code imports with the `@/` alias and
  **no** file extension. `verbatimModuleSyntax`, `exactOptionalPropertyTypes`, `noUnusedLocals` and
  `noUncheckedIndexedAccess` are on.
- Before T1: `git tag m06-start` (on the commit that adds this plan).
- **Every code block in this plan was compiled, linted and tested**, and the plan was **replayed task by task by a
  script that applies the blocks exactly as written** in a fresh worktree from `main` (1bdf5ba) with typecheck + lint +
  all Vitest green after every task. The finished app was driven in headless Chromium (dev server and the mock
  `vite preview` build) at 1280×800, 800×1000 and 390×844; the numbers in T51 come from those runs. Apply code
  blocks **verbatim**:
  - "Create `X`" / "Replace the whole file `X`" = the block is the full file content (end it with one newline);
  - "In `X` replace: … with: …" = an exact, unique text replacement (the old text occurs once; an empty "with" block
    deletes the old text);
  - "Append to `X`" = add one empty line, then the block, at the end of the file;
  - "Run `cmd`" = run it from the repo root.
- Tests run in Vitest's `node` environment (no DOM). Only pure logic is tested (`*.view.ts` selectors, reducers,
  validators, the capture store, mock stores, the http adapter). Components are checked by eye (CLAUDE.md: no tests of
  pure markup).
- No `as` casts other than `as const`. No hex/rgb literals outside `tokens.css`. Tailwind class strings stay literal.
  Arbitrary values in this plan (`grid-cols-[minmax(0,2fr)_minmax(0,3fr)_12.5rem]`, `max-h-[90dvh]`,
  `[scrollbar-width:none]`) are sizes or behaviour, never colours.
- Every settings query and control is technician-only **UX**; core-api (M09) enforces it. This milestone adds **no
  server route**, so there is no route `config.access` / no-session test here (they belong to M09's route tasks).
- **Decisions this plan makes** (do not re-open them):
  - **D1 — no contract change.** Everything already exists in `@eduscope/contracts`: `IrDevice`, `IrCommand`
    (`captured: boolean`, never the code), `IrBlaster`, `IrCaptureStatus`, WS `ir_capture` / `invalidate`,
    `IrDeviceCreate`, `IrCommandCreate`, `IrTestResultRequest`, `Schedule`, `ClassBlockInput`, `TimedActionInput`,
    `DevicePatch`, `PermitJoinRequest`, `RoomPinRequest`, `TechnicianPinRequest`, `NetworkInfo`, `AboutInfo`.
  - **D2 — `ApiClient` groups** `ir` (listDevices, createDevice, createCommand, learn, cancelLearn, test, recordTest),
    `schedule` (get, createBlock, deleteBlock, createAction, updateAction, deleteAction), `devices` (list, update, remove,
    permitJoin), `settings` (setRoomPin, setTechnicianPin), `system` (network, about, restart). Only what M06 calls;
    ARCHITECTURE §4.4's `ir.updateDevice` / `deleteCommand` have no UI and wait for M09.
  - **D3 — mock IR devices are registry devices** with an `ir_*` transport (so S3d renames/transport changes show in
    S3), listed by name (screenshot order: Air conditioning, Projector). Seeded commands are captured, `test:
    "reacted"`, `tested_at: null` → "Tuya code · captured" and green counts as in screenshot 03. AC = Power off +
    18°…30° cool/auto = 14 (Q23); projector = Power on/off.
  - **D4 — mock capture:** `listening` (deadline +20 s), `captured` after 3 s; the panel's "Next capture: nothing
    received" makes the next capture end in `timeout` after the same 3 s (fast walk-through). Cancel → `cancelled`.
  - **D5 — capture state is server state** in `irCaptureStore`, fed by `ir_capture` in `applyEvent`; a snapshot clears
    it (H4); a new `listening` replaces every other entry (one blaster, one capture).
  - **D6 — row presentation:** status cell = the stored code's status; listening replaces it with the verbatim H21 text
    + `m:ss` and the buttons with **Cancel**; outcomes add a second line ("Captured · now test it" green + Test
    highlighted; "Nothing received" red + **Try again**; `[INFERRED]` "Capture failed" for `failed`); the test question
    replaces the buttons with **Yes** / **No**. While any row listens, every IR button is disabled.
  - **D7 — status copy:** S3.E14 variants; "Tuya code · captured" = reacted with no `tested_at`; tested times read "just
    now" under a minute (AC3), then `formatAgo`.
  - **D8 — device count** = captured commands (Q22); amber when any command is not captured, untested or "no reaction"
    (H20); green otherwise; grey `0` with no commands.
  - **D9 — selection:** `/settings/remote` without an id selects the projector (else the first device) at `lg`
    (screenshot 03); an unknown id redirects to `/settings/remote`.
  - **D10 — writes:** `useServerMutation` stays pending until the server answered **and** the affected queries
    refetched; it never writes the cache. Permit joining and restart use a plain `useMutation` (their result arrives as
    a state push / reconnect).
  - **D11 — sheets** open from the bottom below `lg` and from the right at `lg`; no close icon (it is <48px), every sheet
    and dialog has a 48px Cancel. The shadcn dialog is adapted the same way.
  - **D12 — S3 header:** "← Controls" (icon-only below 600), "Settings", "Technician access" (two lines below 600) +
    Lock, `R-101`; the M03 `TechnicianAccess` moves from the page into the header.
  - **D13 — phone master → detail below `lg`** (ARCHITECTURE §4.1), back link "← All devices".
  - **D14 — device subtitle** stays "{brand} · via {ZS06|MCU}" (S3.E7). AC5's "Screen relay · Other · via MCU" is read
    as name · kind · transport; the walk-through enters brand "Generic".
  - **D15 — AC commands** are named "25°" (cool + auto) or "22° · heat · low"; setpoint 16–30 °C `[ASSUMED]`, modes
    cool/heat/dry/fan/auto, fans auto/low/medium/high; a duplicate setpoint is allowed (AC5 adds 25° although 25° exists).
  - **D16 — "+ Add a command"** creates the command, then starts its capture; a refused capture leaves "Not captured"
    with **Learn**. Disabled while a ZS06 device's blaster is offline (H25).
  - **D17 — schedule:** days read "every day" / "weekdays" / "weekends" / "Mon–Thu" / "Mon, Wed"; timed-action presets
    `[INFERRED]` All off · Lights off · Projector off · AC off; class blocks are deletable too.
  - **D18 — S3d:** only IR devices change transport (ZS06 ↔ MCU); others show it read-only. Remove asks to confirm.
    Layout: registry left (~2/3 at lg), Zigbee + PINs right.
  - **D19 — PIN change:** new PIN, then again; a mismatch starts over; PINs are never shown (rows say "4 digits" /
    "6 digits"); success toasts "Room PIN changed" / "Technician PIN changed".
  - **D20 — QR:** `qrcode`'s matrix drawn as one SVG path with token colours (`fill-bg` on `bg-text-1`), level M,
    4-module quiet zone; the URL comes from `AboutInfo.url`.
  - **D21 — restart (mock):** answers, then drops every socket, forgets the AC (R3) and accepts connections again after
    5 s; the existing connection manager shows "Reconnecting…" → "Back online".
  - **D22 — favicon:** `<link rel="icon" href="data:,">` removes the only console error (AC10, M03-L3).
  - **D23 — S3b `[INFERRED]` copy:** Controller "Online" / "Hardware service down"; Connection "Not connected".
  - **D24 — mock network clients:** room screen, two phones and this client (its own label).
- After each task: run the task's **Verify**, then `pnpm verify`; when both are green tick the task's checkbox in
  this file and commit **with this plan file included**: `git add -A && git commit -m "<message from the task>"`.

## File map

| File | Create/Modify | Responsibility |
|---|---|---|
| `apps/kiosk/src/data/adapters/mock/mock-host.ts` | Create | port the FakeRoom gives its settings stores |
| `apps/kiosk/src/data/adapters/mock/fake-ir.ts` (+ `.test.ts`) | Create | mock IR devices/commands, learn/cancel/test/test-result (D3, D4) |
| `apps/kiosk/src/data/adapters/mock/fake-schedule.ts` (+ `.test.ts`) | Create | mock class blocks and timed actions |
| `apps/kiosk/src/data/adapters/mock/fake-room.ts` | Modify | owns `ir` / `schedule`; registry edits, permit join, PINs, network, about, restart |
| `apps/kiosk/src/data/adapters/mock/fake-room-settings.test.ts` | Create | FakeRoom settings tests |
| `apps/kiosk/src/data/api-client.ts` | Modify | `IrApi`, `ScheduleApi`, `DevicesApi`, `SettingsApi`, `SystemApi` (D2) |
| `apps/kiosk/src/data/adapters/mock/mock-client.ts` | Modify | forwards the groups to FakeRoom |
| `apps/kiosk/src/data/adapters/http/http-client.ts` (+ `.test.ts`) | Modify | the groups over fetch, zod both ways |
| `apps/kiosk/src/data/test/api-stub.ts` | Create | `stubApi()` for tests |
| `apps/kiosk/src/data/realtime/cache-port.test.ts` | Modify | uses `stubApi()` |
| `apps/kiosk/src/data/ir/capture-store.ts` (+ `.test.ts`) | Create | `ir_capture` pushes per command (D5) |
| `apps/kiosk/src/data/realtime/apply-event.ts` (+ `.test.ts`), `runtime.ts` | Modify | route `ir_capture` to the store; snapshot clears it |
| `apps/kiosk/src/data/settings/queries.ts` (+ `.test.ts`), `hooks.ts` | Create | technician-only queries, `useServerMutation` (D10) |
| `apps/kiosk/src/ui/dialog.tsx` | Create (shadcn CLI) | dialog primitive (D11) |
| `apps/kiosk/src/lib/use-media-query.ts` | Create | `lg` media query for the sheet side |
| `apps/kiosk/src/features/settings/shared/*` | Create | `SettingsSheet`, `TextField`, `ChoiceGroup`, `SheetActions`, `ConfirmDialog`, `QueryStatus`, `SettingsRow`, `useWritable`, `FormResult` |
| `apps/kiosk/src/app/Header.tsx`, `features/settings/TechnicianAccess.tsx` | Modify | S3 header variant (D12) |
| `apps/kiosk/src/features/settings/tabs.ts`, `SettingsTabs.tsx`, `SettingsPage.tsx` | Create/Modify | S3.E5 strip and the page frame |
| `apps/kiosk/src/features/settings/remote/remote.view.ts` (+ `.test.ts`) | Create | status, count, subtitles, selection, blaster |
| `apps/kiosk/src/features/settings/remote/command-row.ts` (+ `.test.ts`) | Create | row state machine + view (H21/H22/H25) |
| `apps/kiosk/src/features/settings/remote/forms.ts` (+ `.test.ts`) | Create | add-device / add-command validation |
| `apps/kiosk/src/features/settings/remote/use-command-row.ts` | Create | row ↔ API, capture store, room state |
| `apps/kiosk/src/features/settings/remote/*.tsx` | Create | `CommandRow`, `DeviceList`, `BlasterCard`, `FallbackCard`, `HowCaptureWorks`, `AddDeviceSheet`, `AddCommandSheet`, `DeviceDetail`, `RemoteTab` |
| `apps/kiosk/src/app/dev/MockPanel.tsx` | Modify | "Next capture: nothing received" |
| `apps/kiosk/src/features/settings/network/*` | Create | S3b selectors + tab |
| `apps/kiosk/src/features/settings/schedule/*` | Create | S3c selectors, validation, `DayPicker`, sheets, tab |
| `apps/kiosk/src/features/settings/devices/*` | Create | S3d selectors, PIN reducer, edit sheet, registry, permit join, PINs, tab |
| `apps/kiosk/src/features/settings/about/*` | Create | S3e uptime/QR, `QrCode`, `RestartButton`, tab |
| `apps/kiosk/package.json`, `pnpm-lock.yaml` | Modify | `qrcode`, `@types/qrcode` |
| `apps/kiosk/index.html` | Modify | favicon (D22) |

## Tasks


### T1 — Mock IR store: devices, commands, capture and test (FakeIr)
- [x] done

**Files:** `apps/kiosk/src/data/adapters/mock/mock-host.ts`, `apps/kiosk/src/data/adapters/mock/fake-ir.ts`, `apps/kiosk/src/data/adapters/mock/fake-room.ts`, `apps/kiosk/src/data/adapters/mock/fake-ir.test.ts`

**Context:** Milestone scope "Mock adapter: IR devices/commands store, learn (resolves after 3 s or times out via panel), test,
test-result"; SPEC §6 IrDevice/IrCommand, S3.E7–E16, H20–H22, H25, R4, R5, R8; ARCHITECTURE §6.9 (learn: `ir_capture
listening` with a 20 s deadline → `captured` + `invalidate ["ir","devices"]`; timeout/cancel keep the old code).
Decisions D3, D4. FakeRoom keeps one state and one event stream; the IR store gets them through a small `MockHost`
port instead of growing FakeRoom by another 200 lines. Reuse: `ApiRequestError` (`data/api-client.ts`) for refusals,
`IrCommandCreate` / `IrDeviceCreate` (contracts) to parse inputs like core-api will. Nothing reads `room.ir` yet.

**Do:**
1. Create `apps/kiosk/src/data/adapters/mock/mock-host.ts`:
```ts
import type { RoomState, ServerEvent } from "@eduscope/contracts";

/** What the FakeRoom gives its settings stores (fake-ir, fake-schedule): one state, one event stream. */
export interface MockHost {
  state(): RoomState;
  /** Derive, bump rev and push `state` (FakeRoom.commit). */
  commit(next: RoomState): void;
  emit(event: ServerEvent): void;
  /** One mock round trip (200–600 ms). */
  delay(): Promise<void>;
  now(): number;
}
```
2. Create `apps/kiosk/src/data/adapters/mock/fake-ir.ts`:
```ts
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
```
3. In `apps/kiosk/src/data/adapters/mock/fake-room.ts` replace:
```ts
import type { RealtimeConnection, RealtimeHandlers } from "@/data/api-client";
```
with:
```ts
import type { RealtimeConnection, RealtimeHandlers } from "@/data/api-client";
import { FakeIr } from "./fake-ir";
import type { MockHost } from "./mock-host";
```
4. In `apps/kiosk/src/data/adapters/mock/fake-room.ts` replace:
```ts
  private joinTimer: ReturnType<typeof setTimeout> | null = null;
```
with:
```ts
  private joinTimer: ReturnType<typeof setTimeout> | null = null;
  /** S3 Remote configuration store (it shares this room's state and events). */
  readonly ir: FakeIr;
```
5. In `apps/kiosk/src/data/adapters/mock/fake-room.ts` replace:
```ts
      unlocked_at: null, last_activity: null, expires_at: null,
    });
  }
```
with:
```ts
      unlocked_at: null, last_activity: null, expires_at: null,
    });
    const host: MockHost = {
      state: () => this.state,
      commit: (next) => this.commit(next),
      emit: (event) => this.emitAll(event),
      delay: () => this.delay(),
      now: () => this.now(),
    };
    this.ir = new FakeIr(host);
  }
```
6. Create `apps/kiosk/src/data/adapters/mock/fake-ir.test.ts`:
```ts
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
```

**Test:** `apps/kiosk/src/data/adapters/mock/fake-ir.test.ts`: seeded list (order, brands, counts, `tested_at: null`);
create device (registry + invalidate); new command not captured; learn listening → captured + untested after 3 s;
panel "nothing received" → timeout, old code kept; cancel; captured setpoint joins `available_setpoints`; recordTest
reacted / no_reaction with time; blaster offline → `hw_unavailable` for ZS06; MCU device still learns; test refuses an
uncaptured command.

**Verify:** `pnpm --filter @eduscope/kiosk exec vitest run src/data/adapters/mock/fake-ir.test.ts` → 11 tests pass; then `pnpm verify` → exit 0.

**Commit:** `git add -A && git commit -m "feat(kiosk): mock IR store with capture and test flows"`

---

### T2 — Mock schedule store (FakeSchedule)
- [x] done

**Files:** `apps/kiosk/src/data/adapters/mock/fake-schedule.ts`, `apps/kiosk/src/data/adapters/mock/fake-room.ts`, `apps/kiosk/src/data/adapters/mock/fake-schedule.test.ts`

**Context:** Milestone scope "Mock adapter: … schedule"; SPEC S3c, §6 Schedule; ARCHITECTURE §3.3 `api/schedule.ts` (CRUD on
blocks and actions), §6.8 (the scheduler is core-api's, M09). Seeds: weekday blocks 08:00–10:00 and 10:15–12:15, Mon/Wed
13:00–15:00, and "All off · 18:00 weekdays" (SPEC S3c example). Every change pushes `invalidate [["schedule"]]`.
Reuse `ClassBlockInput` / `TimedActionInput` (contracts) to parse, `MockHost` (T1).

**Do:**
1. Create `apps/kiosk/src/data/adapters/mock/fake-schedule.ts`:
```ts
import { ClassBlockInput, TimedActionInput, type ClassBlock, type Schedule, type TimedAction } from "@eduscope/contracts";
import { ApiRequestError } from "@/data/api-client";
import type { MockHost } from "./mock-host";

// S3c in the mock: class blocks and timed actions, kept for the page session. The mock never
// runs the actions or ends sessions at block end (core-api's scheduler does that, M09).

const WEEKDAYS = ["mon", "tue", "wed", "thu", "fri"] as const;

function seededSchedule(): Schedule {
  return {
    class_blocks: [
      { id: "blk-1", days: [...WEEKDAYS], start: "08:00", end: "10:00" },
      { id: "blk-2", days: [...WEEKDAYS], start: "10:15", end: "12:15" },
      { id: "blk-3", days: ["mon", "wed"], start: "13:00", end: "15:00" },
    ],
    actions: [
      {
        id: "act-1", name: "All off", time: "18:00", days: [...WEEKDAYS], enabled: true,
        steps: [
          { kind: "projector.power", on: false },
          { kind: "ac.power", on: false },
          { kind: "lights.set", gang: "front", on: false },
          { kind: "lights.set", gang: "rear", on: false },
        ],
      },
    ],
  };
}

export class FakeSchedule {
  private schedule: Schedule = seededSchedule();
  private seq = 0;

  constructor(private readonly host: MockHost) {}

  async get(): Promise<Schedule> {
    await this.host.delay();
    return this.schedule;
  }

  async createBlock(input: ClassBlockInput): Promise<ClassBlock> {
    const parsed = ClassBlockInput.parse(input);
    await this.host.delay();
    const block: ClassBlock = { id: `mock-blk-${++this.seq}`, ...parsed };
    this.save({ ...this.schedule, class_blocks: [...this.schedule.class_blocks, block] });
    return block;
  }

  async deleteBlock(id: string): Promise<void> {
    await this.host.delay();
    if (!this.schedule.class_blocks.some((block) => block.id === id)) throw notFound();
    this.save({ ...this.schedule, class_blocks: this.schedule.class_blocks.filter((block) => block.id !== id) });
  }

  async createAction(input: TimedActionInput): Promise<TimedAction> {
    const parsed = TimedActionInput.parse(input);
    await this.host.delay();
    const action: TimedAction = { id: `mock-act-${++this.seq}`, ...parsed };
    this.save({ ...this.schedule, actions: [...this.schedule.actions, action] });
    return action;
  }

  async updateAction(id: string, input: TimedActionInput): Promise<TimedAction> {
    const parsed = TimedActionInput.parse(input);
    await this.host.delay();
    if (!this.schedule.actions.some((action) => action.id === id)) throw notFound();
    const action: TimedAction = { id, ...parsed };
    this.save({ ...this.schedule, actions: this.schedule.actions.map((candidate) => (candidate.id === id ? action : candidate)) });
    return action;
  }

  async deleteAction(id: string): Promise<void> {
    await this.host.delay();
    if (!this.schedule.actions.some((action) => action.id === id)) throw notFound();
    this.save({ ...this.schedule, actions: this.schedule.actions.filter((action) => action.id !== id) });
  }

  private save(next: Schedule): void {
    this.schedule = next;
    this.host.emit({ type: "invalidate", keys: [["schedule"]] });
  }
}

const notFound = (): ApiRequestError => new ApiRequestError("not_found", "Not found", 404);
```
2. In `apps/kiosk/src/data/adapters/mock/fake-room.ts` replace:
```ts
import { FakeIr } from "./fake-ir";
```
with:
```ts
import { FakeIr } from "./fake-ir";
import { FakeSchedule } from "./fake-schedule";
```
3. In `apps/kiosk/src/data/adapters/mock/fake-room.ts` replace:
```ts
  /** S3 Remote configuration store (it shares this room's state and events). */
  readonly ir: FakeIr;
```
with:
```ts
  /** S3 Remote configuration and S3c Schedule stores (they share this room's state and events). */
  readonly ir: FakeIr;
  readonly schedule: FakeSchedule;
```
4. In `apps/kiosk/src/data/adapters/mock/fake-room.ts` replace:
```ts
    this.ir = new FakeIr(host);
```
with:
```ts
    this.ir = new FakeIr(host);
    this.schedule = new FakeSchedule(host);
```
5. Create `apps/kiosk/src/data/adapters/mock/fake-schedule.test.ts`:
```ts
import type { ServerEvent } from "@eduscope/contracts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FakeRoom, MOCK_LATENCY_MAX_MS } from "./fake-room";

function connected() {
  const room = new FakeRoom({ random: () => 1 });
  const events: ServerEvent[] = [];
  room.connect("laptop", { onOpen: vi.fn(), onEvent: (e: ServerEvent) => events.push(e), onClose: vi.fn() });
  vi.advanceTimersByTime(MOCK_LATENCY_MAX_MS);
  const settle = async <T>(promise: Promise<T>): Promise<T> => {
    await vi.advanceTimersByTimeAsync(MOCK_LATENCY_MAX_MS);
    return promise;
  };
  return { room, events, settle };
}

describe("FakeSchedule (S3c)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("seeded blocks and one action; add, toggle and delete persist", async () => {
    const { room, events, settle } = connected();
    const seeded = await settle(room.schedule.get());
    expect(seeded.class_blocks).toHaveLength(3);
    expect(seeded.actions.map((a) => [a.name, a.time, a.enabled])).toEqual([["All off", "18:00", true]]);

    const block = await settle(room.schedule.createBlock({ days: ["fri"], start: "15:30", end: "17:00" }));
    const action = seeded.actions[0];
    if (action === undefined) throw new Error("no action");
    const { id, ...input } = action;
    await settle(room.schedule.updateAction(id, { ...input, enabled: false }));
    await settle(room.schedule.deleteBlock("blk-1"));

    const after = await settle(room.schedule.get());
    expect(after.class_blocks.map((b) => b.id)).toEqual(["blk-2", "blk-3", block.id]);
    expect(after.actions[0]?.enabled).toBe(false);
    expect(events).toContainEqual({ type: "invalidate", keys: [["schedule"]] });
  });

  it("an end before the start is refused", async () => {
    const { room } = connected();
    await expect(room.schedule.createBlock({ days: ["mon"], start: "10:00", end: "09:00" })).rejects.toThrow();
  });
});
```

**Test:** `apps/kiosk/src/data/adapters/mock/fake-schedule.test.ts`: seeded data; add block, disable action, delete block, invalidate pushed; an end before the start is refused.

**Verify:** `pnpm --filter @eduscope/kiosk exec vitest run src/data/adapters/mock/fake-schedule.test.ts` → 2 tests pass; then `pnpm verify` → exit 0.

**Commit:** `git add -A && git commit -m "feat(kiosk): mock schedule store"`

---

### T3 — Mock registry edits and permit joining
- [x] done

**Files:** `apps/kiosk/src/data/adapters/mock/fake-room.ts`, `apps/kiosk/src/data/adapters/mock/fake-room-settings.test.ts`

**Context:** Milestone scope "Mock adapter: … devices"; SPEC S3d (rename, change transport, remove; "Permit joining" opens the
mesh for 4 min and S2.E21 shows the countdown), R8; ARCHITECTURE §3.3 `api/devices.ts` (`PermitJoinRequest` is always
240 s). The registry IS `RoomState.devices`, so S1/S2 follow a rename through the next `state` push; S3 follows through
`invalidate [["devices"],["ir","devices"]]` (D3: IR devices are registry devices). `openJoining()` (panel, 4:12) and
`permitJoin()` share one private `openJoiningFor(ms)`. Removing a device also forgets its IR commands
(`FakeIr.forgetDevice`, T1).

**Do:**
1. In `apps/kiosk/src/data/adapters/mock/fake-room.ts` replace:
```ts
import {
  ClientSession, Command, CommandRequest, LoginRequest, RoomState, ServerEvent, type ChangedBy, type ClientLabel,
  type ClientType, type CommandBody, type Device, type LoginResult,
} from "@eduscope/contracts";
```
with:
```ts
import {
  ClientSession, Command, CommandRequest, DevicePatch, LoginRequest, RoomState, ServerEvent, type ChangedBy,
  type ClientLabel, type ClientType, type CommandBody, type Device, type LoginResult,
} from "@eduscope/contracts";
```
2. In `apps/kiosk/src/data/adapters/mock/fake-room.ts` replace:
```ts
import type { RealtimeConnection, RealtimeHandlers } from "@/data/api-client";
```
with:
```ts
import { ApiRequestError, type RealtimeConnection, type RealtimeHandlers } from "@/data/api-client";
```
3. In `apps/kiosk/src/data/adapters/mock/fake-room.ts` replace:
```ts
export const MOCK_HOLDING_WATTS = 112;
```
with:
```ts
export const MOCK_HOLDING_WATTS = 112;
/** S3d "Permit joining": the mesh opens for 4 min (PermitJoinRequest). Not time-scaled. */
export const MOCK_PERMIT_JOIN_MS = 240_000;
```
4. In `apps/kiosk/src/data/adapters/mock/fake-room.ts` replace:
```ts
  // ── Mock panel (`?mock-panel`) ───────────────────────────────────────────────────────
```
with:
```ts
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
  }

  // ── Mock panel (`?mock-panel`) ───────────────────────────────────────────────────────
```
5. In `apps/kiosk/src/data/adapters/mock/fake-room.ts` replace:
```ts
  openJoining(): void {
    if (this.joinTimer !== null) clearTimeout(this.joinTimer);
    const until = new Date(this.now() + MOCK_JOIN_WINDOW_MS).toISOString();
    this.setJoining({ state: "open", until });
    this.joinTimer = setTimeout(() => {
      this.joinTimer = null;
      this.setJoining({ state: "closed" });
    }, MOCK_JOIN_WINDOW_MS);
  }
```
with:
```ts
  openJoining(): void {
    this.openJoiningFor(MOCK_JOIN_WINDOW_MS);
  }
```
6. In `apps/kiosk/src/data/adapters/mock/fake-room.ts` replace:
```ts
  private setJoining(joining: RoomState["zigbee"]["mesh"]["joining"]): void {
```
with:
```ts
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
```
7. Create `apps/kiosk/src/data/adapters/mock/fake-room-settings.test.ts`:
```ts
import type { RoomState, ServerEvent } from "@eduscope/contracts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FakeRoom, MOCK_LATENCY_MAX_MS, MOCK_PERMIT_JOIN_MS } from "./fake-room";

function connected() {
  const room = new FakeRoom({ random: () => 1 });
  const events: ServerEvent[] = [];
  const onClose = vi.fn();
  room.connect("laptop", { onOpen: vi.fn(), onEvent: (e: ServerEvent) => events.push(e), onClose });
  vi.advanceTimersByTime(MOCK_LATENCY_MAX_MS);
  const last = (): RoomState => {
    const found = events.findLast((e) => e.type === "state" || e.type === "snapshot");
    if (found === undefined || (found.type !== "state" && found.type !== "snapshot")) throw new Error("no state");
    return found.state;
  };
  const settle = async <T>(promise: Promise<T>): Promise<T> => {
    await vi.advanceTimersByTimeAsync(MOCK_LATENCY_MAX_MS);
    return promise;
  };
  return { room, events, last, settle, onClose };
}

describe("FakeRoom registry (S3d)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-13T09:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("devices: rename and transport change reach the registry, the IR list and the state (S3d, R8)", async () => {
    const { room, last, events, settle } = connected();
    await settle(room.updateDevice("projector", { name: "Main projector", transport: "ir_mcu" }));
    expect(last().devices.find((d) => d.id === "projector")).toMatchObject({ name: "Main projector", transport: "ir_mcu" });
    expect((await settle(room.listDevices())).find((d) => d.id === "projector")?.name).toBe("Main projector");
    expect((await settle(room.ir.listDevices()))[1]).toMatchObject({ name: "Main projector", transport: "ir_mcu" });
    expect(events).toContainEqual({ type: "invalidate", keys: [["devices"], ["ir", "devices"]] });
  });

  it("devices: remove drops the device and its IR commands", async () => {
    const { room, last, settle } = connected();
    await settle(room.removeDevice("ac"));
    expect(last().devices.some((d) => d.id === "ac")).toBe(false);
    expect((await settle(room.ir.listDevices())).map((d) => d.device_id)).toEqual(["projector"]);
  });

  it("permit joining opens the mesh for 4 min, then closes it (S3d → S2.E21)", async () => {
    const { room, last, settle } = connected();
    await settle(room.permitJoin());
    expect(last().zigbee.mesh.joining).toEqual({ state: "open", until: new Date(Date.now() + MOCK_PERMIT_JOIN_MS).toISOString() });
    await vi.advanceTimersByTimeAsync(MOCK_PERMIT_JOIN_MS);
    expect(last().zigbee.mesh.joining).toEqual({ state: "closed" });
  });
});
```

**Test:** `apps/kiosk/src/data/adapters/mock/fake-room-settings.test.ts`: rename + transport reach the state, the registry and the IR list; remove drops the device and its commands; permit joining opens 4 min then closes.

**Verify:** `pnpm --filter @eduscope/kiosk exec vitest run src/data/adapters/mock/fake-room-settings.test.ts src/data/adapters/mock/fake-room-devices.test.ts` → 3 + 10 tests pass (the S2 "Open joining" test still passes after the refactor); then `pnpm verify` → exit 0.

**Commit:** `git add -A && git commit -m "feat(kiosk): mock device registry edits and permit joining"`

---

### T4 — Mock PIN change, network, about and restart
- [x] done

**Files:** `apps/kiosk/src/data/adapters/mock/fake-room.ts`, `apps/kiosk/src/data/adapters/mock/fake-room-settings.test.ts`

**Context:** Milestone scope "Mock adapter: … PIN change, network/about data, restart (simulates a disconnect + resync)"; SPEC
§2.3 (room PIN 4 digits, technician PIN 6), S3b, S3e, §2.5/H3/H4, R3; ARCHITECTURE §3.3 (`NetworkInfo`, `AboutInfo`,
`RoomPinRequest`, `TechnicianPinRequest`). Decisions D21, D24. The mock PINs become fields so a changed PIN is the one
`login` accepts. `about().url` is built from `room.hostname` (milestone note: the URL comes from `AboutInfo.url`).
`restart()` resolves first, then reuses the panel's `dropConnection()` / `restartController()` / `restore()`: the
client's connection manager shows "Reconnecting…" and, after the 5 s restart, reconnects (backoff 0.5/1/2/4 s) to a
snapshot → "Back online" — no client code needed.

**Do:**
1. In `apps/kiosk/src/data/adapters/mock/fake-room.ts` replace:
```ts
import {
  ClientSession, Command, CommandRequest, DevicePatch, LoginRequest, RoomState, ServerEvent, type ChangedBy,
  type ClientLabel, type ClientType, type CommandBody, type Device, type LoginResult,
} from "@eduscope/contracts";
```
with:
```ts
import {
  ClientSession, Command, CommandRequest, DevicePatch, LoginRequest, RoomPinRequest, RoomState, ServerEvent,
  TechnicianPinRequest, type AboutInfo, type ChangedBy, type ClientLabel, type ClientType, type CommandBody,
  type Device, type LoginResult, type NetworkInfo,
} from "@eduscope/contracts";
```
2. In `apps/kiosk/src/data/adapters/mock/fake-room.ts` replace:
```ts
export const MOCK_PERMIT_JOIN_MS = 240_000;
```
with:
```ts
export const MOCK_PERMIT_JOIN_MS = 240_000;
/** S3e "Restart controller": sockets drop, then the controller accepts connections again. */
export const MOCK_RESTART_MS = 5_000;
/** S3e About: the mock controller has been up 3 d 4 h when the page loads. */
export const MOCK_UPTIME_AT_START_S = (3 * 24 + 4) * 3600;
export const MOCK_VERSION = "0.6.0";
export const MOCK_PI_MODEL = "Raspberry Pi 5 Model B Rev 1.0";
export const MOCK_ADDRESS = "192.168.10.41";
```
3. In `apps/kiosk/src/data/adapters/mock/fake-room.ts` replace:
```ts
  private joinTimer: ReturnType<typeof setTimeout> | null = null;
```
with:
```ts
  private joinTimer: ReturnType<typeof setTimeout> | null = null;
  private roomPin = MOCK_ROOM_PIN;
  private technicianPin = MOCK_TECHNICIAN_PIN;
  /** Epoch ms of the (mock) controller start; uptime counts from here. */
  private bootedAt: number;
  private uptimeAtBootS = MOCK_UPTIME_AT_START_S;
```
4. In `apps/kiosk/src/data/adapters/mock/fake-room.ts` replace:
```ts
    const host: MockHost = {
```
with:
```ts
    this.bootedAt = this.now();
    const host: MockHost = {
```
5. In `apps/kiosk/src/data/adapters/mock/fake-room.ts` replace:
```ts
    const expected = level === "control" ? MOCK_ROOM_PIN : MOCK_TECHNICIAN_PIN;
```
with:
```ts
    const expected = level === "control" ? this.roomPin : this.technicianPin;
```
6. In `apps/kiosk/src/data/adapters/mock/fake-room.ts` replace:
```ts
    this.openJoiningFor(MOCK_PERMIT_JOIN_MS);
  }
```
with:
```ts
    this.openJoiningFor(MOCK_PERMIT_JOIN_MS);
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
```
7. In `apps/kiosk/src/data/adapters/mock/fake-room-settings.test.ts` replace:
```ts
import { FakeRoom, MOCK_LATENCY_MAX_MS, MOCK_PERMIT_JOIN_MS } from "./fake-room";
```
with:
```ts
import {
  FakeRoom, MOCK_ADDRESS, MOCK_LATENCY_MAX_MS, MOCK_PERMIT_JOIN_MS, MOCK_RESTART_MS, MOCK_UPTIME_AT_START_S,
} from "./fake-room";
```
8. Append to `apps/kiosk/src/data/adapters/mock/fake-room-settings.test.ts`:
```ts
describe("FakeRoom PINs and system (S3d, S3b, S3e)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-13T09:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("PIN change: the new room and technician PINs are the ones login accepts", async () => {
    const { room, settle } = connected();
    await settle(room.setRoomPin("4321"));
    await settle(room.setTechnicianPin("654321"));
    expect(await settle(room.login({ level: "control", pin: "1234", label: "laptop" }))).toMatchObject({ reason: "wrong" });
    expect(await settle(room.login({ level: "control", pin: "4321", label: "laptop" }))).toMatchObject({ access: "control" });
    expect(await settle(room.login({ level: "technician", pin: "654321", label: "laptop" }))).toMatchObject({ access: "technician" });
  });

  it("PIN change refuses the wrong number of digits", async () => {
    const { room } = connected();
    await expect(room.setRoomPin("12345")).rejects.toThrow();
    await expect(room.setTechnicianPin("1234")).rejects.toThrow();
  });

  it("network lists this client among the connected clients (S3b)", async () => {
    const { room, settle } = connected();
    const network = await settle(room.network());
    expect(network).toMatchObject({ hostname: "r-101.local", address: MOCK_ADDRESS, connection: { kind: "ethernet" }, controller: { hw: "up" } });
    expect(network.clients.map((c) => c.label)).toEqual(["room screen", "phone", "phone", "laptop"]);
  });

  it("about: URL from the hostname, uptime counts (S3e)", async () => {
    const { room, settle } = connected();
    const about = await settle(room.about());
    expect(about).toMatchObject({ room: "R-101", url: "http://r-101.local" });
    expect(about.uptime_s).toBe(MOCK_UPTIME_AT_START_S + 1); // connect + one round trip = 1.2 s
  });

  it("restart answers, drops every socket, forgets the AC and accepts connections again (S3e, H3/H4, R3)", async () => {
    const { room, onClose, settle } = connected();
    await settle(room.restart());
    await vi.advanceTimersByTimeAsync(1);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(room.peek().environment.ac.power.confidence).toBe("unknown");

    const reconnect: ServerEvent[] = [];
    const refused = vi.fn();
    room.connect("laptop", { onOpen: vi.fn(), onEvent: (e: ServerEvent) => reconnect.push(e), onClose: refused });
    await vi.advanceTimersByTimeAsync(MOCK_LATENCY_MAX_MS);
    expect(refused).toHaveBeenCalledTimes(1); // still restarting

    await vi.advanceTimersByTimeAsync(MOCK_RESTART_MS);
    room.connect("laptop", { onOpen: vi.fn(), onEvent: (e: ServerEvent) => reconnect.push(e), onClose: vi.fn() });
    await vi.advanceTimersByTimeAsync(MOCK_LATENCY_MAX_MS);
    expect(reconnect.at(-1)?.type).toBe("snapshot");
    expect((await settle(room.about())).uptime_s).toBeLessThan(5);
  });
});
```

**Test:** Appended to `fake-room-settings.test.ts`: new PINs are the ones login accepts; wrong lengths refused; network lists this client; about URL + uptime; restart answers, drops sockets, forgets the AC, refuses reconnects for 5 s, then snapshots and uptime restarts.

**Verify:** `pnpm --filter @eduscope/kiosk exec vitest run src/data/adapters/mock/` → all mock tests pass (fake-room-settings: 8); then `pnpm verify` → exit 0.

**Commit:** `git add -A && git commit -m "feat(kiosk): mock PIN change, network, about and restart"`

---

### T5 — ApiClient settings surface (ir, schedule, devices, settings, system) in both adapters
- [x] done

**Files:** `apps/kiosk/src/data/api-client.ts`, `apps/kiosk/src/data/adapters/mock/mock-client.ts`, `apps/kiosk/src/data/adapters/http/http-client.ts`, `apps/kiosk/src/data/adapters/http/http-client.test.ts`, `apps/kiosk/src/data/test/api-stub.ts`, `apps/kiosk/src/data/realtime/cache-port.test.ts`

**Context:** ARCHITECTURE §4.4 (`ApiClient` groups `ir`, `schedule`, `devices`, `settings`, `system`), §3.3 (routes and their
contract schemas), CLAUDE.md "zod at every boundary" and "Code must work with both `VITE_API_MODE=mock` and `http`".
Decision D2: only the methods M06's screens call are added (no `updateDevice` / `deleteCommand` for IR: no UI uses
them; S3d edits go through `devices.update`). The http adapter parses every request body with its contract schema
before fetching (an invalid body rejects with `ApiRequestError("validation")`, never a `ZodError` — the M02-L6 problem
is not repeated) and every response with its response schema; 202/204 answers use `requestVoid`. The mock client
forwards to the T1–T4 FakeRoom methods. `stubApi()` replaces the hand-written ApiClient literal in
`cache-port.test.ts` (it would otherwise need every new group).

**Do:**
1. Replace the whole file `apps/kiosk/src/data/api-client.ts`:
```ts
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
```
2. Replace the whole file `apps/kiosk/src/data/adapters/mock/mock-client.ts`:
```ts
import type { ApiClient } from "@/data/api-client";
import { FakeRoom } from "./fake-room";
import { readTimeScale } from "./time-scale";

/** The one FakeRoom of this page; the mock panel drives it directly. */
export const fakeRoom = new FakeRoom({ timeScale: readTimeScale(window.location.search, import.meta.env.DEV) });

export function createMockApiClient(room: FakeRoom = fakeRoom): ApiClient {
  return {
    getSession: () => room.getSession(),
    login: (request) => room.login(request),
    lock: () => room.lock(),
    getState: () => room.getState(),
    sendCommand: (request) => room.sendCommand(request),
    connect: (label, handlers) => room.connect(label, handlers),
    ir: {
      listDevices: () => room.ir.listDevices(),
      createDevice: (input) => room.ir.createDevice(input),
      createCommand: (deviceId, input) => room.ir.createCommand(deviceId, input),
      learn: (commandId) => room.ir.learn(commandId),
      cancelLearn: (commandId) => room.ir.cancelLearn(commandId),
      test: (commandId) => room.ir.test(commandId),
      recordTest: (commandId, reacted) => room.ir.recordTest(commandId, reacted),
    },
    schedule: {
      get: () => room.schedule.get(),
      createBlock: (input) => room.schedule.createBlock(input),
      deleteBlock: (id) => room.schedule.deleteBlock(id),
      createAction: (input) => room.schedule.createAction(input),
      updateAction: (id, input) => room.schedule.updateAction(id, input),
      deleteAction: (id) => room.schedule.deleteAction(id),
    },
    devices: {
      list: () => room.listDevices(),
      update: (id, patch) => room.updateDevice(id, patch),
      remove: (id) => room.removeDevice(id),
      permitJoin: () => room.permitJoin(),
    },
    settings: {
      setRoomPin: (pin) => room.setRoomPin(pin),
      setTechnicianPin: (pin) => room.setTechnicianPin(pin),
    },
    system: {
      network: () => room.network(),
      about: () => room.about(),
      restart: () => room.restart(),
    },
  };
}
```
3. In `apps/kiosk/src/data/adapters/http/http-client.ts` replace:
```ts
import {
  ApiError, ClientMessage, CommandRequest, GetSessionResponse, GetStateResponse, LockResponse,
  LoginRequest, PinError, PostCommandResponse, ServerEvent,
} from "@eduscope/contracts";
```
with:
```ts
import {
  ApiError, ClassBlock, ClassBlockInput, ClientMessage, CommandRequest, Device, DeviceList, DevicePatch,
  GetAboutResponse, GetNetworkResponse, GetScheduleResponse, GetSessionResponse, GetStateResponse, IrCommand,
  IrCommandCreate, IrDevice, IrDeviceCreate, IrDeviceList, IrTestResultRequest, LockResponse, LoginRequest,
  PermitJoinRequest, PinError, PostCommandResponse, RoomPinRequest, ServerEvent, TechnicianPinRequest, TimedAction,
  TimedActionInput,
} from "@eduscope/contracts";
```
4. In `apps/kiosk/src/data/adapters/http/http-client.ts` replace:
```ts
export function createHttpApiClient(options: HttpClientOptions): ApiClient {
```
with:
```ts
const sendJson = (method: "POST" | "PUT" | "PATCH", body: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

/** Request bodies are checked against the contract before anything is sent (CLAUDE.md: zod at every boundary). */
function checked<S extends z.ZodType>(schema: S, value: unknown): z.infer<S> {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new ApiRequestError("validation", parsed.error.issues[0]?.message ?? "Invalid request", null);
  return parsed.data;
}

export function createHttpApiClient(options: HttpClientOptions): ApiClient {
```
5. In `apps/kiosk/src/data/adapters/http/http-client.ts` replace:
```ts
  const postJson = (body: unknown): RequestInit => ({
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
```
with:
```ts
  const postJson = (body: unknown): RequestInit => sendJson("POST", body);

  /** A 2xx with no body we need (202 / 204). */
  async function requestVoid(path: string, init: RequestInit): Promise<void> {
    const { response, body } = await fetchJson(path, init);
    if (!response.ok) fail(response, body);
  }

  const id = (value: string): string => encodeURIComponent(value);
```
6. In `apps/kiosk/src/data/adapters/http/http-client.ts` replace:
```ts
    connect(label, handlers): RealtimeConnection {
```
with:
```ts
    ir: {
      listDevices: () => request(IrDeviceList, "/api/ir/devices"),
      createDevice: async (input) => request(IrDevice, "/api/ir/devices", postJson(checked(IrDeviceCreate, input))),
      createCommand: async (deviceId, input) =>
        request(IrCommand, `/api/ir/devices/${id(deviceId)}/commands`, postJson(checked(IrCommandCreate, input))),
      learn: (commandId) => requestVoid(`/api/ir/commands/${id(commandId)}/learn`, postJson({})),
      cancelLearn: (commandId) => requestVoid(`/api/ir/commands/${id(commandId)}/learn/cancel`, postJson({})),
      test: (commandId) => requestVoid(`/api/ir/commands/${id(commandId)}/test`, postJson({})),
      recordTest: async (commandId, reacted) =>
        request(IrCommand, `/api/ir/commands/${id(commandId)}/test-result`, postJson(checked(IrTestResultRequest, { reacted }))),
    },
    schedule: {
      get: () => request(GetScheduleResponse, "/api/schedule"),
      createBlock: async (input) => request(ClassBlock, "/api/schedule/blocks", postJson(checked(ClassBlockInput, input))),
      deleteBlock: (blockId) => requestVoid(`/api/schedule/blocks/${id(blockId)}`, { method: "DELETE" }),
      createAction: async (input) => request(TimedAction, "/api/schedule/actions", postJson(checked(TimedActionInput, input))),
      updateAction: async (actionId, input) =>
        request(TimedAction, `/api/schedule/actions/${id(actionId)}`, sendJson("PUT", checked(TimedActionInput, input))),
      deleteAction: (actionId) => requestVoid(`/api/schedule/actions/${id(actionId)}`, { method: "DELETE" }),
    },
    devices: {
      list: () => request(DeviceList, "/api/devices"),
      update: async (deviceId, patch) => request(Device, `/api/devices/${id(deviceId)}`, sendJson("PATCH", checked(DevicePatch, patch))),
      remove: (deviceId) => requestVoid(`/api/devices/${id(deviceId)}`, { method: "DELETE" }),
      permitJoin: async () => requestVoid("/api/zigbee/permit-join", postJson(checked(PermitJoinRequest, { seconds: 240 }))),
    },
    settings: {
      setRoomPin: async (pin) => requestVoid("/api/settings/pins/room", sendJson("PUT", checked(RoomPinRequest, { pin }))),
      setTechnicianPin: async (pin) =>
        requestVoid("/api/settings/pins/technician", sendJson("PUT", checked(TechnicianPinRequest, { pin }))),
    },
    system: {
      network: () => request(GetNetworkResponse, "/api/system/network"),
      about: () => request(GetAboutResponse, "/api/system/about"),
      restart: () => requestVoid("/api/system/restart", postJson({})),
    },
    connect(label, handlers): RealtimeConnection {
```
7. In `apps/kiosk/src/data/adapters/http/http-client.test.ts` replace:
```ts
import type { Command, ServerEvent } from "@eduscope/contracts";
```
with:
```ts
import { TimedActionInput, type Command, type ServerEvent } from "@eduscope/contracts";
```
8. Append to `apps/kiosk/src/data/adapters/http/http-client.test.ts`:
```ts
describe("http adapter: settings routes (S3–S3e)", () => {
  /** A fetch that answers by path and method. */
  const fetchBy = (route: (path: string, init: RequestInit | undefined) => Response) =>
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => route(String(input), init));
  const empty = (status: number): Response => new Response(null, { status });
  const irCommand = {
    id: "c1", device_id: "projector", name: "Power on", role: "power_on", setpoint: null, code_format: "tuya",
    captured: true, captured_at: "2026-10-05T10:42:00Z", test: "reacted", tested_at: "2026-10-05T10:43:00Z",
  };
  const irDevice = { device_id: "projector", name: "Projector", brand: "Epson", kind: "projector", transport: "ir_zs06", commands: [irCommand] };

  it("ir: lists devices and posts the test result", async () => {
    const fetchMock = fetchBy((path) => json(200, path === "/api/ir/devices" ? [irDevice] : irCommand));
    const api = client(fetchMock);
    expect(await api.ir.listDevices()).toEqual([irDevice]);
    expect(await api.ir.recordTest("c1", true)).toEqual(irCommand);
    expect(fetchMock).toHaveBeenLastCalledWith("/api/ir/commands/c1/test-result", {
      credentials: "same-origin", method: "POST", headers: { "Content-Type": "application/json" }, body: '{"reacted":true}',
    });
  });

  it("ir: learn, cancel and test are 202s without a body", async () => {
    const fetchMock = fetchBy(() => empty(202));
    const api = client(fetchMock);
    await api.ir.learn("c 1");
    await api.ir.cancelLearn("c1");
    await api.ir.test("c1");
    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
      "/api/ir/commands/c%201/learn", "/api/ir/commands/c1/learn/cancel", "/api/ir/commands/c1/test",
    ]);
  });

  it("ir: a failed learn maps the ApiError (H25)", async () => {
    const fetchMock = fetchBy(() => json(503, { code: "hw_unavailable", message: "IR blaster offline" }));
    await expect(client(fetchMock).ir.learn("c1")).rejects.toMatchObject({ code: "hw_unavailable", status: 503 });
  });

  it("ir: an invalid create is refused before fetching", async () => {
    const fetchMock = fetchBy(() => json(200, irDevice));
    await expect(
      client(fetchMock).ir.createDevice({ name: " ", brand: "Epson", kind: "projector", transport: "ir_zs06" }),
    ).rejects.toMatchObject({ code: "validation" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("schedule: PUT an action, DELETE a block", async () => {
    const action = { id: "a1", name: "All off", time: "18:00", days: ["mon"], enabled: false, steps: [{ kind: "ac.power", on: false }] };
    const fetchMock = fetchBy((_path, init) => (init?.method === "DELETE" ? empty(204) : json(200, action)));
    const api = client(fetchMock);
    const { id, ...input } = action;
    expect(await api.schedule.updateAction(id, TimedActionInput.parse(input))).toEqual(action);
    await api.schedule.deleteBlock("b1");
    expect(fetchMock.mock.calls.map((call) => [call[0], call[1]?.method])).toEqual([
      ["/api/schedule/actions/a1", "PUT"], ["/api/schedule/blocks/b1", "DELETE"],
    ]);
  });

  it("devices: PATCH a rename; permit join posts 240 s", async () => {
    const device = roomState().devices[0];
    const fetchMock = fetchBy((path) => (path.startsWith("/api/zigbee") ? empty(202) : json(200, device)));
    const api = client(fetchMock);
    expect(await api.devices.update("projector", { name: "Projector" })).toEqual(device);
    await api.devices.permitJoin();
    expect(fetchMock.mock.calls.map((call) => [call[0], call[1]?.method, call[1]?.body])).toEqual([
      ["/api/devices/projector", "PATCH", '{"name":"Projector"}'], ["/api/zigbee/permit-join", "POST", '{"seconds":240}'],
    ]);
  });

  it("settings: PUT the room PIN; a 5-digit room PIN never leaves the client", async () => {
    const fetchMock = fetchBy(() => empty(204));
    const api = client(fetchMock);
    await api.settings.setRoomPin("4321");
    await expect(api.settings.setRoomPin("12345")).rejects.toMatchObject({ code: "validation" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/settings/pins/room", {
      credentials: "same-origin", method: "PUT", headers: { "Content-Type": "application/json" }, body: '{"pin":"4321"}',
    });
  });

  it("system: about is parsed; a restart is a POST", async () => {
    const about = { room: "R-101", version: "0.6.0", uptime_s: 12, pi_model: null, url: "http://r-101.local" };
    const fetchMock = fetchBy((path) => (path === "/api/system/about" ? json(200, about) : empty(202)));
    const api = client(fetchMock);
    expect(await api.system.about()).toEqual(about);
    await api.system.restart();
    expect(fetchMock).toHaveBeenLastCalledWith("/api/system/restart", expect.objectContaining({ method: "POST" }));
  });
});
```
9. Create `apps/kiosk/src/data/test/api-stub.ts`:
```ts
import { vi } from "vitest";
import type { ApiClient } from "@/data/api-client";

/** An ApiClient whose every method is a `vi.fn()` (tests only). */
export function stubApi(): ApiClient {
  return {
    getSession: vi.fn(),
    login: vi.fn(),
    lock: vi.fn(),
    getState: vi.fn(),
    sendCommand: vi.fn(),
    connect: vi.fn(),
    ir: {
      listDevices: vi.fn(), createDevice: vi.fn(), createCommand: vi.fn(), learn: vi.fn(), cancelLearn: vi.fn(),
      test: vi.fn(), recordTest: vi.fn(),
    },
    schedule: {
      get: vi.fn(), createBlock: vi.fn(), deleteBlock: vi.fn(), createAction: vi.fn(), updateAction: vi.fn(),
      deleteAction: vi.fn(),
    },
    devices: { list: vi.fn(), update: vi.fn(), remove: vi.fn(), permitJoin: vi.fn() },
    settings: { setRoomPin: vi.fn(), setTechnicianPin: vi.fn() },
    system: { network: vi.fn(), about: vi.fn(), restart: vi.fn() },
  };
}
```
10. Replace the whole file `apps/kiosk/src/data/realtime/cache-port.test.ts`:
```ts
import type { ClientSession } from "@eduscope/contracts";
import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import { queryKeys } from "@/data/query-keys";
import { stubApi } from "@/data/test/api-stub";
import { roomState } from "@/data/test/room-state";
import { createCachePort } from "./cache-port";

const api = stubApi();
const session: ClientSession = {
  public_id: "me", client_type: "remote", label: "laptop", access: "control",
  unlocked_at: null, last_activity: null, expires_at: null,
};

describe("cache port", () => {
  it("round-trips state and session through the query cache", () => {
    const queryClient = new QueryClient();
    const port = createCachePort(queryClient, api);
    expect(port.getState()).toBeUndefined();
    const state = roomState();
    port.setState(state);
    port.setSession(session);
    expect(port.getState()).toBe(state);
    expect(queryClient.getQueryData(queryKeys.state())).toBe(state);
    expect(port.getSession()).toBe(session);
  });

  it("invalidateAllExceptState leaves ['state'] valid", async () => {
    const queryClient = new QueryClient();
    const port = createCachePort(queryClient, api);
    port.setState(roomState());
    queryClient.setQueryData(queryKeys.devices(), []);
    port.invalidateAllExceptState();
    expect(queryClient.getQueryState(queryKeys.state())?.isInvalidated).toBe(false);
    expect(queryClient.getQueryState(queryKeys.devices())?.isInvalidated).toBe(true);
  });

  it("invalidate marks only the given keys", () => {
    const queryClient = new QueryClient();
    const port = createCachePort(queryClient, api);
    queryClient.setQueryData(queryKeys.irDevices(), []);
    queryClient.setQueryData(queryKeys.schedule(), {});
    port.invalidate([["ir", "devices"]]);
    expect(queryClient.getQueryState(queryKeys.irDevices())?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(queryKeys.schedule())?.isInvalidated).toBe(false);
  });
});
```

**Test:** Appended to `http-client.test.ts`: IR list + test-result POST body; learn/cancel/test paths (ids URL-encoded);
an ApiError on learn (H25); an invalid create refused before fetch; schedule PUT/DELETE; device PATCH + permit-join
`{"seconds":240}`; room PIN PUT, a 5-digit PIN refused before fetch; about parsed, restart POST.

**Verify:** `pnpm --filter @eduscope/kiosk exec vitest run src/data/adapters/http src/data/realtime/cache-port.test.ts` → 28 + 3 tests pass; then `pnpm verify` → exit 0.

**Commit:** `git add -A && git commit -m "feat(kiosk): ApiClient settings groups in the mock and http adapters"`

---

### T6 — IR capture store fed by `ir_capture` pushes (H21)
- [x] done

**Files:** `apps/kiosk/src/data/ir/capture-store.ts`, `apps/kiosk/src/data/ir/capture-store.test.ts`, `apps/kiosk/src/data/realtime/apply-event.ts`, `apps/kiosk/src/data/realtime/apply-event.test.ts`, `apps/kiosk/src/data/realtime/runtime.ts`

**Context:** Milestone note "Capture status arrives via the `ir_capture` WS event, not polling"; scope "WS `ir_capture` and
`invalidate` handling" (`invalidate` already works: `apply-event.ts` → `cache.invalidate`); ARCHITECTURE §4.5
("`ir_capture` → capture store for the S3 row (H21)"), H4 ("Any local pending overlays are cleared" on a snapshot).
Decision D5. Same shape as `pendingStore` / `inlineErrorStore`: a `createStore` map, one module instance, injected into
`applyEvent` so tests use their own. The store holds server pushes only; the row may `dismiss` an outcome it has shown.

**Do:**
1. Create `apps/kiosk/src/data/ir/capture-store.ts`:
```ts
import type { IrCaptureStatus, ServerEvent } from "@eduscope/contracts";
import { createStore, type Store } from "@/lib/store";

// H21: the latest `ir_capture` push per command (ARCHITECTURE §4.5). Server state, never set
// from a tap; the row only dismisses an outcome it has shown ("Captured · now test it" once the
// technician presses Test).

export type IrCaptureEvent = Extract<ServerEvent, { type: "ir_capture" }>;

export interface CaptureEntry {
  status: IrCaptureStatus;
  /** Server time when listening ends (`listening` only). */
  deadline: string | null;
}

export interface IrCaptureStore {
  entries: Store<ReadonlyMap<string, CaptureEntry>>;
  apply(event: IrCaptureEvent): void;
  dismiss(commandId: string): void;
  /** H4: a snapshot clears every local overlay. */
  clear(): void;
}

export function createIrCaptureStore(): IrCaptureStore {
  const entries = createStore<ReadonlyMap<string, CaptureEntry>>(new Map());
  const without = (commandId: string): Map<string, CaptureEntry> => {
    const next = new Map(entries.get());
    next.delete(commandId);
    return next;
  };
  return {
    entries,
    apply(event) {
      if (event.status === "cancelled") {
        entries.set(without(event.command_id)); // back to the stored code's status
        return;
      }
      // Only one capture runs at a time (one blaster): a new `listening` replaces any other.
      const next = event.status === "listening" ? new Map<string, CaptureEntry>() : without(event.command_id);
      next.set(event.command_id, { status: event.status, deadline: event.deadline });
      entries.set(next);
    },
    dismiss(commandId) {
      if (entries.get().has(commandId)) entries.set(without(commandId));
    },
    clear() {
      if (entries.get().size > 0) entries.set(new Map());
    },
  };
}

export const irCaptureStore = createIrCaptureStore();
```
2. Create `apps/kiosk/src/data/ir/capture-store.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { createIrCaptureStore, type IrCaptureEvent } from "./capture-store";

const event = (command_id: string, status: IrCaptureEvent["status"], deadline: string | null = null): IrCaptureEvent => ({
  type: "ir_capture", command_id, status, deadline,
});

describe("irCaptureStore (H21)", () => {
  it("keeps the latest status per command", () => {
    const store = createIrCaptureStore();
    store.apply(event("c1", "listening", "2026-10-13T09:00:20Z"));
    expect(store.entries.get().get("c1")).toEqual({ status: "listening", deadline: "2026-10-13T09:00:20Z" });
    store.apply(event("c1", "captured"));
    expect(store.entries.get().get("c1")).toEqual({ status: "captured", deadline: null });
  });

  it("cancelled removes the entry (the row shows the stored code again)", () => {
    const store = createIrCaptureStore();
    store.apply(event("c1", "listening", "2026-10-13T09:00:20Z"));
    store.apply(event("c1", "cancelled"));
    expect(store.entries.get().has("c1")).toBe(false);
  });

  it("a new listening replaces every other entry (one blaster)", () => {
    const store = createIrCaptureStore();
    store.apply(event("c1", "timeout"));
    store.apply(event("c2", "listening", "2026-10-13T09:00:20Z"));
    expect([...store.entries.get().keys()]).toEqual(["c2"]);
  });

  it("dismiss and clear", () => {
    const store = createIrCaptureStore();
    store.apply(event("c1", "captured"));
    store.apply(event("c2", "timeout"));
    store.dismiss("c1");
    expect([...store.entries.get().keys()]).toEqual(["c2"]);
    store.clear();
    expect(store.entries.get().size).toBe(0);
  });
});
```
3. In `apps/kiosk/src/data/realtime/apply-event.ts` replace:
```ts
import type { PendingStore } from "@/data/commands/pending-store";
```
with:
```ts
import type { PendingStore } from "@/data/commands/pending-store";
import type { IrCaptureStore } from "@/data/ir/capture-store";
```
4. In `apps/kiosk/src/data/realtime/apply-event.ts` replace:
```ts
  inlineErrors: InlineErrorStore;
  /** H13 toast (bottom, 4 s). */
```
with:
```ts
  inlineErrors: InlineErrorStore;
  /** H21 capture rows (S3). */
  irCapture: Pick<IrCaptureStore, "apply" | "clear">;
  /** H13 toast (bottom, 4 s). */
```
5. In `apps/kiosk/src/data/realtime/apply-event.ts` replace:
```ts
      deps.pending.clear();
      deps.cache.invalidateAllExceptState();
```
with:
```ts
      deps.pending.clear();
      deps.irCapture.clear();
      deps.cache.invalidateAllExceptState();
```
6. In `apps/kiosk/src/data/realtime/apply-event.ts` replace:
```ts
    case "ir_capture":
      return; // M06 adds the capture store (H21)
```
with:
```ts
    case "ir_capture":
      deps.irCapture.apply(event);
      return;
```
7. In `apps/kiosk/src/data/realtime/apply-event.test.ts` replace:
```ts
import { createPendingStore } from "@/data/commands/pending-store";
```
with:
```ts
import { createPendingStore } from "@/data/commands/pending-store";
import { createIrCaptureStore } from "@/data/ir/capture-store";
```
8. In `apps/kiosk/src/data/realtime/apply-event.test.ts` replace:
```ts
  const syncServerTime = vi.fn();
  const deps = { cache, pending, inlineErrors, toast, syncServerTime };
```
with:
```ts
  const syncServerTime = vi.fn();
  const irCapture = createIrCaptureStore();
  const deps = { cache, pending, inlineErrors, irCapture, toast, syncServerTime };
```
9. In `apps/kiosk/src/data/realtime/apply-event.test.ts` replace:
```ts
  it("ping and ir_capture change nothing", () => {
    const state = roomState();
    const t = setup(state);
    t.apply({ type: "ping" });
    t.apply({ type: "ir_capture", command_id: "c", status: "listening", deadline: null });
    expect(t.cache.getState()).toBe(state);
    expect(t.toast).not.toHaveBeenCalled();
    expect(t.cache.invalidated).toEqual([]);
  });
```
with:
```ts
  it("ping changes nothing", () => {
    const state = roomState();
    const t = setup(state);
    t.apply({ type: "ping" });
    expect(t.cache.getState()).toBe(state);
    expect(t.toast).not.toHaveBeenCalled();
    expect(t.cache.invalidated).toEqual([]);
  });

  it("ir_capture goes to the capture store only; a snapshot clears it (H21, H4)", () => {
    const state = roomState();
    const t = setup(state);
    t.apply({ type: "ir_capture", command_id: "c", status: "listening", deadline: "2026-10-05T10:42:20Z" });
    expect(t.irCapture.entries.get().get("c")).toEqual({ status: "listening", deadline: "2026-10-05T10:42:20Z" });
    expect(t.cache.getState()).toBe(state);
    t.apply({ type: "snapshot", state: roomState({ rev: 9 }) });
    expect(t.irCapture.entries.get().size).toBe(0);
  });
```
10. In `apps/kiosk/src/data/realtime/runtime.ts` replace:
```ts
import { pendingStore } from "@/data/commands/pending-store";
```
with:
```ts
import { pendingStore } from "@/data/commands/pending-store";
import { irCaptureStore } from "@/data/ir/capture-store";
```
11. In `apps/kiosk/src/data/realtime/runtime.ts` replace:
```ts
        inlineErrors: inlineErrorStore,
        toast: options.toast,
```
with:
```ts
        inlineErrors: inlineErrorStore,
        irCapture: irCaptureStore,
        toast: options.toast,
```

**Test:** `capture-store.test.ts`: latest status per command; cancelled removes; a new listening replaces every other entry; dismiss/clear. `apply-event.test.ts`: `ir_capture` lands in the store, not the cache; a snapshot clears it.

**Verify:** `pnpm --filter @eduscope/kiosk exec vitest run src/data/ir src/data/realtime/apply-event.test.ts` → 4 + 18 tests pass; then `pnpm verify` → exit 0.

**Commit:** `git add -A && git commit -m "feat(kiosk): IR capture store driven by ir_capture events"`

---

### T7 — Settings queries and the `useServerMutation` hook
- [x] done

**Files:** `apps/kiosk/src/data/settings/queries.ts`, `apps/kiosk/src/data/settings/queries.test.ts`, `apps/kiosk/src/data/settings/hooks.ts`

**Context:** Milestone scope "Query keys `["ir","devices"]`, `["schedule"]`, `["devices"]`, `["system",…]`" (they already exist
in `data/query-keys.ts`; CLAUDE.md: keys only from there); milestone note "queries must not run until
`session.access === "technician"`"; CLAUDE.md "The UI shows server state only … Never optimistically write values into
the query cache". Decision D10. Pattern: `queries.ts` (`queryOptions`, `staleTime: Infinity`, no refetch on focus —
pushes drive refreshes). About uses `staleTime: 0` so uptime is fresh each time the tab opens. `useServerMutation`
returns TanStack's mutation; its `onSettled` returns the refetch promise, so `isPending` lasts until the new server
value is in the cache.

**Do:**
1. Create `apps/kiosk/src/data/settings/queries.ts`:
```ts
import type { AboutInfo, Device, IrDevice, NetworkInfo, Schedule } from "@eduscope/contracts";
import { queryOptions } from "@tanstack/react-query";
import type { ApiClient } from "@/data/api-client";
import { queryKeys } from "@/data/query-keys";

// S3–S3e data (ARCHITECTURE §4.4). Technician-only on the server, so nothing is fetched until the
// session is `technician` (M08 would answer 403). Changes arrive as `invalidate` pushes; no
// polling, no refetch on focus.

const common = { staleTime: Infinity, refetchOnWindowFocus: false } as const;

export const irDevicesQuery = (api: ApiClient, enabled: boolean) =>
  queryOptions<IrDevice[]>({ ...common, queryKey: queryKeys.irDevices(), queryFn: () => api.ir.listDevices(), enabled });

export const scheduleQuery = (api: ApiClient, enabled: boolean) =>
  queryOptions<Schedule>({ ...common, queryKey: queryKeys.schedule(), queryFn: () => api.schedule.get(), enabled });

export const devicesQuery = (api: ApiClient, enabled: boolean) =>
  queryOptions<Device[]>({ ...common, queryKey: queryKeys.devices(), queryFn: () => api.devices.list(), enabled });

export const networkQuery = (api: ApiClient, enabled: boolean) =>
  queryOptions<NetworkInfo>({ ...common, queryKey: queryKeys.systemNetwork(), queryFn: () => api.system.network(), enabled });

/** S3e uptime: refetched each time About opens. */
export const aboutQuery = (api: ApiClient, enabled: boolean) =>
  queryOptions<AboutInfo>({ ...common, staleTime: 0, queryKey: queryKeys.systemAbout(), queryFn: () => api.system.about(), enabled });
```
2. Create `apps/kiosk/src/data/settings/queries.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { stubApi } from "@/data/test/api-stub";
import { aboutQuery, devicesQuery, irDevicesQuery, networkQuery, scheduleQuery } from "./queries";

describe("settings queries", () => {
  it("use the shared query keys and stay off until technician", () => {
    const api = stubApi();
    expect(irDevicesQuery(api, false)).toMatchObject({ queryKey: ["ir", "devices"], enabled: false });
    expect(scheduleQuery(api, true)).toMatchObject({ queryKey: ["schedule"], enabled: true, staleTime: Infinity });
    expect(devicesQuery(api, true)).toMatchObject({ queryKey: ["devices"], refetchOnWindowFocus: false });
    expect(networkQuery(api, false)).toMatchObject({ queryKey: ["system", "network"], enabled: false });
    expect(aboutQuery(api, true)).toMatchObject({ queryKey: ["system", "about"], staleTime: 0 });
  });
});
```
3. Create `apps/kiosk/src/data/settings/hooks.ts`:
```ts
import { useMutation, useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query";
import type { ApiClient } from "@/data/api-client";
import { useApiClient } from "@/data/api-context";
import { useSession } from "@/data/hooks";
import { aboutQuery, devicesQuery, irDevicesQuery, networkQuery, scheduleQuery } from "./queries";

/** Settings queries run only for a technician session (milestone note; core-api enforces it). */
export function useIsTechnician(): boolean {
  return useSession()?.access === "technician";
}

export const useIrDevices = () => useQuery(irDevicesQuery(useApiClient(), useIsTechnician()));
export const useSchedule = () => useQuery(scheduleQuery(useApiClient(), useIsTechnician()));
export const useDeviceRegistry = () => useQuery(devicesQuery(useApiClient(), useIsTechnician()));
export const useNetworkInfo = () => useQuery(networkQuery(useApiClient(), useIsTechnician()));
export const useAboutInfo = () => useQuery(aboutQuery(useApiClient(), useIsTechnician()));

/**
 * A settings change (CLAUDE.md: never optimistic). `isPending` stays true until the server
 * answered AND the listed queries have refetched, so the control shows its pending overlay
 * until the new server value is on screen. The server's `invalidate` push does the same for
 * every other client.
 */
export function useServerMutation<TArgs, TResult>(run: (api: ApiClient, args: TArgs) => Promise<TResult>, keys: readonly QueryKey[]) {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation<TResult, Error, TArgs>({
    mutationFn: (args) => run(api, args),
    onSettled: () => Promise.all(keys.map((queryKey) => queryClient.invalidateQueries({ queryKey }))),
  });
}
```

**Test:** `queries.test.ts`: every query uses its shared key, `enabled` follows the argument, `staleTime` Infinity (About 0), no refetch on focus.

**Verify:** `pnpm --filter @eduscope/kiosk exec vitest run src/data/settings` → 1 test passes; then `pnpm verify` → exit 0.

**Commit:** `git add -A && git commit -m "feat(kiosk): technician-only settings queries and server mutations"`

---

### T8 — shadcn `dialog` primitive
- [x] done

**Files:** `apps/kiosk/src/ui/dialog.tsx`

**Context:** CLAUDE.md "shadcn primitive → `apps/kiosk/src/ui/` (via shadcn CLI)"; milestone note "Sheets/dialogs use shadcn
`sheet`/`dialog` from `ui/`". The shadcn 4.21.4 CLI has the quirks recorded in PLAN-M02 T3 (checked again for
`dialog` on 2026-10-13): it imports `cn` from an npm package `cn` (and installs it), imports a `Button` from
`@/ui/button` that does not exist, uses `bg-black/50` / `bg-background` (not tokens) and adds a 16px close icon with
`hover:` styling. Decision D11: every dialog here has its own 48px Cancel, so the adapted file drops the close icon and
the footer's built-in close button. `radix-ui` (already a dependency) provides the primitive.

**Do:**
1. Run `cd apps/kiosk && pnpm dlx shadcn@4.21.4 add dialog --yes; cd ../..` — creates `apps/kiosk/src/ui/dialog.tsx` and adds the `cn` package
2. Run `pnpm --filter @eduscope/kiosk remove cn` — undo quirk (a)
3. Replace the whole file `apps/kiosk/src/ui/dialog.tsx`:
```tsx
import * as React from "react"
import { cn } from "@/lib/utils"
import { Dialog as DialogPrimitive } from "radix-ui"

// shadcn `dialog`, adapted: token colours, no built-in close icon (every dialog here has a 48px
// Cancel button instead, SPEC §3.3), no hover styling.

function Dialog({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-bg/80 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0",
        className
      )}
      {...props}
    />
  )
}

function DialogContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content>) {
  return (
    <DialogPortal data-slot="dialog-portal">
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          "fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-card border border-border-strong bg-surface p-6 shadow-lg duration-200 outline-none data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 sm:max-w-lg",
          className
        )}
        {...props}
      >
        {children}
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-2 text-left", className)}
      {...props}
    />
  )
}

function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn("grid grid-cols-2 gap-3", className)}
      {...props}
    />
  )
}

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("text-card-title font-semibold text-text-1", className)}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-caption text-text-2", className)}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
```

**Verify:** `grep -rn '"cn"\|bg-black\|bg-background\|hover:' apps/kiosk/src/ui/dialog.tsx` → no output; `git diff --stat apps/kiosk/package.json` → no change; then `pnpm verify` → exit 0.

**Commit:** `git add -A && git commit -m "feat(kiosk): shadcn dialog primitive"`

---

### T9 — `SettingsSheet`: bottom sheet on phone, side sheet at lg
- [x] done

**Files:** `apps/kiosk/src/lib/use-media-query.ts`, `apps/kiosk/src/features/settings/shared/SettingsSheet.tsx`

**Context:** Milestone note "on phone sheets open from the bottom"; SPEC §2.2 (thumb reach), §3.3 (48px targets); ARCHITECTURE §4.1
(`lg` = 1024). Decision D11. Reuses `ui/sheet.tsx` (M02) with `showCloseButton={false}` (its icon is <48px, REVIEW-M02
L5); each sheet puts its own Cancel in `SheetActions` (T10). `useMediaQuery` is the only JS breakpoint read, because
Radix needs the `side` prop (classes alone can't switch the slide direction). Nothing renders it yet.

**States:** open / closed (Radix); content scrolls inside the sheet when taller than 90dvh.

**Layout:** `<lg`: `side="bottom"`, `max-h-[90dvh] rounded-t-card`; `lg:` `side="right"`, `w-full sm:max-w-md`. Padding `p-4 lg:p-6`, title `text-title font-bold text-text-1`, description `text-caption text-text-2`.

**Do:**
1. Create `apps/kiosk/src/lib/use-media-query.ts`:
```ts
import { useSyncExternalStore } from "react";

/** `true` while the media query matches (e.g. `(min-width: 1024px)` = Tailwind `lg`). */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** Tailwind `lg` (SPEC §2.2: ≥1024). */
export const LG_QUERY = "(min-width: 1024px)";
```
2. Create `apps/kiosk/src/features/settings/shared/SettingsSheet.tsx`:
```tsx
import type { ReactNode } from "react";
import { LG_QUERY, useMediaQuery } from "@/lib/use-media-query";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/ui/sheet";

/**
 * Every S3 sheet (milestone note): from the bottom below `lg` (thumb reach), from the right at
 * `lg`. Scrolls inside itself; the shadcn close icon is off (<48px), each sheet has Cancel.
 */
export function SettingsSheet({ open, onOpenChange, title, description, children }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  const wide = useMediaQuery(LG_QUERY);
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={wide ? "right" : "bottom"}
        showCloseButton={false}
        aria-describedby={description === undefined ? undefined : "settings-sheet-description"}
        className={cn("gap-0 overflow-y-auto p-4 lg:p-6", wide ? "w-full sm:max-w-md" : "max-h-[90dvh] rounded-t-card")}
      >
        <SheetTitle className="text-title font-bold text-text-1">{title}</SheetTitle>
        {description !== undefined && (
          <SheetDescription id="settings-sheet-description" className="mt-1 text-caption text-text-2">
            {description}
          </SheetDescription>
        )}
        <div className="mt-4 flex flex-col gap-4">{children}</div>
      </SheetContent>
    </Sheet>
  );
}
```

**Verify:** `pnpm verify` → exit 0 (typecheck proves both files).

**Commit:** `git add -A && git commit -m "feat(kiosk): settings sheet that opens from the bottom on phones"`

---

### T10 — Sheet form controls: `TextField`, `ChoiceGroup`, `SheetActions`
- [x] done

**Files:** `apps/kiosk/src/features/settings/shared/TextField.tsx`, `apps/kiosk/src/features/settings/shared/ChoiceGroup.tsx`, `apps/kiosk/src/features/settings/shared/SheetActions.tsx`, `apps/kiosk/src/features/settings/shared/form-result.ts`

**Context:** Inputs of the S3.E9, S3.E16, S3c and S3d sheets. SPEC §3.3 (48px targets, radius 8), §3.4 ("Selected" =
`selected-fill` + `accent-border` → `ACTIVE_CONTROL_CLASS.selected`; neutral = `INACTIVE_CONTROL_CLASS`), §2.6 (pressed
on touch-down → `usePressed`). Reuse `CommandButton` (Cancel / Save, Save uses `active="confirmed"` and the H5 pulse
while pending) and `InlineError` (save failure). `FormResult` is the one result type every sheet validator returns.

**States:** TextField: default (`border-border-strong`), focused (`focus:border-text-2`), invalid (`border-danger` + red caption under it), disabled (40%). ChoiceGroup: selected / not selected / disabled. SheetActions: Save pending (pulse, taps ignored), Save disabled (offline), save failed (red line above the buttons).

**Layout:** Same at every width: fields full width; ChoiceGroup is a `grid` with 2, 3 or 4 equal columns (labels wrap to two lines inside the 48px button, e.g. "Air conditioning" at 390); SheetActions `grid grid-cols-2 gap-3`.

**Do:**
1. Create `apps/kiosk/src/features/settings/shared/form-result.ts`:
```ts
/** A sheet's form checked against its contract: the request body, or one message per field. */
export type FormResult<T, F extends string> = { ok: true; value: T } | { ok: false; errors: Partial<Record<F, string>> };
```
2. Create `apps/kiosk/src/features/settings/shared/TextField.tsx`:
```tsx
import { useId } from "react";
import { cn } from "@/lib/utils";

/** Labelled 48px input with an inline validation line (S3 sheets). */
export function TextField({ label, value, onChange, error = null, type = "text", disabled = false, maxLength = 40 }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string | null;
  type?: "text" | "time";
  disabled?: boolean;
  maxLength?: number;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-caption font-semibold text-text-2">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        disabled={disabled}
        maxLength={maxLength}
        aria-invalid={error !== null}
        aria-describedby={error === null ? undefined : `${id}-error`}
        onChange={(event) => onChange(event.target.value)}
        className={cn(
          "h-12 w-full rounded-btn border-2 bg-control px-3 text-button text-text-1 outline-none focus:border-text-2",
          error === null ? "border-border-strong" : "border-danger",
          disabled && "opacity-40",
        )}
      />
      {error !== null && (
        <p id={`${id}-error`} className="text-caption text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
```
3. Create `apps/kiosk/src/features/settings/shared/ChoiceGroup.tsx`:
```tsx
import { ACTIVE_CONTROL_CLASS, DISABLED_CONTROL_CLASS, INACTIVE_CONTROL_CLASS } from "@/components/state-styles";
import { usePressed } from "@/lib/use-pressed";
import { cn } from "@/lib/utils";

export interface Choice<T extends string> {
  value: T;
  label: string;
}

function ChoiceButton({ label, selected, disabled, onPress }: { label: string; selected: boolean; disabled: boolean; onPress: () => void }) {
  const pressed = usePressed();
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      {...pressed}
      onClick={onPress}
      className={cn(
        "flex h-12 min-w-12 items-center justify-center rounded-btn border-2 px-3 text-button font-semibold",
        "transition-[filter] active:brightness-125 data-[pressed=true]:brightness-125",
        selected ? ACTIVE_CONTROL_CLASS.selected : INACTIVE_CONTROL_CLASS,
        disabled && DISABLED_CONTROL_CLASS,
      )}
    >
      {label}
    </button>
  );
}

/** One-of choice in a sheet (transport, kind, AC mode/fan, preset). Selected = SPEC §3.4 "Selected". */
export function ChoiceGroup<T extends string>({ label, options, value, onChange, disabled = false, columns = 3 }: {
  label: string;
  options: readonly Choice<T>[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
  /** Grid columns at every width (labels are short). */
  columns?: 2 | 3 | 4;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-col gap-2">
      <span className="text-caption font-semibold text-text-2">{label}</span>
      <div className={cn("grid gap-2", { 2: "grid-cols-2", 3: "grid-cols-3", 4: "grid-cols-4" }[columns])}>
        {options.map((option) => (
          <ChoiceButton
            key={option.value}
            label={option.label}
            selected={option.value === value}
            disabled={disabled}
            onPress={() => onChange(option.value)}
          />
        ))}
      </div>
    </div>
  );
}
```
4. Create `apps/kiosk/src/features/settings/shared/SheetActions.tsx`:
```tsx
import { CommandButton } from "@/components/CommandButton";
import { InlineError } from "@/components/InlineError";

/** Cancel · Save row at the bottom of a sheet, with the save failure above it. */
export function SheetActions({ saveLabel = "Save", onCancel, onSave, pending, disabled = false, error = null }: {
  saveLabel?: string;
  onCancel: () => void;
  onSave: () => void;
  pending: boolean;
  disabled?: boolean;
  error?: string | null;
}) {
  return (
    <div className="flex flex-col gap-3 pt-2">
      <InlineError message={error} />
      <div className="grid grid-cols-2 gap-3">
        <CommandButton label="Cancel" onPress={onCancel} />
        <CommandButton label={saveLabel} active="confirmed" pending={pending} disabled={disabled} onPress={onSave} />
      </div>
    </div>
  );
}
```

**Verify:** `pnpm verify` → exit 0.

**Commit:** `git add -A && git commit -m "feat(kiosk): settings form controls"`

---

### T11 — `ConfirmDialog` for Restart and Remove
- [x] done

**Files:** `apps/kiosk/src/features/settings/shared/ConfirmDialog.tsx`

**Context:** SPEC S3e ("Restart controller" button (asks to confirm)); S3d remove (decision D18: a destructive tap is confirmed).
Uses `ui/dialog.tsx` (T8). Confirm button: `CommandButton` with `border-danger text-danger` (SPEC §3.1 `danger`), H5 pulse
while pending; the failure line uses `InlineError`.

**States:** open, pending (confirm pulses, Cancel still works), failed (red line above the buttons), closed.

**Layout:** Centred at every width (`max-w-[calc(100%-2rem)] sm:max-w-lg`); buttons `grid grid-cols-2 gap-3`, 48px.

**Do:**
1. Create `apps/kiosk/src/features/settings/shared/ConfirmDialog.tsx`:
```tsx
import { CommandButton } from "@/components/CommandButton";
import { InlineError } from "@/components/InlineError";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/ui/dialog";

/** "Restart controller?", "Remove {device}?": Cancel · confirm (48px), pending while the request runs. */
export function ConfirmDialog({ open, onOpenChange, title, description, confirmLabel, onConfirm, pending, error = null }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
  pending: boolean;
  error?: string | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <InlineError message={error} />
        <DialogFooter>
          <CommandButton label="Cancel" onPress={() => onOpenChange(false)} />
          <CommandButton label={confirmLabel} className="border-danger text-danger" pending={pending} onPress={onConfirm} />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

**Verify:** `pnpm verify` → exit 0.

**Commit:** `git add -A && git commit -m "feat(kiosk): confirm dialog"`

---

### T12 — `QueryStatus`, `SettingsRow` and `useWritable`
- [x] done

**Files:** `apps/kiosk/src/features/settings/shared/QueryStatus.tsx`, `apps/kiosk/src/features/settings/shared/SettingsRow.tsx`, `apps/kiosk/src/features/settings/shared/use-writable.ts`

**Context:** H1 (skeleton blocks in `surface-2` while loading), H2/H3 (controls disabled while not connected: `useWritable` is
`live || back_online`, the same rule as `computeControlGate`), S3b/S3e label/value rows. Reuse `Skeleton`, `InlineError`,
`CommandButton`, `VALUE_TONE_CLASS`. The error copy is "Couldn't load {what}" + **Retry** (48px).

**States:** QueryStatus: pending (N skeleton rows, `aria-busy`), error (red line + Retry). SettingsRow: value, missing value (`—` in text-3), toned value (accent/danger), trailing control.

**Layout:** SettingsRow `flex min-h-14 justify-between` at every width, `border-t border-border` between rows; long values truncate.

**Do:**
1. Create `apps/kiosk/src/features/settings/shared/QueryStatus.tsx`:
```tsx
import { CommandButton } from "@/components/CommandButton";
import { InlineError } from "@/components/InlineError";
import { Skeleton } from "@/ui/skeleton";

/** Loading (H1-style skeleton rows) or failed ("Couldn't load …" + Retry) for a settings query. */
export function QueryStatus({ status, what, onRetry, rows = 3 }: {
  status: "pending" | "error";
  what: string;
  onRetry: () => void;
  rows?: number;
}) {
  if (status === "pending") {
    return (
      <div className="flex flex-col gap-2" aria-busy="true">
        {Array.from({ length: rows }, (_, index) => (
          <Skeleton key={index} className="h-14 w-full" />
        ))}
      </div>
    );
  }
  return (
    <div className="flex flex-col items-start gap-3">
      <InlineError message={`Couldn't load ${what}`} />
      <CommandButton label="Retry" onPress={onRetry} />
    </div>
  );
}
```
2. Create `apps/kiosk/src/features/settings/shared/SettingsRow.tsx`:
```tsx
import type { ReactNode } from "react";
import { VALUE_TONE_CLASS, type ValueTone } from "@/components/state-styles";
import { cn } from "@/lib/utils";

/** S3b/S3d/S3e label/value row: 56px, label text-2 left, value right (mono for ids), optional action. */
export function SettingsRow({ label, value, mono = false, tone = "default", children }: {
  label: string;
  value?: string | null;
  mono?: boolean;
  tone?: ValueTone;
  /** A trailing control ("Change"). */
  children?: ReactNode;
}) {
  return (
    <div className="flex min-h-14 items-center justify-between gap-4 border-t border-border py-2 first:border-t-0">
      <span className="text-button text-text-2">{label}</span>
      <span className="flex min-w-0 items-center gap-3">
        {value !== undefined && (
          <span className={cn("truncate text-right text-button", mono && "font-mono", value === null ? "text-text-3" : VALUE_TONE_CLASS[tone])}>
            {value ?? "—"}
          </span>
        )}
        {children}
      </span>
    </div>
  );
}
```
3. Create `apps/kiosk/src/features/settings/shared/use-writable.ts`:
```ts
import { useConnectionStatus } from "@/data/hooks";

/** Settings controls are usable only while connected (H2/H3 disable every control). */
export function useWritable(): boolean {
  const status = useConnectionStatus();
  return status === "live" || status === "back_online";
}
```

**Verify:** `pnpm verify` → exit 0.

**Commit:** `git add -A && git commit -m "feat(kiosk): settings loading, error and row pieces"`

---

### T13 — Settings header (S3.E1–E4)
- [x] done

**Files:** `apps/kiosk/src/app/Header.tsx`, `apps/kiosk/src/features/settings/TechnicianAccess.tsx`

**Context:** SPEC S3.E1 "← Controls" (navigate to S1; the technician session stays), S3.E2 "Settings", S3.E3 "Technician access"
+ `[INFERRED]` Lock, S3.E4 `R-101`; screenshot 03 top row. Decision D12. Same pattern as M05's `/devices` variant:
`Header` picks the content with `useMatch`. The room chip is shared by S1 and S3 (`RoomChip`), `TechnicianAccess`
(M03) moves from the page body into the header (the page drops it in T14). At 390 the row must hold back, title,
"Technician access", Lock and `R-101`: the back link is icon-only below 600 and "Technician access" wraps to two
lines (`w-16`).

**States:** Lock pending (pulse, M03); Lock failed (toast "Couldn't lock · try again", M03). Before the snapshot the chip shows `VITE_ROOM_ID` (H1).

**Layout:** `<600`: back link `size-12` icon-only (`aria-label="Controls"`), title `text-card-title`, right group `gap-1`. `sm:` back link with label, title `sm:text-title`, `sm:gap-3`. Header itself unchanged (`h-14 sm:h-16`).

**Do:**
1. In `apps/kiosk/src/app/Header.tsx` replace:
```tsx
import { HeaderLockButton } from "@/features/session/HeaderLockButton";
```
with:
```tsx
import { HeaderLockButton } from "@/features/session/HeaderLockButton";
import { TechnicianAccess } from "@/features/settings/TechnicianAccess";
```
2. In `apps/kiosk/src/app/Header.tsx` replace:
```tsx
/** S1.E1–E8. Phone (<600): one 56px row (SPEC §2.2). */
```
with:
```tsx
/** The `R-101` chip (S1.E5, S3.E4). */
function RoomChip() {
  const roomId = useRoomState((state) => state.room.id) ?? kioskEnv.VITE_ROOM_ID;
  return (
    <span className="flex h-10 shrink-0 items-center whitespace-nowrap rounded-chip border border-border-strong bg-control px-2 font-mono text-card-title font-semibold text-text-1 sm:h-12 sm:px-3">
      {roomId}
    </span>
  );
}

/** S3.E1–E4. Phone: the back link is icon-only so "Technician access", Lock and `R-101` fit 390px. */
function SettingsHeaderContent() {
  const pressed = usePressed();
  return (
    <>
      <Link to="/" aria-label="Controls" {...pressed} className={cn(HEADER_BUTTON_CLASS, "sm:px-3")}>
        <ArrowLeft aria-hidden="true" className="size-5 shrink-0" />
        <span className="hidden whitespace-nowrap sm:inline">Controls</span>
      </Link>
      <h1 className="min-w-0 flex-1 truncate text-card-title font-bold text-text-1 sm:text-title">Settings</h1>
      <div className="flex shrink-0 items-center justify-end gap-1 sm:gap-3">
        <TechnicianAccess />
        <RoomChip />
      </div>
    </>
  );
}

/** S1.E1–E8. Phone (<600): one 56px row (SPEC §2.2). */
```
3. In `apps/kiosk/src/app/Header.tsx` replace:
```tsx
function ControlHeaderContent() {
  const roomId = useRoomState((state) => state.room.id) ?? kioskEnv.VITE_ROOM_ID;
  const now = useServerNow();
```
with:
```tsx
function ControlHeaderContent() {
  const now = useServerNow();
```
4. In `apps/kiosk/src/app/Header.tsx` replace:
```tsx
        <StatusIndicator />
        <span className="flex h-10 shrink-0 items-center whitespace-nowrap rounded-chip border border-border-strong bg-control px-2 font-mono text-card-title font-semibold text-text-1 sm:h-12 sm:px-3">
          {roomId}
        </span>
```
with:
```tsx
        <StatusIndicator />
        <RoomChip />
```
5. In `apps/kiosk/src/app/Header.tsx` replace:
```tsx
/** One header (ARCHITECTURE §4.1); `/devices` gets the S2 variant. */
export function Header() {
  const onDevices = useMatch("/devices") !== null;
  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-header px-4 sm:h-16 lg:px-6">
      {onDevices ? <DevicesHeaderContent /> : <ControlHeaderContent />}
    </header>
  );
}
```
with:
```tsx
/** One header (ARCHITECTURE §4.1); `/devices` gets the S2 variant, `/settings/*` the S3 one. */
export function Header() {
  const onDevices = useMatch("/devices") !== null;
  const onSettings = useMatch("/settings/*") !== null;
  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-header px-4 sm:h-16 lg:px-6">
      {onDevices ? <DevicesHeaderContent /> : onSettings ? <SettingsHeaderContent /> : <ControlHeaderContent />}
    </header>
  );
}
```
6. Replace the whole file `apps/kiosk/src/features/settings/TechnicianAccess.tsx`:
```tsx
import { toast } from "sonner";
import { LockButton } from "@/components/LockButton";
import { LOCK_FAILED_MESSAGE } from "@/data/access/session-actions";
import { useLock } from "@/data/hooks";

/** S3.E3 "Technician access" with Lock beside it (every client, kiosk included), in the S3 header. */
export function TechnicianAccess() {
  const lock = useLock();
  return (
    <div className="flex items-center justify-end gap-1 sm:gap-3">
      {/* Phone: two short lines ("Technician / access") so the 390px header row fits. */}
      <span className="w-16 text-caption leading-tight text-text-2 sm:w-auto">Technician access</span>
      <LockButton
        pending={lock.pending}
        onPress={() => {
          void lock.run().then((ok) => {
            if (!ok) toast(LOCK_FAILED_MESSAGE);
          });
        }}
      />
    </div>
  );
}
```

**Verify:** `pnpm verify` → exit 0. Human: `pnpm --filter @eduscope/kiosk dev`, Settings → PIN `123456`: the header reads "← Controls · Settings … Technician access [Lock] R-101" at 1280 and "← · Settings · Technician/access · 🔒 · R-101" on one 56px row at 390 (no horizontal scroll).

**Commit:** `git add -A && git commit -m "feat(kiosk): settings header with technician access"`

---

### T14 — Settings tab strip (S3.E5) and page frame
- [x] done

**Files:** `apps/kiosk/src/features/settings/tabs.ts`, `apps/kiosk/src/features/settings/SettingsTabs.tsx`, `apps/kiosk/src/features/settings/SettingsPage.tsx`

**Context:** SPEC S3.E5 (tabs "Remote configuration · Network · Schedule · Devices · About"; active: `surface` fill, `text-1`,
attached to the content; inactive `text-2`), §2.2 S3 phone ("The tab strip scrolls horizontally inside itself. The
active tab is scrolled into view."), ARCHITECTURE §4.1 (`overflow-x-clip` on the shell; the strip scrolls itself) and
§4.3 (routes; `router.tsx` already maps every tab, unchanged). Screenshot 03: a full-width band under the header with
the active tab joined to the page. The tab contents are placeholders until T28, T31, T37, T45 and T49 swap them in.

**States:** active tab (`aria-current="page"`, `border-border bg-surface text-text-1`), inactive (`border-transparent text-text-2`), pressed (brightness on touch-down).

**Layout:** Band bleeds to the screen edges: `-mx-4 -mt-4 lg:-mx-6 lg:-mt-6`, `bg-header`; inner row `w-max min-w-full border-b border-border px-4 pt-2 lg:px-6 lg:pt-4`; tabs `h-12 px-4 lg:h-14 lg:px-6 rounded-t-card -mb-px` so the active tab covers the band's bottom line. Scroller `overflow-x-auto [scrollbar-width:none]`.

**Do:**
1. Create `apps/kiosk/src/features/settings/tabs.ts`:
```ts
// S3.E5 tab names and routes, in screenshot order.
export const SETTINGS_TABS = [
  { tab: "remote", label: "Remote configuration", path: "/settings/remote" },
  { tab: "network", label: "Network", path: "/settings/network" },
  { tab: "schedule", label: "Schedule", path: "/settings/schedule" },
  { tab: "devices", label: "Devices", path: "/settings/devices" },
  { tab: "about", label: "About", path: "/settings/about" },
] as const;

export type SettingsTab = (typeof SETTINGS_TABS)[number]["tab"];
```
2. Create `apps/kiosk/src/features/settings/SettingsTabs.tsx`:
```tsx
import { useEffect, useRef } from "react";
import { Link } from "react-router";
import { usePressed } from "@/lib/use-pressed";
import { cn } from "@/lib/utils";
import { SETTINGS_TABS, type SettingsTab } from "./tabs";

function TabLink({ to, label, active }: { to: string; label: string; active: boolean }) {
  const pressed = usePressed();
  const ref = useRef<HTMLAnchorElement>(null);
  // SPEC §2.2: on a phone the strip scrolls inside itself and the active tab is scrolled into view.
  useEffect(() => {
    if (active) ref.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [active]);
  return (
    <Link
      ref={ref}
      to={to}
      aria-current={active ? "page" : undefined}
      {...pressed}
      className={cn(
        "-mb-px flex h-12 shrink-0 items-center whitespace-nowrap rounded-t-card border border-b-0 px-4 text-button font-semibold lg:h-14 lg:px-6",
        "active:brightness-125 data-[pressed=true]:brightness-125",
        active ? "border-border bg-surface text-text-1" : "border-transparent text-text-2",
      )}
    >
      {label}
    </Link>
  );
}

/**
 * S3.E5. Full-bleed band under the header; the active tab covers the band's bottom line, so it
 * looks attached to the content. The line belongs to the inner row (not the scroller), so the
 * 1px overlap never makes the strip scroll vertically.
 */
export function SettingsTabs({ active }: { active: SettingsTab }) {
  return (
    <nav aria-label="Settings" className="-mx-4 -mt-4 overflow-x-auto bg-header [scrollbar-width:none] lg:-mx-6 lg:-mt-6">
      <div className="flex w-max min-w-full gap-1 border-b border-border px-4 pt-2 lg:px-6 lg:pt-4">
        {SETTINGS_TABS.map((item) => (
          <TabLink key={item.tab} to={item.path} label={item.label} active={item.tab === active} />
        ))}
      </div>
    </nav>
  );
}
```
3. Replace the whole file `apps/kiosk/src/features/settings/SettingsPage.tsx`:
```tsx
import { PlaceholderPage } from "@/components/PlaceholderPage";
import { SettingsTabs } from "./SettingsTabs";
import type { SettingsTab } from "./tabs";

export type { SettingsTab } from "./tabs";

function TabContent({ tab }: { tab: SettingsTab }) {
  switch (tab) {
    case "remote":
      return <PlaceholderPage title="Remote configuration" spec="S3" milestone="M06" />;
    case "network":
      return <PlaceholderPage title="Network" spec="S3b" milestone="M06" />;
    case "schedule":
      return <PlaceholderPage title="Schedule" spec="S3c" milestone="M06" />;
    case "devices":
      return <PlaceholderPage title="Devices" spec="S3d" milestone="M06" />;
    case "about":
      return <PlaceholderPage title="About" spec="S3e" milestone="M06" />;
  }
}

/** `/settings/*` (S3–S3e). SettingsGuard (router) keeps it technician-only; the header shows S3.E1–E4. */
export function SettingsPage({ tab }: { tab: SettingsTab }) {
  return (
    <div className="flex flex-col gap-4 lg:gap-6">
      <SettingsTabs active={tab} />
      <TabContent tab={tab} />
    </div>
  );
}
```

**Verify:** `pnpm verify` → exit 0. Human: 390px, `/settings/about` (after the PIN): the strip is scrolled so "About" is visible; dragging the strip scrolls it, the page itself never scrolls sideways (`document.documentElement.scrollWidth === 390`).

**Commit:** `git add -A && git commit -m "feat(kiosk): settings tab strip"`

---

### T15 — Remote selectors: capture status, device count, subtitles, selection
- [x] done

**Files:** `apps/kiosk/src/features/settings/remote/remote.view.ts`, `apps/kiosk/src/features/settings/remote/remote.view.test.ts`

**Context:** SPEC S3.E7 (item "Air conditioning" / "Panasonic · via ZS06" / `14`; count = captured commands; `[INFERRED]` amber
if any command is untested), S3.E12 ("Epson · two commands · via ZS06"; words for small numbers), S3.E14 (every capture
status variant), H20, R5, R8 ("via ZS06" / "via MCU"), Q22; AC3 ("tested ✓ just now"). Decisions D7, D8, D9. Pure
functions in the M04/M05 `*.view.ts` style; tones are `ValueTone`s (`muted` = text-2, `warn`, `danger`, `accent`,
`faint` = text-3) so components colour through `VALUE_TONE_CLASS` only. Reuse `formatAgo` (`lib/format.ts`).

**Do:**
1. Create `apps/kiosk/src/features/settings/remote/remote.view.ts`:
```ts
import type { IrCommand, IrDevice, IrTransport } from "@eduscope/contracts";
import type { ValueTone } from "@/components/state-styles";
import { formatAgo } from "@/lib/format";

// S3.E7–E14 selectors (Q22, H20, R5, R8). Pure; the cards only render what these return.

/** R8: "via ZS06" / "via MCU". */
export const TRANSPORT_LABEL: Record<IrTransport, string> = { ir_zs06: "ZS06", ir_mcu: "MCU" };
const CODE_FORMAT_LABEL: Record<IrCommand["code_format"], string> = { tuya: "Tuya code" };
const COUNT_WORDS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"] as const;

export interface ToneText {
  text: string;
  tone: ValueTone;
}

/** S3.E7 line 2: "Panasonic · via ZS06". */
export function deviceSubtitle(device: Pick<IrDevice, "brand" | "transport">): string {
  return [device.brand, `via ${TRANSPORT_LABEL[device.transport]}`].filter((part) => part !== "").join(" · ");
}

/** S3.E12: "two commands", "one command", "14 commands" (words below 10). */
export function commandCountWords(count: number): string {
  const number = COUNT_WORDS[count] ?? String(count);
  return `${number} ${count === 1 ? "command" : "commands"}`;
}

/** S3.E12 right side: "Epson · two commands · via ZS06". */
export function detailSubtitle(device: IrDevice): string {
  return [device.brand, commandCountWords(device.commands.length), `via ${TRANSPORT_LABEL[device.transport]}`]
    .filter((part) => part !== "")
    .join(" · ");
}

/**
 * S3.E7 count = captured commands (Q22). Amber when any command still needs attention (not
 * captured, untested or no reaction, H20); green otherwise; grey `0` with no commands.
 */
export function deviceCount(device: IrDevice): ToneText {
  const captured = device.commands.filter((command) => command.captured).length;
  if (device.commands.length === 0) return { text: "0", tone: "faint" };
  const needsAttention = device.commands.some((command) => !command.captured || command.test !== "reacted");
  return { text: String(captured), tone: needsAttention ? "warn" : "accent" };
}

/** "just now" under a minute, then "2 min ago" (AC3: "tested ✓ just now"). */
export function testedAgo(testedAt: string, now: Date): string {
  return now.getTime() - Date.parse(testedAt) < 60_000 ? "just now" : formatAgo(testedAt, now);
}

/**
 * S3.E14 capture status of the stored code (mono, text-2 unless stated):
 * "Not captured" amber · "Tuya code · captured · untested" amber (H20) · "Tuya code · no reaction"
 * red · "Tuya code · tested ✓ 2 min ago" · "Tuya code · captured" (tested before test times were
 * kept). "Listening…" is the capture row's own state (command-row.ts).
 */
export function commandStatus(command: IrCommand, now: Date): ToneText {
  if (!command.captured) return { text: "Not captured", tone: "warn" };
  const format = CODE_FORMAT_LABEL[command.code_format];
  switch (command.test) {
    case "untested":
      return { text: `${format} · captured · untested`, tone: "warn" };
    case "no_reaction":
      return { text: `${format} · no reaction`, tone: "danger" };
    case "reacted":
      return command.tested_at === null
        ? { text: `${format} · captured`, tone: "muted" }
        : { text: `${format} · tested ✓ ${testedAgo(command.tested_at, now)}`, tone: "muted" };
  }
}

/**
 * Which device the right column shows. The route's id when it exists; otherwise (wide layout,
 * no id) the projector, else the first device — screenshot 03 opens on Projector.
 */
export function selectedDevice(devices: readonly IrDevice[], routeId: string | undefined): IrDevice | undefined {
  if (routeId !== undefined) return devices.find((device) => device.device_id === routeId);
  return devices.find((device) => device.kind === "projector") ?? devices[0];
}
```
2. Create `apps/kiosk/src/features/settings/remote/remote.view.test.ts`:
```ts
import type { IrCommand, IrDevice } from "@eduscope/contracts";
import { describe, expect, it } from "vitest";
import { commandCountWords, commandStatus, detailSubtitle, deviceCount, deviceSubtitle, selectedDevice, testedAgo } from "./remote.view";

const NOW = new Date("2026-10-13T09:00:00Z");
const cmd = (patch: Partial<IrCommand> = {}): IrCommand => ({
  id: "c1", device_id: "projector", name: "Power on", role: "power_on", setpoint: null, code_format: "tuya",
  captured: true, captured_at: "2026-10-01T09:00:00Z", test: "reacted", tested_at: null, ...patch,
});
const device = (commands: IrCommand[], patch: Partial<IrDevice> = {}): IrDevice => ({
  device_id: "projector", name: "Projector", brand: "Epson", kind: "projector", transport: "ir_zs06", commands, ...patch,
});

describe("commandStatus (S3.E14)", () => {
  it.each<[string, Partial<IrCommand>, string, string]>([
    ["not captured", { captured: false, captured_at: null, test: "untested" }, "Not captured", "warn"],
    ["captured, untested (H20)", { test: "untested" }, "Tuya code · captured · untested", "warn"],
    ["no reaction", { test: "no_reaction", tested_at: "2026-10-13T08:59:00Z" }, "Tuya code · no reaction", "danger"],
    ["tested just now", { tested_at: "2026-10-13T08:59:30Z" }, "Tuya code · tested ✓ just now", "muted"],
    ["tested 2 min ago", { tested_at: "2026-10-13T08:58:00Z" }, "Tuya code · tested ✓ 2 min ago", "muted"],
    ["captured, tested before times were kept (screenshot 03)", {}, "Tuya code · captured", "muted"],
  ])("%s", (_name, patch, text, tone) => {
    expect(commandStatus(cmd(patch), NOW)).toEqual({ text, tone });
  });

  it("testedAgo switches from 'just now' at one minute", () => {
    expect(testedAgo("2026-10-13T08:59:01Z", NOW)).toBe("just now");
    expect(testedAgo("2026-10-13T08:59:00Z", NOW)).toBe("1 min ago");
  });
});

describe("device count colour (S3.E7, Q22, H20)", () => {
  it("green when every command is captured and reacted", () => {
    expect(deviceCount(device([cmd(), cmd({ id: "c2" })]))).toEqual({ text: "2", tone: "accent" });
  });
  it("amber when one is untested; counts captured commands only", () => {
    expect(deviceCount(device([cmd(), cmd({ id: "c2", test: "untested" })]))).toEqual({ text: "2", tone: "warn" });
    expect(deviceCount(device([cmd(), cmd({ id: "c2", captured: false, test: "untested" })]))).toEqual({ text: "1", tone: "warn" });
  });
  it("amber after a no reaction; grey 0 with no commands", () => {
    expect(deviceCount(device([cmd({ test: "no_reaction" })]))).toEqual({ text: "1", tone: "warn" });
    expect(deviceCount(device([]))).toEqual({ text: "0", tone: "faint" });
  });
});

describe("subtitles (S3.E7, S3.E12, R8)", () => {
  it("brand · via transport", () => {
    expect(deviceSubtitle(device([]))).toBe("Epson · via ZS06");
    expect(deviceSubtitle(device([], { brand: "", transport: "ir_mcu" }))).toBe("via MCU");
  });
  it("command count in words below ten", () => {
    expect(commandCountWords(0)).toBe("no commands");
    expect(commandCountWords(1)).toBe("one command");
    expect(commandCountWords(2)).toBe("two commands");
    expect(commandCountWords(14)).toBe("14 commands");
    expect(detailSubtitle(device([cmd(), cmd({ id: "c2" })]))).toBe("Epson · two commands · via ZS06");
  });
});

describe("selectedDevice", () => {
  const ac = device([], { device_id: "ac", name: "Air conditioning", kind: "ac" });
  const projector = device([]);
  it("route id wins; unknown id → none", () => {
    expect(selectedDevice([ac, projector], "ac")).toBe(ac);
    expect(selectedDevice([ac, projector], "gone")).toBeUndefined();
  });
  it("without an id: the projector (screenshot 03), else the first", () => {
    expect(selectedDevice([ac, projector], undefined)).toBe(projector);
    expect(selectedDevice([ac], undefined)).toBe(ac);
    expect(selectedDevice([], undefined)).toBeUndefined();
  });
});
```

**Test:** `remote.view.test.ts`: all six S3.E14 stored-code variants (Listening… is T17); "just now" boundary; count green / amber (untested, not captured, no reaction) / grey 0; subtitles incl. empty brand + MCU; count words 0/1/2/14; selection by route id, unknown id, default projector, empty list.

**Verify:** `pnpm --filter @eduscope/kiosk exec vitest run src/features/settings/remote/remote.view.test.ts` → 14 tests pass; then `pnpm verify` → exit 0.

**Commit:** `git add -A && git commit -m "feat(kiosk): remote configuration selectors"`

---

### T16 — Remote selector: BLASTER card (S3.E10, H25)
- [x] done

**Files:** `apps/kiosk/src/features/settings/remote/remote.view.ts`, `apps/kiosk/src/features/settings/remote/remote.view.test.ts`

**Context:** SPEC S3.E10 (dot `ZS06`, `LQI 196`; Topic `r101_ir`; Coverage `360°, 12 m`; `[INFERRED]` offline: red, "Offline · last
seen …"), H25; data `RoomState.ir_blaster` (`online.updated_at` = when the flag last changed). Same output shape as M05's
router headers (`routers.view.ts`): the offline text replaces the LQI.

**Do:**
1. In `apps/kiosk/src/features/settings/remote/remote.view.ts` replace:
```ts
import type { IrCommand, IrDevice, IrTransport } from "@eduscope/contracts";
```
with:
```ts
import type { IrBlaster, IrCommand, IrDevice, IrTransport } from "@eduscope/contracts";
```
2. Append to `apps/kiosk/src/features/settings/remote/remote.view.ts`:
```ts
export interface BlasterView {
  id: string;
  online: boolean;
  /** `LQI 196`, or H25 "Offline · last seen 5 min ago" (red). */
  link: ToneText;
  topic: string;
  coverage: string;
}

/** S3.E10 BLASTER card. Offline = `ir_blaster.online` false (H25). */
export function blasterView(blaster: IrBlaster, now: Date): BlasterView {
  const online = blaster.online.value === true;
  const since = blaster.online.updated_at;
  const link: ToneText = online
    ? { text: blaster.lqi === null ? "LQI —" : `LQI ${blaster.lqi}`, tone: "muted" }
    : { text: since === null ? "Offline" : `Offline · last seen ${formatAgo(since, now)}`, tone: "danger" };
  return { id: blaster.id, online, link, topic: blaster.topic, coverage: blaster.coverage };
}
```
3. In `apps/kiosk/src/features/settings/remote/remote.view.test.ts` replace:
```ts
import { commandCountWords, commandStatus, detailSubtitle, deviceCount, deviceSubtitle, selectedDevice, testedAgo } from "./remote.view";
```
with:
```ts
import {
  blasterView, commandCountWords, commandStatus, detailSubtitle, deviceCount, deviceSubtitle, selectedDevice, testedAgo,
} from "./remote.view";
```
4. Append to `apps/kiosk/src/features/settings/remote/remote.view.test.ts`:
```ts
describe("blasterView (S3.E10, H25)", () => {
  const blaster = {
    id: "ZS06", topic: "r101_ir", lqi: 196, coverage: "360°, 12 m", power: "mains" as const,
    online: { value: true, confidence: "confirmed" as const, source: "ir" as const, updated_at: "2026-10-13T08:55:00Z", stale: false, changed_by: null },
  };
  it("online: LQI", () => {
    expect(blasterView(blaster, NOW)).toEqual({ id: "ZS06", online: true, link: { text: "LQI 196", tone: "muted" }, topic: "r101_ir", coverage: "360°, 12 m" });
  });
  it("offline: red, last seen since the flag changed", () => {
    const offline = { ...blaster, online: { ...blaster.online, value: false } };
    expect(blasterView(offline, NOW).link).toEqual({ text: "Offline · last seen 5 min ago", tone: "danger" });
  });
});
```

**Test:** Appended `describe("blasterView")`: online → `LQI 196` muted; offline → "Offline · last seen 5 min ago" danger.

**Verify:** `pnpm --filter @eduscope/kiosk exec vitest run src/features/settings/remote/remote.view.test.ts` → 16 tests pass; then `pnpm verify` → exit 0.

**Commit:** `git add -A && git commit -m "feat(kiosk): blaster card selector"`

---

### T17 — Command row state machine: capture (H21), test (H22), blaster offline (H25)
- [x] done

**Files:** `apps/kiosk/src/features/settings/remote/command-row.ts`, `apps/kiosk/src/features/settings/remote/command-row.test.ts`

**Context:** SPEC S3.E14 (Test: send code, then ask (R5); Re-learn: capture flow; "Not captured": Test disabled, Re-learn reads
"Learn"), H21 (verbatim "Listening… point the remote at the ZS06 and press the button", 20 s countdown + **Cancel**;
"Captured · now test it" + Test highlighted; "Nothing received" + **Try again**; the old code stays until a capture
succeeds), H22 ("Did the {device} react?" **Yes** / **No**), H25 (Test/Re-learn disabled), R8, H5 (repeat taps ignored),
H6a copy ("Couldn't reach the blaster" / "Command failed"). Decision D6. Two inputs from the server (the `IrCommand`
and its latest `ir_capture` entry, `T6`) and one local state (which request is in flight, whether the question is
open). `commandRowView` is a pure function of both; the hook (T19) only wires it. `formatCountdown`
(`lib/format.ts`) gives `0:18`.

**Do:**
1. Create `apps/kiosk/src/features/settings/remote/command-row.ts`:
```ts
import type { IrCommand, IrTransport } from "@eduscope/contracts";
import type { CaptureEntry } from "@/data/ir/capture-store";
import { formatCountdown } from "@/lib/format";
import { commandStatus, TRANSPORT_LABEL, type ToneText } from "./remote.view";

// One S3.E14 command row: capture flow (H21) + test flow (H22, R5) + blaster offline (H25).
// Server state = the IrCommand and the latest `ir_capture` push. Local state = which request is
// in flight and whether the "Did it react?" question is open. Nothing here changes a value.

export type RowLocal =
  | { kind: "idle" }
  | { kind: "learn_sending" }
  | { kind: "cancel_sending" }
  | { kind: "test_sending" }
  | { kind: "asking" }
  | { kind: "answer_sending"; reacted: boolean };

export type RowAction =
  | { type: "learn" }
  | { type: "cancel" }
  | { type: "test" }
  | { type: "answer"; reacted: boolean }
  /** The request finished (either way); errors are shown by the inline-error store. */
  | { type: "done" }
  /** POST test succeeded: ask the technician. */
  | { type: "test_sent" }
  /** Saving the answer failed: ask again. */
  | { type: "answer_failed" };

export const ROW_IDLE: RowLocal = { kind: "idle" };

export function rowReducer(state: RowLocal, action: RowAction): RowLocal {
  switch (action.type) {
    case "learn":
      return state.kind === "idle" ? { kind: "learn_sending" } : state;
    case "cancel":
      return state.kind === "idle" ? { kind: "cancel_sending" } : state;
    case "test":
      return state.kind === "idle" ? { kind: "test_sending" } : state;
    case "test_sent":
      return state.kind === "test_sending" ? { kind: "asking" } : state;
    case "answer":
      return state.kind === "asking" ? { kind: "answer_sending", reacted: action.reacted } : state;
    case "answer_failed":
      return state.kind === "answer_sending" ? { kind: "asking" } : state;
    case "done":
      return ROW_IDLE;
  }
}

export interface RowContext {
  command: IrCommand;
  capture: CaptureEntry | undefined;
  local: RowLocal;
  deviceName: string;
  transport: IrTransport;
  /** `ir_blaster.online.value`; only ZS06 devices need it (R8). */
  blasterOnline: boolean;
  /** Connection live and the session can write. */
  writable: boolean;
  /** Another row of any device is listening (one blaster, one capture). */
  otherListening: boolean;
  /** Server now. */
  now: Date;
}

export interface RowButton {
  label: string;
  enabled: boolean;
  pending: boolean;
  /** Test right after a capture ("Captured · now test it"). */
  highlighted?: boolean;
}

export type RowActions =
  | { kind: "default"; test: RowButton; learn: RowButton }
  | { kind: "listening"; cancel: RowButton }
  | { kind: "asking"; yes: RowButton; no: RowButton };

export interface RowView {
  status: ToneText;
  /** H21 countdown `0:18` while listening. */
  countdown: string | null;
  /** Second line in the capture cell: "Captured · now test it", "Nothing received", "Did the Projector react?". */
  note: ToneText | null;
  actions: RowActions;
}

/** H21 copy. The MCU fallback has its own receiver `[INFERRED]`. */
export function listeningText(transport: IrTransport): string {
  return `Listening… point the remote at the ${TRANSPORT_LABEL[transport]} and press the button`;
}

export function commandRowView(ctx: RowContext): RowView {
  const { command, capture, local } = ctx;
  const blasterBlocks = ctx.transport === "ir_zs06" && !ctx.blasterOnline; // H25
  const canUseIr = ctx.writable && !blasterBlocks && !ctx.otherListening;
  const stored = commandStatus(command, ctx.now);

  if (capture?.status === "listening") {
    const leftS = capture.deadline === null ? 0 : (Date.parse(capture.deadline) - ctx.now.getTime()) / 1000;
    return {
      status: { text: listeningText(ctx.transport), tone: "default" },
      countdown: formatCountdown(leftS),
      note: null,
      actions: { kind: "listening", cancel: { label: "Cancel", enabled: ctx.writable, pending: local.kind === "cancel_sending" } },
    };
  }

  if (local.kind === "asking" || local.kind === "answer_sending") {
    const sending = local.kind === "answer_sending" ? local.reacted : null;
    return {
      status: stored,
      countdown: null,
      note: { text: `Did the ${ctx.deviceName} react?`, tone: "default" },
      actions: {
        kind: "asking",
        yes: { label: "Yes", enabled: ctx.writable, pending: sending === true },
        no: { label: "No", enabled: ctx.writable, pending: sending === false },
      },
    };
  }

  const note: ToneText | null =
    capture?.status === "captured" ? { text: "Captured · now test it", tone: "accent" }
    : capture?.status === "timeout" ? { text: "Nothing received", tone: "danger" }
    : capture?.status === "failed" ? { text: "Capture failed", tone: "danger" }
    : null;
  const retry = capture?.status === "timeout" || capture?.status === "failed";
  return {
    status: stored,
    countdown: null,
    note,
    actions: {
      kind: "default",
      test: {
        label: "Test",
        enabled: canUseIr && command.captured,
        pending: local.kind === "test_sending",
        highlighted: capture?.status === "captured",
      },
      learn: {
        label: retry ? "Try again" : command.captured ? "Re-learn" : "Learn",
        enabled: canUseIr,
        pending: local.kind === "learn_sending",
      },
    },
  };
}

/** H6a copy for a failed IR request. */
export function irErrorMessage(code: string | null): string {
  return code === "hw_unavailable" ? "Couldn't reach the blaster" : "Command failed";
}
```
2. Create `apps/kiosk/src/features/settings/remote/command-row.test.ts`:
```ts
import type { IrCommand } from "@eduscope/contracts";
import { describe, expect, it } from "vitest";
import { commandRowView, irErrorMessage, ROW_IDLE, rowReducer, type RowContext, type RowLocal } from "./command-row";

const NOW = new Date("2026-10-13T09:00:00Z");
const command = (patch: Partial<IrCommand> = {}): IrCommand => ({
  id: "c1", device_id: "projector", name: "Power on", role: "power_on", setpoint: null, code_format: "tuya",
  captured: true, captured_at: "2026-10-01T09:00:00Z", test: "reacted", tested_at: null, ...patch,
});
const ctx = (patch: Partial<RowContext> = {}): RowContext => ({
  command: command(), capture: undefined, local: ROW_IDLE, deviceName: "Projector", transport: "ir_zs06",
  blasterOnline: true, writable: true, otherListening: false, now: NOW, ...patch,
});

describe("rowReducer (H21/H22 local steps)", () => {
  it("test → asking → answer → done", () => {
    let state: RowLocal = ROW_IDLE;
    state = rowReducer(state, { type: "test" });
    expect(state).toEqual({ kind: "test_sending" });
    state = rowReducer(state, { type: "test_sent" });
    expect(state).toEqual({ kind: "asking" });
    state = rowReducer(state, { type: "answer", reacted: false });
    expect(state).toEqual({ kind: "answer_sending", reacted: false });
    expect(rowReducer(state, { type: "answer_failed" })).toEqual({ kind: "asking" });
    expect(rowReducer(state, { type: "done" })).toEqual(ROW_IDLE);
  });

  it("ignores repeat taps while a request is in flight (H5)", () => {
    const sending: RowLocal = { kind: "learn_sending" };
    expect(rowReducer(sending, { type: "learn" })).toBe(sending);
    expect(rowReducer(sending, { type: "test" })).toBe(sending);
    expect(rowReducer(ROW_IDLE, { type: "answer", reacted: true })).toBe(ROW_IDLE);
    expect(rowReducer(ROW_IDLE, { type: "test_sent" })).toBe(ROW_IDLE);
  });
});

describe("commandRowView", () => {
  it("default: stored status, Test + Re-learn enabled", () => {
    const view = commandRowView(ctx());
    expect(view.status).toEqual({ text: "Tuya code · captured", tone: "muted" });
    expect(view.note).toBeNull();
    expect(view.actions).toEqual({
      kind: "default",
      test: { label: "Test", enabled: true, pending: false, highlighted: false },
      learn: { label: "Re-learn", enabled: true, pending: false },
    });
  });

  it("not captured: Test disabled, the button reads Learn (S3.E14)", () => {
    const view = commandRowView(ctx({ command: command({ captured: false, captured_at: null, test: "untested" }) }));
    expect(view.status).toEqual({ text: "Not captured", tone: "warn" });
    expect(view.actions).toMatchObject({ kind: "default", test: { enabled: false }, learn: { label: "Learn", enabled: true } });
  });

  it("learn in flight: Re-learn pulses", () => {
    expect(commandRowView(ctx({ local: { kind: "learn_sending" } })).actions).toMatchObject({ learn: { pending: true } });
  });

  it("listening: verbatim prompt, 20 s countdown, Cancel only (H21)", () => {
    const view = commandRowView(ctx({ capture: { status: "listening", deadline: "2026-10-13T09:00:18.2Z" } }));
    expect(view.status).toEqual({ text: "Listening… point the remote at the ZS06 and press the button", tone: "default" });
    expect(view.countdown).toBe("0:19");
    expect(view.actions).toEqual({ kind: "listening", cancel: { label: "Cancel", enabled: true, pending: false } });
    const mcu = commandRowView(ctx({ transport: "ir_mcu", capture: { status: "listening", deadline: null } }));
    expect(mcu.status.text).toBe("Listening… point the remote at the MCU and press the button");
    expect(mcu.countdown).toBe("0:00");
  });

  it("captured: amber untested status, 'Captured · now test it', Test highlighted (H21, H20)", () => {
    const view = commandRowView(ctx({ command: command({ test: "untested" }), capture: { status: "captured", deadline: null } }));
    expect(view.status).toEqual({ text: "Tuya code · captured · untested", tone: "warn" });
    expect(view.note).toEqual({ text: "Captured · now test it", tone: "accent" });
    expect(view.actions).toMatchObject({ test: { enabled: true, highlighted: true }, learn: { label: "Re-learn" } });
  });

  it("timeout: old status kept, 'Nothing received', Try again (H21)", () => {
    const view = commandRowView(ctx({ capture: { status: "timeout", deadline: null } }));
    expect(view.status.text).toBe("Tuya code · captured");
    expect(view.note).toEqual({ text: "Nothing received", tone: "danger" });
    expect(view.actions).toMatchObject({ learn: { label: "Try again", enabled: true } });
  });

  it("failed capture reads 'Capture failed' with Try again", () => {
    const view = commandRowView(ctx({ capture: { status: "failed", deadline: null } }));
    expect(view.note).toEqual({ text: "Capture failed", tone: "danger" });
    expect(view.actions).toMatchObject({ learn: { label: "Try again" } });
  });

  it("asking: 'Did the Projector react?' with Yes / No; the chosen answer pulses (H22)", () => {
    expect(commandRowView(ctx({ local: { kind: "asking" } }))).toMatchObject({
      note: { text: "Did the Projector react?", tone: "default" },
      actions: { kind: "asking", yes: { label: "Yes", pending: false }, no: { label: "No", pending: false } },
    });
    expect(commandRowView(ctx({ local: { kind: "answer_sending", reacted: false } })).actions).toMatchObject({
      yes: { pending: false }, no: { pending: true },
    });
  });

  it("no reaction shows red after the answer (H22)", () => {
    const view = commandRowView(ctx({ command: command({ test: "no_reaction", tested_at: "2026-10-13T08:59:59Z" }) }));
    expect(view.status).toEqual({ text: "Tuya code · no reaction", tone: "danger" });
  });

  it("blaster offline disables Test and Re-learn on ZS06 devices only (H25, R8)", () => {
    expect(commandRowView(ctx({ blasterOnline: false })).actions).toMatchObject({ test: { enabled: false }, learn: { enabled: false } });
    expect(commandRowView(ctx({ blasterOnline: false, transport: "ir_mcu" })).actions).toMatchObject({
      test: { enabled: true }, learn: { enabled: true },
    });
  });

  it("disconnected or another row listening disables IR buttons", () => {
    expect(commandRowView(ctx({ writable: false })).actions).toMatchObject({ test: { enabled: false }, learn: { enabled: false } });
    expect(commandRowView(ctx({ otherListening: true })).actions).toMatchObject({ test: { enabled: false }, learn: { enabled: false } });
  });

  it("error copy (H6a)", () => {
    expect(irErrorMessage("hw_unavailable")).toBe("Couldn't reach the blaster");
    expect(irErrorMessage("network")).toBe("Command failed");
  });
});
```

**Test:** `command-row.test.ts`: reducer test→asking→answer→done and answer_failed; repeat taps ignored; views for default, not captured, learn in flight, listening (ZS06 + MCU text, countdown), captured, timeout, failed, asking + chosen answer pulsing, no reaction, blaster offline (ZS06 only), disconnected / another row listening; error copy.

**Verify:** `pnpm --filter @eduscope/kiosk exec vitest run src/features/settings/remote/command-row.test.ts` → 14 tests pass; then `pnpm verify` → exit 0.

**Commit:** `git add -A && git commit -m "feat(kiosk): IR command row state machine"`

---

### T18 — Remote sheet validation: add device, add command
- [x] done

**Files:** `apps/kiosk/src/features/settings/remote/forms.ts`, `apps/kiosk/src/features/settings/remote/forms.test.ts`

**Context:** SPEC S3.E9 (sheet: name, brand, transport "ZS06" / "mcu", kind Projector / Air conditioning / Other → Save; "Validation
inline", §7.1), S3.E16 (sheet: name; for AC: setpoint °C, mode, fan), R4, Q23, Q24. Decisions D14, D15. Validation is
the contract itself (`IrDeviceCreate`, `IrCommandCreate`) mapped to field copy: "Enter a name" / "Enter a brand" /
"40 characters at most". AC rows are named like the seeded ones ("25°"); a non-default mode/fan is spelled out.

**Do:**
1. Create `apps/kiosk/src/features/settings/remote/forms.ts`:
```ts
import { IrCommandCreate, IrDeviceCreate, type IrDeviceKind, type IrSetpoint, type IrTransport } from "@eduscope/contracts";
import type { Choice } from "../shared/ChoiceGroup";
import type { FormResult } from "../shared/form-result";

// S3.E9 "+ Add device" and S3.E16 "+ Add a command" sheets: form → contract input or field errors.

export const TRANSPORT_CHOICES: readonly Choice<IrTransport>[] = [
  { value: "ir_zs06", label: "ZS06" },
  { value: "ir_mcu", label: "MCU" },
];
export const KIND_CHOICES: readonly Choice<IrDeviceKind>[] = [
  { value: "projector", label: "Projector" },
  { value: "ac", label: "Air conditioning" },
  { value: "other", label: "Other" },
];

export interface DeviceForm {
  name: string;
  brand: string;
  transport: IrTransport;
  kind: IrDeviceKind;
}
export const EMPTY_DEVICE_FORM: DeviceForm = { name: "", brand: "", transport: "ir_zs06", kind: "projector" };

const lengthMessage = (field: string, code: string): string => (code === "too_big" ? "40 characters at most" : `Enter a ${field}`);

export function validateDeviceForm(form: DeviceForm): FormResult<IrDeviceCreate, "name" | "brand"> {
  const parsed = IrDeviceCreate.safeParse(form);
  if (parsed.success) return { ok: true, value: parsed.data };
  const errors: Partial<Record<"name" | "brand", string>> = {};
  for (const issue of parsed.error.issues) {
    const field = issue.path[0];
    if ((field === "name" || field === "brand") && errors[field] === undefined) errors[field] = lengthMessage(field, issue.code);
  }
  return { ok: false, errors };
}

/** Q23 / Q24: °C, the range a Panasonic handheld offers `[ASSUMED]`. */
export const AC_TEMP_MIN = 16;
export const AC_TEMP_MAX = 30;
export const AC_MODE_CHOICES: readonly Choice<string>[] = [
  { value: "cool", label: "Cool" },
  { value: "heat", label: "Heat" },
  { value: "dry", label: "Dry" },
  { value: "fan", label: "Fan" },
  { value: "auto", label: "Auto" },
];
export const AC_FAN_CHOICES: readonly Choice<string>[] = [
  { value: "auto", label: "Auto" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];
export const DEFAULT_SETPOINT: IrSetpoint = { temp_c: 24, mode: "cool", fan: "auto" };

/** AC rows are named like the seeded ones ("24°"); a non-default mode or fan is spelled out. */
export function acCommandName(setpoint: IrSetpoint): string {
  const base = `${setpoint.temp_c}°`;
  return setpoint.mode === "cool" && setpoint.fan === "auto" ? base : `${base} · ${setpoint.mode} · ${setpoint.fan}`;
}

export function clampTemp(tempC: number): number {
  return Math.min(AC_TEMP_MAX, Math.max(AC_TEMP_MIN, tempC));
}

/** AC → a setpoint frame (R4); any other device → a named command. */
export function commandInput(kind: IrDeviceKind, name: string, setpoint: IrSetpoint): FormResult<IrCommandCreate, "name"> {
  const candidate: IrCommandCreate =
    kind === "ac" ? { name: acCommandName(setpoint), role: "setpoint", setpoint } : { name, role: "other", setpoint: null };
  const parsed = IrCommandCreate.safeParse(candidate);
  if (parsed.success) return { ok: true, value: parsed.data };
  const issue = parsed.error.issues.find((candidateIssue) => candidateIssue.path[0] === "name");
  return { ok: false, errors: { name: lengthMessage("name", issue?.code ?? "too_small") } };
}
```
2. Create `apps/kiosk/src/features/settings/remote/forms.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { acCommandName, clampTemp, commandInput, EMPTY_DEVICE_FORM, validateDeviceForm } from "./forms";

describe("validateDeviceForm (S3.E9)", () => {
  it("returns the IrDeviceCreate input, trimmed", () => {
    expect(validateDeviceForm({ name: " Screen relay ", brand: "Generic", transport: "ir_mcu", kind: "other" })).toEqual({
      ok: true, value: { name: "Screen relay", brand: "Generic", transport: "ir_mcu", kind: "other" },
    });
  });
  it("names the empty and too-long fields", () => {
    expect(validateDeviceForm(EMPTY_DEVICE_FORM)).toEqual({ ok: false, errors: { name: "Enter a name", brand: "Enter a brand" } });
    expect(validateDeviceForm({ ...EMPTY_DEVICE_FORM, name: "x".repeat(41), brand: "Epson" })).toEqual({
      ok: false, errors: { name: "40 characters at most" },
    });
  });
});

describe("commandInput (S3.E16)", () => {
  it("AC: a setpoint frame named like the seeded rows (AC5: 25 °C / cool / auto)", () => {
    expect(commandInput("ac", "", { temp_c: 25, mode: "cool", fan: "auto" })).toEqual({
      ok: true, value: { name: "25°", role: "setpoint", setpoint: { temp_c: 25, mode: "cool", fan: "auto" } },
    });
    expect(acCommandName({ temp_c: 22, mode: "heat", fan: "low" })).toBe("22° · heat · low");
  });
  it("other devices: a named command; an empty name is refused", () => {
    expect(commandInput("projector", " Freeze ", { temp_c: 24, mode: "cool", fan: "auto" })).toEqual({
      ok: true, value: { name: "Freeze", role: "other", setpoint: null },
    });
    expect(commandInput("other", "  ", { temp_c: 24, mode: "cool", fan: "auto" })).toEqual({ ok: false, errors: { name: "Enter a name" } });
  });
  it("clampTemp keeps 16–30", () => {
    expect([clampTemp(15), clampTemp(25), clampTemp(31)]).toEqual([16, 25, 30]);
  });
});
```

**Test:** `forms.test.ts`: valid device input trimmed; empty / too long fields; AC 25 °C cool auto → `{name:"25°", role:"setpoint"}` (AC5); heat/low name; other device named command; empty name refused; clamp 16–30.

**Verify:** `pnpm --filter @eduscope/kiosk exec vitest run src/features/settings/remote/forms.test.ts` → 5 tests pass; then `pnpm verify` → exit 0.

**Commit:** `git add -A && git commit -m "feat(kiosk): add-device and add-command validation"`

---

### T19 — `useCommandRow` hook
- [ ] done

**Files:** `apps/kiosk/src/features/settings/remote/use-command-row.ts`

**Context:** Wires T17 to the data layer: `api.ir.learn/cancelLearn/test/recordTest` (T5), `irCaptureStore` (T6),
`ir_blaster.online` from `useRoomState`, `useWritable` (T12), `useServerNow` (countdown on server time, S1.E2),
and the existing `inlineErrorStore` (H6a red line for 6 s; key `ir:{commandId}`). Learn/Test dismiss the row's previous
capture outcome (a new attempt replaces "Nothing received"; pressing Test answers "Captured · now test it"). After a
Yes/No the hook waits for the `["ir","devices"]` refetch before closing the question, so the new status never flashes the
old one (CLAUDE.md: server state only). No test: the logic is the reducer/view; this file is plumbing.

**Do:**
1. Create `apps/kiosk/src/features/settings/remote/use-command-row.ts`:
```ts
import type { IrCommand, IrDevice } from "@eduscope/contracts";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useReducer } from "react";
import { ApiRequestError } from "@/data/api-client";
import { useApiClient } from "@/data/api-context";
import { inlineErrorStore } from "@/data/commands/inline-errors";
import { useInlineError, useRoomState } from "@/data/hooks";
import { irCaptureStore } from "@/data/ir/capture-store";
import { queryKeys } from "@/data/query-keys";
import { useServerNow } from "@/lib/server-time";
import { useStore } from "@/lib/store";
import { useWritable } from "../shared/use-writable";
import { commandRowView, irErrorMessage, ROW_IDLE, rowReducer, type RowView } from "./command-row";

const ANSWER_FAILED = "Couldn't save the answer · try again";
const errorCode = (error: unknown): string | null => (error instanceof ApiRequestError ? error.code : null);

/** Wires one S3.E14 row to the API, the capture store and the room state. */
export function useCommandRow(command: IrCommand, device: IrDevice) {
  const api = useApiClient();
  const queryClient = useQueryClient();
  const [local, dispatch] = useReducer(rowReducer, ROW_IDLE);
  const errorKey = `ir:${command.id}`;
  const error = useInlineError(errorKey);
  const capture = useStore(irCaptureStore.entries, (entries) => entries.get(command.id));
  const otherListening = useStore(irCaptureStore.entries, (entries) =>
    [...entries].some(([id, entry]) => id !== command.id && entry.status === "listening"),
  );
  const blasterOnline = useRoomState((state) => state.ir_blaster.online.value === true) ?? false;
  const writable = useWritable();
  const now = useServerNow() ?? new Date();

  const view: RowView = commandRowView({
    command, capture, local, deviceName: device.name, transport: device.transport, blasterOnline, writable, otherListening, now,
  });

  const fail = useCallback((caught: unknown) => inlineErrorStore.show(errorKey, irErrorMessage(errorCode(caught))), [errorKey]);
  const idle = local.kind === "idle";

  const learn = useCallback(async () => {
    if (!idle) return;
    dispatch({ type: "learn" });
    inlineErrorStore.dismiss(errorKey);
    irCaptureStore.dismiss(command.id); // a new attempt replaces "Nothing received"
    try {
      await api.ir.learn(command.id); // progress arrives as `ir_capture` pushes
    } catch (caught) {
      fail(caught);
    }
    dispatch({ type: "done" });
  }, [idle, api, command.id, errorKey, fail]);

  const cancel = useCallback(async () => {
    if (!idle) return;
    dispatch({ type: "cancel" });
    try {
      await api.ir.cancelLearn(command.id);
    } catch (caught) {
      fail(caught);
    }
    dispatch({ type: "done" });
  }, [idle, api, command.id, fail]);

  const test = useCallback(async () => {
    if (!idle) return;
    dispatch({ type: "test" });
    inlineErrorStore.dismiss(errorKey);
    irCaptureStore.dismiss(command.id); // "Captured · now test it" has been answered
    try {
      await api.ir.test(command.id);
      dispatch({ type: "test_sent" });
    } catch (caught) {
      fail(caught);
      dispatch({ type: "done" });
    }
  }, [idle, api, command.id, errorKey, fail]);

  const answer = useCallback(
    async (reacted: boolean) => {
      if (local.kind !== "asking") return;
      dispatch({ type: "answer", reacted });
      try {
        await api.ir.recordTest(command.id, reacted);
        await queryClient.invalidateQueries({ queryKey: queryKeys.irDevices() }); // show the server's new status first
        dispatch({ type: "done" });
      } catch {
        inlineErrorStore.show(errorKey, ANSWER_FAILED);
        dispatch({ type: "answer_failed" });
      }
    },
    [local.kind, api, command.id, errorKey, queryClient],
  );

  return { view, error, learn, cancel, test, answer };
}
```

**Verify:** `pnpm verify` → exit 0.

**Commit:** `git add -A && git commit -m "feat(kiosk): command row hook"`

---

### T20 — `CommandRow` (S3.E14/E15)
- [ ] done

**Files:** `apps/kiosk/src/features/settings/remote/CommandRow.tsx`

**Context:** Screenshot 03 right column, the "Power on" / "Power off" rows: name (16 semibold) · capture status (mono 12, text-2) ·
**Test** · **Re-learn** (48px bordered buttons). SPEC §2.2 S3 phone ("line 1 is name + capture status; line 2 is Test
and Re-learn at half width each (≥48px tall)"). Reuse `CommandButton` (pending pulse H5, disabled 40%,
`active="confirmed"` = the highlighted Test after a capture), `InlineError`, `VALUE_TONE_CLASS`.

**States:** default (stored status + Test/Re-learn) · not captured (amber "Not captured", Test disabled, "Learn") · learn/test in flight (button pulses) · listening (verbatim H21 text + `0:18`, only **Cancel**) · captured (amber untested status + green "Captured · now test it", Test highlighted) · timeout ("Nothing received" red + **Try again**) · asking ("Did the Projector react?" + **Yes**/**No**) · tested ("Tuya code · tested ✓ just now") · no reaction (red) · blaster offline / disconnected / another row listening (buttons disabled) · request failed (red inline line, 6 s).

**Layout:** `<600`: `grid grid-cols-[auto_minmax(0,1fr)]` → line 1 name + right-aligned status; line 2 `col-span-2 grid grid-cols-2 gap-2` buttons `w-full h-12` (Cancel spans both). `sm:` one line `grid-cols-[minmax(0,2fr)_minmax(0,3fr)_12.5rem]`, status left-aligned, buttons `sm:flex sm:justify-end sm:w-auto sm:min-w-20`. Row `bg-surface-2 border-t border-border px-4 py-3`.

**Do:**
1. Create `apps/kiosk/src/features/settings/remote/CommandRow.tsx`:
```tsx
import type { IrCommand, IrDevice } from "@eduscope/contracts";
import { CommandButton } from "@/components/CommandButton";
import { InlineError } from "@/components/InlineError";
import { VALUE_TONE_CLASS } from "@/components/state-styles";
import { cn } from "@/lib/utils";
import type { RowButton } from "./command-row";
import { useCommandRow } from "./use-command-row";

function RowAction({ button, onPress, className }: { button: RowButton; onPress: () => void; className?: string }) {
  return (
    <CommandButton
      label={button.label}
      onPress={onPress}
      pending={button.pending}
      disabled={!button.enabled}
      active={button.highlighted === true ? "confirmed" : null}
      className={cn("w-full sm:w-auto sm:min-w-20", className)}
    />
  );
}

/**
 * S3.E14/E15. ≥600: name | capture | buttons on one line (screenshot 03). <600: line 1 name +
 * capture, line 2 the buttons at half width each, 48px (SPEC §2.2 S3).
 */
export function CommandRow({ command, device }: { command: IrCommand; device: IrDevice }) {
  const { view, error, learn, cancel, test, answer } = useCommandRow(command, device);
  const { actions } = view;
  return (
    <li className="border-t border-border bg-surface-2 px-4 py-3">
      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)_12.5rem]">
        <span className="text-card-title font-semibold text-text-1">{command.name}</span>
        <div className="flex min-w-0 flex-col gap-1 text-right sm:text-left">
          <span className={cn("font-mono text-caption", VALUE_TONE_CLASS[view.status.tone])}>
            {view.status.text}
            {view.countdown !== null && <span className="ml-2 whitespace-nowrap text-text-1">{view.countdown}</span>}
          </span>
          {view.note !== null && <span className={cn("text-caption font-semibold", VALUE_TONE_CLASS[view.note.tone])}>{view.note.text}</span>}
        </div>
        <div className="col-span-2 grid grid-cols-2 gap-2 sm:col-span-1 sm:flex sm:justify-end">
          {actions.kind === "default" && (
            <>
              <RowAction button={actions.test} onPress={() => void test()} />
              <RowAction button={actions.learn} onPress={() => void learn()} />
            </>
          )}
          {actions.kind === "listening" && <RowAction button={actions.cancel} onPress={() => void cancel()} className="col-span-2" />}
          {actions.kind === "asking" && (
            <>
              <RowAction button={actions.yes} onPress={() => void answer(true)} />
              <RowAction button={actions.no} onPress={() => void answer(false)} />
            </>
          )}
        </div>
      </div>
      <InlineError message={error} className="mt-2" />
    </li>
  );
}
```

**Verify:** `pnpm verify` → exit 0 (rendered in T27).

**Commit:** `git add -A && git commit -m "feat(kiosk): IR command row"`

---

### T21 — `DeviceList` (S3.E6–E8)
- [ ] done

**Files:** `apps/kiosk/src/features/settings/remote/DeviceList.tsx`

**Context:** Screenshot 03 left column: items "Air conditioning" / "Panasonic · via ZS06" / `14` and "Projector" / "Epson · via ZS06" /
`2` (selected: teal `selected-fill` + green 2px border). SPEC §3.4 "Selected (choice)". Count colour from `deviceCount`
(T15). Items are buttons (≥64px), pressed on touch-down.

**States:** selected (`border-accent-border bg-selected-fill`), unselected (`border-border bg-surface`), pressed (brightness), count green / amber / grey.

**Layout:** Full width of its column at every width; `min-h-16 rounded-card border-2 px-4 py-3`; name and subtitle truncate, the count stays right (`font-mono text-button`).

**Do:**
1. Create `apps/kiosk/src/features/settings/remote/DeviceList.tsx`:
```tsx
import type { IrDevice } from "@eduscope/contracts";
import { VALUE_TONE_CLASS } from "@/components/state-styles";
import { usePressed } from "@/lib/use-pressed";
import { cn } from "@/lib/utils";
import { deviceCount, deviceSubtitle } from "./remote.view";

function DeviceItem({ device, selected, onSelect }: { device: IrDevice; selected: boolean; onSelect: () => void }) {
  const pressed = usePressed();
  const count = deviceCount(device);
  return (
    <button
      type="button"
      aria-current={selected ? "true" : undefined}
      {...pressed}
      onClick={onSelect}
      className={cn(
        "flex min-h-16 w-full items-center gap-3 rounded-card border-2 px-4 py-3 text-left",
        "transition-[filter] active:brightness-125 data-[pressed=true]:brightness-125",
        selected ? "border-accent-border bg-selected-fill" : "border-border bg-surface",
      )}
    >
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-card-title font-semibold text-text-1">{device.name}</span>
        <span className="truncate text-caption text-text-2">{deviceSubtitle(device)}</span>
      </span>
      <span className={cn("font-mono text-button font-semibold", VALUE_TONE_CLASS[count.tone])} aria-label={`${count.text} captured`}>
        {count.text}
      </span>
    </button>
  );
}

/** S3.E7/E8: one item per IR device; the selected one in `selected-fill` + green border (lg only). */
export function DeviceList({ devices, selectedId, onSelect }: {
  devices: readonly IrDevice[];
  /** `null` on the phone list view (nothing is open). */
  selectedId: string | null;
  onSelect: (deviceId: string) => void;
}) {
  return (
    <ul className="flex flex-col gap-3">
      {devices.map((device) => (
        <li key={device.device_id}>
          <DeviceItem device={device} selected={device.device_id === selectedId} onSelect={() => onSelect(device.device_id)} />
        </li>
      ))}
    </ul>
  );
}
```

**Verify:** `pnpm verify` → exit 0 (rendered in T28).

**Commit:** `git add -A && git commit -m "feat(kiosk): IR device list"`

---

### T22 — `BlasterCard` (S3.E10)
- [ ] done

**Files:** `apps/kiosk/src/features/settings/remote/BlasterCard.tsx`

**Context:** Screenshot 03 left column "BLASTER" card: green dot `ZS06` · `LQI 196`; Topic `r101_ir`; Coverage `360°, 12 m`; caption
"Mains powered, so it also routes for the battery sensors." Reuse `Card` (variant `danger` = red 40% border when offline),
`SectionLabel`, `StateDot` (`confirmed` / `offline`), `KeyValueRow` (mono values right), `blasterView` (T16).

**States:** loading (skeleton, H1), online (green dot, LQI text-2), offline H25 (red dot, "Offline · last seen 5 min ago" red, red card border).

**Layout:** Same at every width (left column at lg, below the device list on phone).

**Do:**
1. Create `apps/kiosk/src/features/settings/remote/BlasterCard.tsx`:
```tsx
import { Card } from "@/components/Card";
import { KeyValueRow } from "@/components/KeyValueRow";
import { SectionLabel } from "@/components/SectionLabel";
import { StateDot } from "@/components/StateDot";
import { VALUE_TONE_CLASS } from "@/components/state-styles";
import { useRoomState } from "@/data/hooks";
import { useServerNow } from "@/lib/server-time";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/ui/skeleton";
import { blasterView } from "./remote.view";

/** S3.E10. Online: green dot, `LQI 196`. Offline (H25): red dot + "Offline · last seen …", red card border. */
export function BlasterCard() {
  const blaster = useRoomState((state) => state.ir_blaster);
  const now = useServerNow();
  const view = blaster === undefined || now === null ? null : blasterView(blaster, now);
  return (
    <Card variant={view !== null && !view.online ? "danger" : "solid"} className="flex flex-col gap-2">
      <SectionLabel>Blaster</SectionLabel>
      {view === null ? (
        <Skeleton className="h-20 w-full" />
      ) : (
        <>
          <div className="flex min-h-8 items-center gap-2">
            <StateDot tone={view.online ? "confirmed" : "offline"} />
            <span className="flex-1 text-card-title text-text-1">{view.id}</span>
            <span className={cn("font-mono text-caption", VALUE_TONE_CLASS[view.link.tone])}>{view.link.text}</span>
          </div>
          <KeyValueRow label="Topic" value={view.topic} />
          <KeyValueRow label="Coverage" value={view.coverage} />
          <p className="text-caption text-text-2">Mains powered, so it also routes for the battery sensors.</p>
        </>
      )}
    </Card>
  );
}
```

**Verify:** `pnpm verify` → exit 0.

**Commit:** `git add -A && git commit -m "feat(kiosk): blaster card"`

---

### T23 — `FallbackCard` (S3.E11)
- [ ] done

**Files:** `apps/kiosk/src/features/settings/remote/FallbackCard.tsx`

**Context:** Screenshot 03 left column "FALLBACK" card; SPEC S3.E11 static text (verbatim), R8.

**States:** static (no states).

**Layout:** Same at every width.

**Do:**
1. Create `apps/kiosk/src/features/settings/remote/FallbackCard.tsx`:
```tsx
import { Card } from "@/components/Card";
import { SectionLabel } from "@/components/SectionLabel";

/** S3.E11 (static, R8). */
export function FallbackCard() {
  return (
    <Card className="flex flex-col gap-2">
      <SectionLabel>Fallback</SectionLabel>
      <p className="text-caption text-text-2">
        The ESP32 emitter heads on GPIO 16 and 17 stay wired. Switch a device to them by setting its transport to mcu in
        the room config.
      </p>
    </Card>
  );
}
```

**Verify:** `pnpm verify` → exit 0.

**Commit:** `git add -A && git commit -m "feat(kiosk): fallback card"`

---

### T24 — `HowCaptureWorks` (S3.E17)
- [ ] done

**Files:** `apps/kiosk/src/features/settings/remote/HowCaptureWorks.tsx`

**Context:** Screenshot 03 right column "HOW CAPTURE WORKS"; SPEC S3.E17 copy **verbatim** (two `text-1` paragraphs, the third
`text-2` smaller), §2.2 S3 phone ("collapsed to its first sentence with 'More'"). The first sentence is "An
air-conditioning remote does not send “temperature up”." (typographic quotes, as in SPEC).

**States:** phone collapsed (first sentence + **More**), phone expanded (all three paragraphs, no button), ≥600 always expanded.

**Layout:** `<600`: the rest of paragraph 1 and paragraphs 2–3 are `hidden` until More; More `sm:hidden h-12 min-w-12`. `sm:` everything shown (`sm:inline` / `sm:block`).

**Do:**
1. Create `apps/kiosk/src/features/settings/remote/HowCaptureWorks.tsx`:
```tsx
import { useState } from "react";
import { Card } from "@/components/Card";
import { SectionLabel } from "@/components/SectionLabel";
import { cn } from "@/lib/utils";

/** S3.E17, copy verbatim. Phone: the first sentence + "More" (SPEC §2.2); ≥600 always in full. */
export function HowCaptureWorks() {
  const [expanded, setExpanded] = useState(false);
  const rest = cn(expanded ? "inline" : "hidden", "sm:inline");
  const block = cn(expanded ? "block" : "hidden", "sm:block");
  return (
    <Card className="flex flex-col gap-3">
      <SectionLabel>How capture works</SectionLabel>
      <p className="text-button text-text-1">
        An air-conditioning remote does not send “temperature up”.
        <span className={rest}>
          {" "}
          It sends a complete state frame carrying power, mode, temperature and fan speed together. Set the handheld
          remote to exactly the state you want, then press any button — whatever is captured reproduces that whole state.
        </span>
      </p>
      <p className={cn("text-button text-text-1", block)}>
        That is why each setpoint is a separate entry rather than a plus and minus pair. The projector needs only two.
      </p>
      <p className={cn("text-caption text-text-2", block)}>
        Test every code the moment you capture it. The same button can return a different string each time, so comparing
        text proves nothing — only the hardware reacting does.
      </p>
      {!expanded && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="flex h-12 min-w-12 items-center self-start text-button font-semibold text-text-2 active:text-text-1 sm:hidden"
        >
          More
        </button>
      )}
    </Card>
  );
}
```

**Verify:** `pnpm verify` → exit 0.

**Commit:** `git add -A && git commit -m "feat(kiosk): how capture works card"`

---

### T25 — `AddDeviceSheet` (S3.E9)
- [ ] done

**Files:** `apps/kiosk/src/features/settings/remote/AddDeviceSheet.tsx`

**Context:** SPEC S3.E9 sheet; §7.1 ("+ Add device" → appears in list; validation inline); AC5. Reuse `SettingsSheet`,
`TextField`, `ChoiceGroup`, `SheetActions` (T9–T10), `validateDeviceForm` + choices (T18),
`useServerMutation` (T7: pending until `["ir","devices"]` and `["devices"]` refetched). Errors show only after the
first Save. On success the sheet closes and the new device opens (`/settings/remote/:id`).

**States:** empty (defaults ZS06 / Projector), invalid after Save ("Enter a name" / "Enter a brand" under the fields), saving (Save pulses), failed ("Couldn't save · try again"), offline (Save disabled).

**Layout:** Bottom sheet `<lg`, right sheet `lg:` (SettingsSheet). Transport `ChoiceGroup columns={2}`, Kind 3 columns.

**Do:**
1. Create `apps/kiosk/src/features/settings/remote/AddDeviceSheet.tsx`:
```tsx
import type { IrDeviceCreate } from "@eduscope/contracts";
import { useState } from "react";
import { useNavigate } from "react-router";
import { queryKeys } from "@/data/query-keys";
import { useServerMutation } from "@/data/settings/hooks";
import { ChoiceGroup } from "../shared/ChoiceGroup";
import { SettingsSheet } from "../shared/SettingsSheet";
import { SheetActions } from "../shared/SheetActions";
import { TextField } from "../shared/TextField";
import { useWritable } from "../shared/use-writable";
import { EMPTY_DEVICE_FORM, KIND_CHOICES, TRANSPORT_CHOICES, validateDeviceForm, type DeviceForm } from "./forms";

/** S3.E9 sheet: name, brand, transport (ZS06 / MCU), kind → Save; the new device opens. */
export function AddDeviceSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [form, setForm] = useState<DeviceForm>(EMPTY_DEVICE_FORM);
  const [showErrors, setShowErrors] = useState(false);
  const navigate = useNavigate();
  const writable = useWritable();
  const create = useServerMutation((api, input: IrDeviceCreate) => api.ir.createDevice(input), [queryKeys.irDevices(), queryKeys.devices()]);
  const result = validateDeviceForm(form);
  const errors = showErrors && !result.ok ? result.errors : {};

  const close = (): void => {
    onOpenChange(false);
    setForm(EMPTY_DEVICE_FORM);
    setShowErrors(false);
    create.reset();
  };
  const save = (): void => {
    if (!result.ok) {
      setShowErrors(true);
      return;
    }
    create.mutate(result.value, {
      onSuccess: (device) => {
        close();
        void navigate(`/settings/remote/${encodeURIComponent(device.device_id)}`);
      },
    });
  };

  return (
    <SettingsSheet open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())} title="Add device">
      <TextField label="Name" value={form.name} error={errors.name ?? null} onChange={(name) => setForm({ ...form, name })} />
      <TextField label="Brand" value={form.brand} error={errors.brand ?? null} onChange={(brand) => setForm({ ...form, brand })} />
      <ChoiceGroup label="Transport" columns={2} options={TRANSPORT_CHOICES} value={form.transport} onChange={(transport) => setForm({ ...form, transport })} />
      <ChoiceGroup label="Kind" options={KIND_CHOICES} value={form.kind} onChange={(kind) => setForm({ ...form, kind })} />
      <SheetActions
        onCancel={close}
        onSave={save}
        pending={create.isPending}
        disabled={!writable}
        error={create.isError ? "Couldn't save · try again" : null}
      />
    </SettingsSheet>
  );
}
```

**Verify:** `pnpm verify` → exit 0 (opened from T28).

**Commit:** `git add -A && git commit -m "feat(kiosk): add device sheet"`

---

### T26 — `AddCommandSheet` (S3.E16)
- [ ] done

**Files:** `apps/kiosk/src/features/settings/remote/AddCommandSheet.tsx`

**Context:** SPEC S3.E16 ("Sheet: name (for AC: setpoint °C, mode, fan) → creates the row → starts the capture flow"), §7.1
("Create the command, then learn"), R4, AC5. Decision D16: Save = `createCommand` then `learn`; a refused learn (e.g.
blaster offline) leaves the row "Not captured" with **Learn**. Reuse the shared sheet pieces, `CommandButton` for the
−/+ stepper (disabled at 16/30, H19-style), `commandInput` / `acCommandName` (T18). The description shows the
row name the AC frame will get ("Saves as “25°”, then listens for the remote.").

**States:** AC (stepper + Mode + Fan, default 24 °C / Cool / Auto), other devices (Name field; "Enter a name" after Save), −/+ disabled at the bounds, saving (Save pulses), failed (red line), offline (Save disabled).

**Layout:** Bottom sheet `<lg`, right sheet `lg:`. Stepper `grid grid-cols-[3rem_1fr_3rem]`; Mode 3 columns, Fan 4 columns.

**Do:**
1. Create `apps/kiosk/src/features/settings/remote/AddCommandSheet.tsx`:
```tsx
import type { IrCommandCreate, IrDevice, IrSetpoint } from "@eduscope/contracts";
import { useState } from "react";
import { CommandButton } from "@/components/CommandButton";
import { queryKeys } from "@/data/query-keys";
import { useServerMutation } from "@/data/settings/hooks";
import { ChoiceGroup } from "../shared/ChoiceGroup";
import { SettingsSheet } from "../shared/SettingsSheet";
import { SheetActions } from "../shared/SheetActions";
import { TextField } from "../shared/TextField";
import { useWritable } from "../shared/use-writable";
import {
  AC_FAN_CHOICES, AC_MODE_CHOICES, AC_TEMP_MAX, AC_TEMP_MIN, acCommandName, clampTemp, commandInput, DEFAULT_SETPOINT,
} from "./forms";

/** −  25°  + for the AC setpoint (same shape as S1's AC row, 48px keys). */
function TempStepper({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-caption font-semibold text-text-2">Setpoint</span>
      <div className="grid grid-cols-[3rem_1fr_3rem] items-center gap-2">
        <CommandButton label="−" disabled={value <= AC_TEMP_MIN} onPress={() => onChange(clampTemp(value - 1))} />
        <span className="text-center font-mono text-value font-semibold text-text-1" aria-live="polite">
          {value} °C
        </span>
        <CommandButton label="+" disabled={value >= AC_TEMP_MAX} onPress={() => onChange(clampTemp(value + 1))} />
      </div>
    </div>
  );
}

/**
 * S3.E16 sheet. AC: setpoint °C, mode, fan (the row is named "25°"); other devices: a name.
 * Save creates the row ("Not captured") and starts its capture (H21).
 */
export function AddCommandSheet({ device, open, onOpenChange }: { device: IrDevice; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [name, setName] = useState("");
  const [setpoint, setSetpoint] = useState<IrSetpoint>(DEFAULT_SETPOINT);
  const [showErrors, setShowErrors] = useState(false);
  const writable = useWritable();
  const create = useServerMutation(async (api, input: IrCommandCreate) => {
    const command = await api.ir.createCommand(device.device_id, input);
    await api.ir.learn(command.id).catch(() => undefined); // a refused capture leaves the row "Not captured" with Learn
    return command;
  }, [queryKeys.irDevices()]);
  const result = commandInput(device.kind, name, setpoint);
  const nameError = showErrors && !result.ok ? (result.errors.name ?? null) : null;
  const isAc = device.kind === "ac";

  const close = (): void => {
    onOpenChange(false);
    setName("");
    setSetpoint(DEFAULT_SETPOINT);
    setShowErrors(false);
    create.reset();
  };
  const save = (): void => {
    if (!result.ok) {
      setShowErrors(true);
      return;
    }
    create.mutate(result.value, { onSuccess: close });
  };

  return (
    <SettingsSheet
      open={open}
      onOpenChange={(next) => (next ? onOpenChange(true) : close())}
      title={`Add a command · ${device.name}`}
      description={isAc ? `Saves as “${acCommandName(setpoint)}”, then listens for the remote.` : "Saves the command, then listens for the remote."}
    >
      {isAc ? (
        <>
          <TempStepper value={setpoint.temp_c} onChange={(temp_c) => setSetpoint({ ...setpoint, temp_c })} />
          <ChoiceGroup label="Mode" columns={3} options={AC_MODE_CHOICES} value={setpoint.mode} onChange={(mode) => setSetpoint({ ...setpoint, mode })} />
          <ChoiceGroup label="Fan" columns={4} options={AC_FAN_CHOICES} value={setpoint.fan} onChange={(fan) => setSetpoint({ ...setpoint, fan })} />
        </>
      ) : (
        <TextField label="Name" value={name} error={nameError} onChange={setName} />
      )}
      <SheetActions
        saveLabel="Save and learn"
        onCancel={close}
        onSave={save}
        pending={create.isPending}
        disabled={!writable}
        error={create.isError ? "Couldn't save · try again" : null}
      />
    </SettingsSheet>
  );
}
```

**Verify:** `pnpm verify` → exit 0 (opened from T27).

**Commit:** `git add -A && git commit -m "feat(kiosk): add command sheet"`

---

### T27 — `DeviceDetail`: right column (S3.E12–E17)
- [ ] done

**Files:** `apps/kiosk/src/features/settings/remote/DeviceDetail.tsx`

**Context:** Screenshot 03 right column: "Projector" (22 bold) + right-aligned "Epson · two commands · via ZS06"; table card with
header "COMMAND" · "CAPTURE" and the rows; dashed "+ Add a command"; HOW CAPTURE WORKS. SPEC §2.2 S3 phone (detail view
with a back arrow; SPEC does not name it — decision D13: "← All devices", `lg:hidden`). H25: "+ Add a command" is
disabled while a ZS06 device's blaster is offline (the capture could not start). Reuse `DashedAddButton` (`h-14`),
`CommandRow`, `AddCommandSheet`, `HowCaptureWorks`, `detailSubtitle`.

**States:** commands listed; no commands ("No commands yet" text-2 in a `surface-2` row); add disabled (offline / blaster offline).

**Layout:** `<600`: title and subtitle stacked, table header hidden (rows are two-line). `sm:` title left, subtitle right on one baseline (`sm:flex-row sm:justify-between`), header row `sm:grid` with the same `grid-cols-[minmax(0,2fr)_minmax(0,3fr)_12.5rem]` as the rows. Back link only below `lg`.

**Do:**
1. Create `apps/kiosk/src/features/settings/remote/DeviceDetail.tsx`:
```tsx
import type { IrDevice } from "@eduscope/contracts";
import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { DashedAddButton } from "@/components/DashedAddButton";
import { useRoomState } from "@/data/hooks";
import { usePressed } from "@/lib/use-pressed";
import { useWritable } from "../shared/use-writable";
import { AddCommandSheet } from "./AddCommandSheet";
import { CommandRow } from "./CommandRow";
import { HowCaptureWorks } from "./HowCaptureWorks";
import { detailSubtitle } from "./remote.view";

function BackToList() {
  const pressed = usePressed();
  return (
    <Link
      to="/settings/remote"
      {...pressed}
      className="flex h-12 items-center gap-2 self-start rounded-btn border border-border-strong bg-control px-3 text-button font-semibold text-text-1 active:brightness-125 data-[pressed=true]:brightness-125 lg:hidden"
    >
      <ArrowLeft aria-hidden="true" className="size-5" />
      All devices
    </Link>
  );
}

/** S3.E12–E17: the right column (lg) or the phone detail view (with the back arrow). */
export function DeviceDetail({ device }: { device: IrDevice }) {
  const [adding, setAdding] = useState(false);
  const writable = useWritable();
  const blasterOnline = useRoomState((state) => state.ir_blaster.online.value === true) ?? false;
  const blasterBlocks = device.transport === "ir_zs06" && !blasterOnline; // H25
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <BackToList />
      <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
        <h2 className="text-title font-bold text-text-1">{device.name}</h2>
        <p className="text-caption text-text-2">{detailSubtitle(device)}</p>
      </div>
      <section className="overflow-hidden rounded-card border border-border bg-surface">
        <div className="hidden h-12 grid-cols-[minmax(0,2fr)_minmax(0,3fr)_12.5rem] items-center gap-4 px-4 sm:grid">
          <span className="text-section font-bold uppercase text-text-2">Command</span>
          <span className="text-section font-bold uppercase text-text-2">Capture</span>
          <span />
        </div>
        {device.commands.length === 0 ? (
          <p className="border-t border-border bg-surface-2 px-4 py-4 text-caption text-text-2">No commands yet</p>
        ) : (
          <ul>
            {device.commands.map((command) => (
              <CommandRow key={command.id} command={command} device={device} />
            ))}
          </ul>
        )}
      </section>
      <DashedAddButton label="Add a command" disabled={!writable || blasterBlocks} onPress={() => setAdding(true)} className="h-14" />
      <HowCaptureWorks />
      <AddCommandSheet key={device.device_id} device={device} open={adding} onOpenChange={setAdding} />
    </div>
  );
}
```

**Verify:** `pnpm verify` → exit 0 (rendered in T28).

**Commit:** `git add -A && git commit -m "feat(kiosk): IR device detail column"`

---

### T28 — `RemoteTab`: master → detail, wired into Settings
- [ ] done

**Files:** `apps/kiosk/src/features/settings/remote/RemoteTab.tsx`, `apps/kiosk/src/features/settings/SettingsPage.tsx`

**Context:** Screenshot 03 body: left column ~22% (DEVICE label, list, dashed "+ Add device", BLASTER, FALLBACK), right column
the selected device. ARCHITECTURE §4.1 (`lg:grid-cols-[22%_1fr]`; phone master → detail through the route:
`/settings/remote` = list, `/settings/remote/:deviceId` = commands; at `lg` both panes for either route). SPEC §2.2 S3
phone ("+ Add device, BLASTER and FALLBACK sit below the device list"). Decision D9 (no id at lg → Projector; an unknown
id → `/settings/remote`, e.g. after a remove in S3d). `useIrDevices` (T7) does not run until technician.

**States:** loading (2 skeleton rows), load failed ("Couldn't load devices" + Retry), list, selected device, phone list view (nothing highlighted), phone detail view, add disabled while offline.

**Layout:** `grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,22%)_minmax(0,1fr)]`. Below `lg`: route without id → only the left pane (`flex`, right pane `hidden lg:block`); with id → only the right pane (left `hidden lg:flex`). Dashed add buttons `h-14`.

**Do:**
1. Create `apps/kiosk/src/features/settings/remote/RemoteTab.tsx`:
```tsx
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { DashedAddButton } from "@/components/DashedAddButton";
import { SectionLabel } from "@/components/SectionLabel";
import { useIrDevices } from "@/data/settings/hooks";
import { LG_QUERY, useMediaQuery } from "@/lib/use-media-query";
import { cn } from "@/lib/utils";
import { QueryStatus } from "../shared/QueryStatus";
import { useWritable } from "../shared/use-writable";
import { AddDeviceSheet } from "./AddDeviceSheet";
import { BlasterCard } from "./BlasterCard";
import { DeviceDetail } from "./DeviceDetail";
import { DeviceList } from "./DeviceList";
import { FallbackCard } from "./FallbackCard";
import { selectedDevice } from "./remote.view";

/**
 * S3 Remote configuration. lg: left column (~22%) + right column, either route. Below lg:
 * master → detail through the route (`/settings/remote` = list, `/settings/remote/:deviceId` = commands).
 */
export function RemoteTab() {
  const { deviceId } = useParams();
  const navigate = useNavigate();
  const query = useIrDevices();
  const writable = useWritable();
  const [adding, setAdding] = useState(false);
  const wide = useMediaQuery(LG_QUERY);
  const devices = query.data;
  const selected = devices === undefined ? undefined : selectedDevice(devices, deviceId);

  // A device that no longer exists (removed in S3d, or a typed URL) → back to the list.
  useEffect(() => {
    if (devices !== undefined && deviceId !== undefined && selected === undefined) {
      void navigate("/settings/remote", { replace: true });
    }
  }, [devices, deviceId, selected, navigate]);

  const showDetail = deviceId !== undefined; // below lg only one view shows
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,22%)_minmax(0,1fr)]">
      <div className={cn("flex-col gap-3", showDetail ? "hidden lg:flex" : "flex")}>
        <SectionLabel>Device</SectionLabel>
        {devices === undefined ? (
          <QueryStatus status={query.isError ? "error" : "pending"} what="devices" onRetry={() => void query.refetch()} rows={2} />
        ) : (
          <DeviceList
            devices={devices}
            selectedId={wide || deviceId !== undefined ? (selected?.device_id ?? null) : null}
            onSelect={(id) => void navigate(`/settings/remote/${encodeURIComponent(id)}`)}
          />
        )}
        <DashedAddButton label="Add device" disabled={!writable} onPress={() => setAdding(true)} className="h-14" />
        <BlasterCard />
        <FallbackCard />
      </div>
      <div className={cn("min-w-0", showDetail ? "block" : "hidden lg:block")}>
        {selected !== undefined && <DeviceDetail device={selected} />}
      </div>
      <AddDeviceSheet open={adding} onOpenChange={setAdding} />
    </div>
  );
}
```
2. In `apps/kiosk/src/features/settings/SettingsPage.tsx` replace:
```tsx
import { PlaceholderPage } from "@/components/PlaceholderPage";
```
with:
```tsx
import { PlaceholderPage } from "@/components/PlaceholderPage";
import { RemoteTab } from "./remote/RemoteTab";
```
3. In `apps/kiosk/src/features/settings/SettingsPage.tsx` replace:
```tsx
      return <PlaceholderPage title="Remote configuration" spec="S3" milestone="M06" />;
```
with:
```tsx
      return <RemoteTab />;
```

**Verify:** `pnpm verify` → exit 0. Then the Checkpoint listed for this task.

**Commit:** `git add -A && git commit -m "feat(kiosk): remote configuration tab"`

---

### T29 — Mock panel: "Next capture: nothing received"
- [ ] done

**Files:** `apps/kiosk/src/app/dev/MockPanel.tsx`

**Context:** Milestone scope ("learn … times out via panel"), AC3 (Panel "nothing received"), AC4 (Panel "blaster offline" = the
existing "Toggle blaster offline"), AC9 (the existing "Expire session"). Decision D4.

**Do:**
1. In `apps/kiosk/src/app/dev/MockPanel.tsx` replace:
```tsx
  { label: "Toggle interlock bypassed", run: () => fakeRoom.toggleInterlockBypassed() },
];
```
with:
```tsx
  { label: "Toggle interlock bypassed", run: () => fakeRoom.toggleInterlockBypassed() },
  // M06: S3 capture outcome (H21). Blaster offline (H25) = "Toggle blaster offline"; losing technician = "Expire session".
  { label: "Next capture: nothing received", run: () => fakeRoom.ir.captureNothingNext() },
];
```

**Verify:** `pnpm verify` → exit 0. Human: `/settings/remote?mock-panel` → "Next capture: nothing received", then Re-learn on Power on → after ~3 s "Nothing received" + **Try again**, status still "Tuya code · captured".

**Commit:** `git add -A && git commit -m "feat(kiosk): mock panel capture outcome"`

---

### T30 — Network selectors (S3b)
- [ ] done

**Files:** `apps/kiosk/src/features/settings/network/network.view.ts`, `apps/kiosk/src/features/settings/network/network.view.test.ts`

**Context:** SPEC S3b ("Hostname" `r-101.local`; "Address"; "Connection": "Ethernet" / "Wi-Fi · {SSID} · {signal}"; "Controller":
"Online"; "Connected clients": count with labels, e.g. "room screen", "phone ×2"); contracts `NetworkInfo`. Decision D23
for the two `[INFERRED]` variants ("Not connected", "Hardware service down").

**Do:**
1. Create `apps/kiosk/src/features/settings/network/network.view.ts`:
```ts
import type { ConnectedClient, NetworkConnection, NetworkInfo } from "@eduscope/contracts";
import type { ValueTone } from "@/components/state-styles";

// S3b rows (read-only in v1).

export interface NetworkRow {
  label: string;
  value: string | null;
  mono: boolean;
  tone: ValueTone;
}

/** "Ethernet" / "Wi-Fi · {SSID} · {signal}" / "Not connected" (red) `[INFERRED]`. */
export function connectionText(connection: NetworkConnection): { text: string; tone: ValueTone } {
  switch (connection.kind) {
    case "ethernet":
      return { text: "Ethernet", tone: "default" };
    case "wifi":
      return { text: ["Wi-Fi", connection.ssid, connection.signal_pct === null ? null : `${connection.signal_pct}%`].filter((p) => p !== null).join(" · "), tone: "default" };
    case "none":
      return { text: "Not connected", tone: "danger" };
  }
}

/** "room screen · phone ×2 · laptop": one entry per label, in first-seen order. */
export function clientsSummary(clients: readonly ConnectedClient[]): string {
  const counts = new Map<string, number>();
  for (const client of clients) counts.set(client.label, (counts.get(client.label) ?? 0) + 1);
  return [...counts].map(([label, count]) => (count === 1 ? label : `${label} ×${count}`)).join(" · ");
}

export function networkRows(info: NetworkInfo): NetworkRow[] {
  const connection = connectionText(info.connection);
  const hwUp = info.controller.hw === "up";
  return [
    { label: "Hostname", value: info.hostname, mono: true, tone: "default" },
    { label: "Address", value: info.address, mono: true, tone: "default" },
    { label: "Connection", value: connection.text, mono: false, tone: connection.tone },
    // "Hardware service down" when core-api runs but hw-service does not `[INFERRED]`.
    { label: "Controller", value: hwUp ? "Online" : "Hardware service down", mono: false, tone: hwUp ? "accent" : "danger" },
    { label: "Connected clients", value: String(info.clients.length), mono: true, tone: "default" },
  ];
}
```
2. Create `apps/kiosk/src/features/settings/network/network.view.test.ts`:
```ts
import type { NetworkInfo } from "@eduscope/contracts";
import { describe, expect, it } from "vitest";
import { clientsSummary, connectionText, networkRows } from "./network.view";

const info: NetworkInfo = {
  hostname: "r-101.local", address: "192.168.10.41", connection: { kind: "ethernet" }, controller: { hw: "up" },
  clients: [
    { public_id: null, label: "room screen", client_type: "kiosk", access: "control" },
    { public_id: "p", label: "phone", client_type: "remote", access: "control" },
    { public_id: null, label: "phone", client_type: "remote", access: "view" },
    { public_id: "me", label: "laptop", client_type: "remote", access: "technician" },
  ],
};

describe("network view (S3b)", () => {
  it("rows: hostname, address, connection, controller, client count", () => {
    expect(networkRows(info).map((row) => [row.label, row.value, row.tone])).toEqual([
      ["Hostname", "r-101.local", "default"],
      ["Address", "192.168.10.41", "default"],
      ["Connection", "Ethernet", "default"],
      ["Controller", "Online", "accent"],
      ["Connected clients", "4", "default"],
    ]);
  });
  it("hw-service down and no address", () => {
    const rows = networkRows({ ...info, address: null, controller: { hw: "down" } });
    expect(rows[1]?.value).toBeNull();
    expect(rows[3]).toMatchObject({ value: "Hardware service down", tone: "danger" });
  });
  it("connection variants", () => {
    expect(connectionText({ kind: "wifi", ssid: "Campus", signal_pct: 72 })).toEqual({ text: "Wi-Fi · Campus · 72%", tone: "default" });
    expect(connectionText({ kind: "wifi", ssid: "Campus", signal_pct: null }).text).toBe("Wi-Fi · Campus");
    expect(connectionText({ kind: "none" })).toEqual({ text: "Not connected", tone: "danger" });
  });
  it("clients summary groups labels: 'phone ×2'", () => {
    expect(clientsSummary(info.clients)).toBe("room screen · phone ×2 · laptop");
    expect(clientsSummary([])).toBe("");
  });
});
```

**Test:** `network.view.test.ts`: five rows; hw down + no address; Wi-Fi with/without signal, none; client summary "room screen · phone ×2 · laptop", empty.

**Verify:** `pnpm --filter @eduscope/kiosk exec vitest run src/features/settings/network` → 4 tests pass; then `pnpm verify` → exit 0.

**Commit:** `git add -A && git commit -m "feat(kiosk): network selectors"`

---

### T31 — `NetworkTab` (S3b), wired into Settings
- [ ] done

**Files:** `apps/kiosk/src/features/settings/network/NetworkTab.tsx`, `apps/kiosk/src/features/settings/SettingsPage.tsx`

**Context:** SPEC S3b ("Single column of label/value rows, with the same frame as S3"; "No editing in v1"), Q25. Reuse `Card`,
`SectionLabel`, `SettingsRow`, `QueryStatus` (T12), `useNetworkInfo` (T7).

**States:** loading (5 skeleton rows), failed ("Couldn't load network details" + Retry), loaded, controller down (red), no address (`—`).

**Layout:** One column at every width, `max-w-3xl`; rows full width of the card.

**Do:**
1. Create `apps/kiosk/src/features/settings/network/NetworkTab.tsx`:
```tsx
import { Card } from "@/components/Card";
import { SectionLabel } from "@/components/SectionLabel";
import { useNetworkInfo } from "@/data/settings/hooks";
import { QueryStatus } from "../shared/QueryStatus";
import { SettingsRow } from "../shared/SettingsRow";
import { clientsSummary, networkRows } from "./network.view";

/** S3b: read-only rows (no editing in v1, Q25), one column at every width. */
export function NetworkTab() {
  const query = useNetworkInfo();
  const info = query.data;
  return (
    <Card className="flex max-w-3xl flex-col gap-2">
      <SectionLabel>Network</SectionLabel>
      {info === undefined ? (
        <QueryStatus status={query.isError ? "error" : "pending"} what="network details" onRetry={() => void query.refetch()} rows={5} />
      ) : (
        <div>
          {networkRows(info).map((row) => (
            <SettingsRow key={row.label} label={row.label} value={row.value} mono={row.mono} tone={row.tone} />
          ))}
          {info.clients.length > 0 && <p className="pb-2 text-right text-caption text-text-2">{clientsSummary(info.clients)}</p>}
        </div>
      )}
    </Card>
  );
}
```
2. In `apps/kiosk/src/features/settings/SettingsPage.tsx` replace:
```tsx
import { RemoteTab } from "./remote/RemoteTab";
```
with:
```tsx
import { NetworkTab } from "./network/NetworkTab";
import { RemoteTab } from "./remote/RemoteTab";
```
3. In `apps/kiosk/src/features/settings/SettingsPage.tsx` replace:
```tsx
      return <PlaceholderPage title="Network" spec="S3b" milestone="M06" />;
```
with:
```tsx
      return <NetworkTab />;
```

**Verify:** `pnpm verify` → exit 0. Human: Settings → Network shows Hostname `r-101.local`, Address `192.168.10.41`, Ethernet, Controller "Online" (green), Connected clients `4` + "room screen · phone ×2 · laptop".

**Commit:** `git add -A && git commit -m "feat(kiosk): network tab"`

---

### T32 — Schedule selectors: days, block and action rows
- [ ] done

**Files:** `apps/kiosk/src/features/settings/schedule/schedule.view.ts`, `apps/kiosk/src/features/settings/schedule/schedule.view.test.ts`

**Context:** SPEC S3c ("A list of class blocks: day(s), start–end"; "A list of timed actions, e.g. 'All off · 18:00 weekdays'. Each
has an enable toggle"), §6 Schedule; contracts `ClassBlock`, `TimedAction`, `Weekday`. Decision D17 (day wording). The
enable toggle is a PUT of the whole action (`TimedActionInput`, ARCHITECTURE §3.3) — `withEnabled` builds it.

**Do:**
1. Create `apps/kiosk/src/features/settings/schedule/schedule.view.ts`:
```ts
import { Weekday, type ClassBlock, type TimedAction, type TimedActionInput } from "@eduscope/contracts";

// S3c: day formatting and the list rows.

const ORDER = Weekday.options;
const SHORT: Record<Weekday, string> = { mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat", sun: "Sun" };
export const WEEKDAYS: readonly Weekday[] = ["mon", "tue", "wed", "thu", "fri"];

const sameDays = (days: readonly Weekday[], set: readonly Weekday[]): boolean =>
  days.length === set.length && set.every((day) => days.includes(day));

/** "every day", "weekdays", "weekends", "Mon–Thu" (3+ in a row), else "Mon, Wed". */
export function formatDays(days: readonly Weekday[]): string {
  const sorted = ORDER.filter((day) => days.includes(day));
  if (sorted.length === 7) return "every day";
  if (sameDays(sorted, WEEKDAYS)) return "weekdays";
  if (sameDays(sorted, ["sat", "sun"])) return "weekends";
  const first = sorted[0];
  const last = sorted.at(-1);
  if (first !== undefined && last !== undefined && sorted.length >= 3 && ORDER.indexOf(last) - ORDER.indexOf(first) === sorted.length - 1) {
    return `${SHORT[first]}–${SHORT[last]}`;
  }
  return sorted.map((day) => SHORT[day]).join(", ");
}

export interface BlockRow {
  id: string;
  time: string;
  days: string;
}

/** Class blocks by first day, then start time. */
export function blockRows(blocks: readonly ClassBlock[]): BlockRow[] {
  const firstDay = (block: ClassBlock): number => Math.min(...block.days.map((day) => ORDER.indexOf(day)));
  return [...blocks]
    .sort((a, b) => firstDay(a) - firstDay(b) || a.start.localeCompare(b.start))
    .map((block) => ({ id: block.id, time: `${block.start}–${block.end}`, days: formatDays(block.days) }));
}

export interface ActionRow {
  id: string;
  /** SPEC S3c: "All off · 18:00 weekdays". */
  label: string;
  enabled: boolean;
  action: TimedAction;
}

export function actionRows(actions: readonly TimedAction[]): ActionRow[] {
  return [...actions]
    .sort((a, b) => a.time.localeCompare(b.time))
    .map((action) => ({ id: action.id, label: `${action.name} · ${action.time} ${formatDays(action.days)}`, enabled: action.enabled, action }));
}

/** The PUT body that flips one action's enable toggle. */
export function withEnabled(action: TimedAction, enabled: boolean): TimedActionInput {
  return { name: action.name, time: action.time, days: action.days, enabled, steps: action.steps };
}
```
2. Create `apps/kiosk/src/features/settings/schedule/schedule.view.test.ts`:
```ts
import type { TimedAction } from "@eduscope/contracts";
import { describe, expect, it } from "vitest";
import { actionRows, blockRows, formatDays, withEnabled } from "./schedule.view";

describe("formatDays", () => {
  it.each<[Parameters<typeof formatDays>[0], string]>([
    [["mon", "tue", "wed", "thu", "fri", "sat", "sun"], "every day"],
    [["fri", "mon", "tue", "wed", "thu"], "weekdays"],
    [["sun", "sat"], "weekends"],
    [["mon", "tue", "wed", "thu"], "Mon–Thu"],
    [["mon", "wed"], "Mon, Wed"],
    [["wed"], "Wed"],
  ])("%j → %s", (days, text) => {
    expect(formatDays(days)).toBe(text);
  });
});

const allOff: TimedAction = {
  id: "act-1", name: "All off", time: "18:00", days: ["mon", "tue", "wed", "thu", "fri"], enabled: true,
  steps: [{ kind: "ac.power", on: false }],
};

describe("rows", () => {
  it("blocks by first day then start", () => {
    expect(blockRows([
      { id: "b", days: ["mon", "wed"], start: "13:00", end: "15:00" },
      { id: "c", days: ["tue"], start: "08:00", end: "09:00" },
      { id: "a", days: ["mon", "tue", "wed", "thu", "fri"], start: "08:00", end: "10:00" },
    ])).toEqual([
      { id: "a", time: "08:00–10:00", days: "weekdays" },
      { id: "b", time: "13:00–15:00", days: "Mon, Wed" },
      { id: "c", time: "08:00–09:00", days: "Tue" },
    ]);
  });
  it("actions read 'All off · 18:00 weekdays' (SPEC S3c)", () => {
    expect(actionRows([allOff])[0]).toMatchObject({ id: "act-1", label: "All off · 18:00 weekdays", enabled: true });
  });
  it("withEnabled builds the PUT body without the id", () => {
    expect(withEnabled(allOff, false)).toEqual({ name: "All off", time: "18:00", days: allOff.days, enabled: false, steps: allOff.steps });
  });
});
```

**Test:** `schedule.view.test.ts`: every day / weekdays / weekends / Mon–Thu / Mon, Wed / Wed; block order; "All off · 18:00 weekdays"; PUT body without the id.

**Verify:** `pnpm --filter @eduscope/kiosk exec vitest run src/features/settings/schedule/schedule.view.test.ts` → 9 tests pass; then `pnpm verify` → exit 0.

**Commit:** `git add -A && git commit -m "feat(kiosk): schedule selectors"`

---

### T33 — Schedule sheet validation and timed-action presets
- [ ] done

**Files:** `apps/kiosk/src/features/settings/schedule/schedule-form.ts`, `apps/kiosk/src/features/settings/schedule/schedule-form.test.ts`

**Context:** SPEC S3c ("+ Add block", "+ Add action"), §2.3 (blocks end control sessions); milestone AC11 ("schedule time/day
validation"). The contract decides validity (`ClassBlockInput`: ≥1 day, `HH:MM`, end after start; `TimedActionInput`);
this maps its issues to copy: "Pick at least one day", "Use HH:MM (24 h)", "End must be after start". Presets (decision
D17, `[INFERRED]`): All off (projector off, AC off, both lights off) · Lights off · Projector off · AC off.

**Do:**
1. Create `apps/kiosk/src/features/settings/schedule/schedule-form.ts`:
```ts
import { ClassBlockInput, TimedActionInput, type CommandBody, type Weekday } from "@eduscope/contracts";
import type { FormResult } from "../shared/form-result";
import { WEEKDAYS } from "./schedule.view";

// S3c "+ Add block" / "+ Add action" sheets: validation and the timed-action presets.

export interface BlockForm {
  days: Weekday[];
  start: string;
  end: string;
}
export const EMPTY_BLOCK_FORM: BlockForm = { days: [...WEEKDAYS], start: "08:00", end: "09:00" };

const FORMAT_MESSAGE = "Use HH:MM (24 h)";

/** S3c "+ Add block": at least one day, HH:MM times, end after start. */
export function validateBlock(form: BlockForm): FormResult<ClassBlockInput, "days" | "start" | "end"> {
  const parsed = ClassBlockInput.safeParse(form);
  if (parsed.success) return { ok: true, value: parsed.data };
  const errors: Partial<Record<"days" | "start" | "end", string>> = {};
  for (const issue of parsed.error.issues) {
    const field = issue.path[0];
    if (field === "days") errors.days ??= "Pick at least one day";
    if (field === "start") errors.start ??= FORMAT_MESSAGE;
    if (field === "end") errors.end ??= issue.code === "custom" ? "End must be after start" : FORMAT_MESSAGE;
  }
  return { ok: false, errors };
}

export type PresetId = "all_off" | "lights_off" | "projector_off" | "ac_off";
const LIGHTS_OFF: CommandBody[] = [
  { kind: "lights.set", gang: "front", on: false },
  { kind: "lights.set", gang: "rear", on: false },
];
/** What a timed action can do in v1 `[INFERRED]` (SPEC S3c example: "All off"). */
export const ACTION_PRESETS: readonly { value: PresetId; label: string; steps: CommandBody[] }[] = [
  { value: "all_off", label: "All off", steps: [{ kind: "projector.power", on: false }, { kind: "ac.power", on: false }, ...LIGHTS_OFF] },
  { value: "lights_off", label: "Lights off", steps: LIGHTS_OFF },
  { value: "projector_off", label: "Projector off", steps: [{ kind: "projector.power", on: false }] },
  { value: "ac_off", label: "AC off", steps: [{ kind: "ac.power", on: false }] },
];

export interface ActionForm {
  preset: PresetId;
  time: string;
  days: Weekday[];
}
export const EMPTY_ACTION_FORM: ActionForm = { preset: "all_off", time: "18:00", days: [...WEEKDAYS] };

/** S3c "+ Add action": a preset at a time on some days, enabled. */
export function validateAction(form: ActionForm): FormResult<TimedActionInput, "days" | "time"> {
  const preset = ACTION_PRESETS.find((candidate) => candidate.value === form.preset) ?? ACTION_PRESETS[0];
  const parsed = TimedActionInput.safeParse({
    name: preset?.label ?? "", time: form.time, days: form.days, enabled: true, steps: preset?.steps ?? [],
  });
  if (parsed.success) return { ok: true, value: parsed.data };
  const errors: Partial<Record<"days" | "time", string>> = {};
  for (const issue of parsed.error.issues) {
    const field = issue.path[0];
    if (field === "days") errors.days ??= "Pick at least one day";
    if (field === "time") errors.time ??= FORMAT_MESSAGE;
  }
  return { ok: false, errors };
}
```
2. Create `apps/kiosk/src/features/settings/schedule/schedule-form.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { EMPTY_ACTION_FORM, EMPTY_BLOCK_FORM, validateAction, validateBlock } from "./schedule-form";

describe("validateBlock (time/day validation)", () => {
  it("accepts the default form", () => {
    expect(validateBlock(EMPTY_BLOCK_FORM)).toEqual({ ok: true, value: EMPTY_BLOCK_FORM });
  });
  it("needs a day", () => {
    expect(validateBlock({ ...EMPTY_BLOCK_FORM, days: [] })).toEqual({ ok: false, errors: { days: "Pick at least one day" } });
  });
  it("needs HH:MM times", () => {
    expect(validateBlock({ ...EMPTY_BLOCK_FORM, start: "8:00", end: "" })).toEqual({
      ok: false, errors: { start: "Use HH:MM (24 h)", end: "Use HH:MM (24 h)" },
    });
    expect(validateBlock({ ...EMPTY_BLOCK_FORM, end: "24:00" }).ok).toBe(false);
  });
  it("end must be after start", () => {
    expect(validateBlock({ ...EMPTY_BLOCK_FORM, start: "10:00", end: "10:00" })).toEqual({
      ok: false, errors: { end: "End must be after start" },
    });
  });
});

describe("validateAction", () => {
  it("builds an enabled 'All off' action from the preset", () => {
    expect(validateAction(EMPTY_ACTION_FORM)).toMatchObject({
      ok: true, value: { name: "All off", time: "18:00", enabled: true, days: ["mon", "tue", "wed", "thu", "fri"] },
    });
    expect(validateAction({ ...EMPTY_ACTION_FORM, preset: "lights_off" })).toMatchObject({ ok: true, value: { name: "Lights off" } });
  });
  it("needs a day and a time", () => {
    expect(validateAction({ ...EMPTY_ACTION_FORM, days: [], time: "6pm" })).toEqual({
      ok: false, errors: { days: "Pick at least one day", time: "Use HH:MM (24 h)" },
    });
  });
});
```

**Test:** `schedule-form.test.ts`: default block valid; no day; bad times (`8:00`, empty, `24:00`); end = start; "All off" / "Lights off" from presets; action without day and with "6pm".

**Verify:** `pnpm --filter @eduscope/kiosk exec vitest run src/features/settings/schedule/schedule-form.test.ts` → 6 tests pass; then `pnpm verify` → exit 0.

**Commit:** `git add -A && git commit -m "feat(kiosk): schedule validation"`

---

### T34 — `DayPicker`
- [ ] done

**Files:** `apps/kiosk/src/features/settings/schedule/DayPicker.tsx`

**Context:** S3c sheets: which days a block/action applies to. Seven 48px toggles M T W T F S S (accessible names "Monday"…),
`aria-pressed`, selected = `ACTIVE_CONTROL_CLASS.selected`. The error line is the validator's "Pick at least one day".

**States:** day on / off, pressed, error line.

**Layout:** `grid grid-cols-7 gap-1` at every width (7 × 48px fits 358px at 390).

**Do:**
1. Create `apps/kiosk/src/features/settings/schedule/DayPicker.tsx`:
```tsx
import { Weekday } from "@eduscope/contracts";
import { ACTIVE_CONTROL_CLASS, INACTIVE_CONTROL_CLASS } from "@/components/state-styles";
import { cn } from "@/lib/utils";

const LETTER: Record<Weekday, string> = { mon: "M", tue: "T", wed: "W", thu: "T", fri: "F", sat: "S", sun: "S" };
const NAME: Record<Weekday, string> = {
  mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday", sun: "Sunday",
};

/** Seven 48px day toggles (multi-select), Monday first. */
export function DayPicker({ value, onChange, error }: { value: readonly Weekday[]; onChange: (days: Weekday[]) => void; error: string | null }) {
  const toggle = (day: Weekday): void =>
    onChange(Weekday.options.filter((candidate) => (candidate === day ? !value.includes(day) : value.includes(candidate))));
  return (
    <div className="flex flex-col gap-2">
      <span className="text-caption font-semibold text-text-2">Days</span>
      <div className="grid grid-cols-7 gap-1">
        {Weekday.options.map((day) => (
          <button
            key={day}
            type="button"
            aria-label={NAME[day]}
            aria-pressed={value.includes(day)}
            onClick={() => toggle(day)}
            className={cn(
              "flex h-12 min-w-0 items-center justify-center rounded-btn border-2 text-button font-semibold active:brightness-125",
              value.includes(day) ? ACTIVE_CONTROL_CLASS.selected : INACTIVE_CONTROL_CLASS,
            )}
          >
            {LETTER[day]}
          </button>
        ))}
      </div>
      {error !== null && <p className="text-caption text-danger">{error}</p>}
    </div>
  );
}
```

**Verify:** `pnpm verify` → exit 0.

**Commit:** `git add -A && git commit -m "feat(kiosk): day picker"`

---

### T35 — `AddBlockSheet` (S3c)
- [ ] done

**Files:** `apps/kiosk/src/features/settings/schedule/AddBlockSheet.tsx`

**Context:** SPEC S3c "+ Add block"; reuse `SettingsSheet`, `DayPicker`, `TextField type="time"` (48px native time input),
`SheetActions`, `validateBlock` (T33), `useServerMutation` (refetch `["schedule"]`). Defaults: weekdays,
08:00–09:00.

**States:** default, invalid after Save (per-field red lines), saving (pulse), failed (red line), offline (Save disabled).

**Layout:** Bottom sheet `<lg`, right `lg:`; Start/End side by side `grid grid-cols-2 gap-3` at every width.

**Do:**
1. Create `apps/kiosk/src/features/settings/schedule/AddBlockSheet.tsx`:
```tsx
import type { ClassBlockInput } from "@eduscope/contracts";
import { useState } from "react";
import { queryKeys } from "@/data/query-keys";
import { useServerMutation } from "@/data/settings/hooks";
import { SettingsSheet } from "../shared/SettingsSheet";
import { SheetActions } from "../shared/SheetActions";
import { TextField } from "../shared/TextField";
import { useWritable } from "../shared/use-writable";
import { DayPicker } from "./DayPicker";
import { EMPTY_BLOCK_FORM, validateBlock, type BlockForm } from "./schedule-form";

/** S3c "+ Add block": days, start, end. */
export function AddBlockSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [form, setForm] = useState<BlockForm>(EMPTY_BLOCK_FORM);
  const [showErrors, setShowErrors] = useState(false);
  const writable = useWritable();
  const create = useServerMutation((api, input: ClassBlockInput) => api.schedule.createBlock(input), [queryKeys.schedule()]);
  const result = validateBlock(form);
  const errors = showErrors && !result.ok ? result.errors : {};
  const close = (): void => {
    onOpenChange(false);
    setForm(EMPTY_BLOCK_FORM);
    setShowErrors(false);
    create.reset();
  };
  const save = (): void => {
    if (!result.ok) {
      setShowErrors(true);
      return;
    }
    create.mutate(result.value, { onSuccess: close });
  };
  return (
    <SettingsSheet open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())} title="Add class block" description="Control sessions end when a block ends.">
      <DayPicker value={form.days} onChange={(days) => setForm({ ...form, days })} error={errors.days ?? null} />
      <div className="grid grid-cols-2 gap-3">
        <TextField label="Start" type="time" value={form.start} error={errors.start ?? null} onChange={(start) => setForm({ ...form, start })} />
        <TextField label="End" type="time" value={form.end} error={errors.end ?? null} onChange={(end) => setForm({ ...form, end })} />
      </div>
      <SheetActions onCancel={close} onSave={save} pending={create.isPending} disabled={!writable} error={create.isError ? "Couldn't save · try again" : null} />
    </SettingsSheet>
  );
}
```

**Verify:** `pnpm verify` → exit 0 (opened from T37).

**Commit:** `git add -A && git commit -m "feat(kiosk): add class block sheet"`

---

### T36 — `AddActionSheet` (S3c)
- [ ] done

**Files:** `apps/kiosk/src/features/settings/schedule/AddActionSheet.tsx`

**Context:** SPEC S3c "+ Add action" ("Timed actions run as the attribution 'schedule'"); reuse `ChoiceGroup` (presets, 2 columns),
`TextField type="time"`, `DayPicker`, `validateAction` (T33). Defaults: All off, 18:00, weekdays; new actions
start enabled.

**States:** default, invalid after Save, saving, failed, offline.

**Layout:** Bottom sheet `<lg`, right `lg:`.

**Do:**
1. Create `apps/kiosk/src/features/settings/schedule/AddActionSheet.tsx`:
```tsx
import type { TimedActionInput } from "@eduscope/contracts";
import { useState } from "react";
import { queryKeys } from "@/data/query-keys";
import { useServerMutation } from "@/data/settings/hooks";
import { ChoiceGroup } from "../shared/ChoiceGroup";
import { SettingsSheet } from "../shared/SettingsSheet";
import { SheetActions } from "../shared/SheetActions";
import { TextField } from "../shared/TextField";
import { useWritable } from "../shared/use-writable";
import { DayPicker } from "./DayPicker";
import { ACTION_PRESETS, EMPTY_ACTION_FORM, validateAction, type ActionForm } from "./schedule-form";

/** S3c "+ Add action": what (preset), when, which days. New actions start enabled. */
export function AddActionSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [form, setForm] = useState<ActionForm>(EMPTY_ACTION_FORM);
  const [showErrors, setShowErrors] = useState(false);
  const writable = useWritable();
  const create = useServerMutation((api, input: TimedActionInput) => api.schedule.createAction(input), [queryKeys.schedule()]);
  const result = validateAction(form);
  const errors = showErrors && !result.ok ? result.errors : {};
  const close = (): void => {
    onOpenChange(false);
    setForm(EMPTY_ACTION_FORM);
    setShowErrors(false);
    create.reset();
  };
  const save = (): void => {
    if (!result.ok) {
      setShowErrors(true);
      return;
    }
    create.mutate(result.value, { onSuccess: close });
  };
  return (
    <SettingsSheet open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())} title="Add timed action" description="Runs by itself and shows as “· by schedule”.">
      <ChoiceGroup label="Action" columns={2} options={ACTION_PRESETS} value={form.preset} onChange={(preset) => setForm({ ...form, preset })} />
      <TextField label="Time" type="time" value={form.time} error={errors.time ?? null} onChange={(time) => setForm({ ...form, time })} />
      <DayPicker value={form.days} onChange={(days) => setForm({ ...form, days })} error={errors.days ?? null} />
      <SheetActions onCancel={close} onSave={save} pending={create.isPending} disabled={!writable} error={create.isError ? "Couldn't save · try again" : null} />
    </SettingsSheet>
  );
}
```

**Verify:** `pnpm verify` → exit 0 (opened from T37).

**Commit:** `git add -A && git commit -m "feat(kiosk): add timed action sheet"`

---

### T37 — `ScheduleTab` (S3c), wired into Settings
- [ ] done

**Files:** `apps/kiosk/src/features/settings/schedule/ScheduleTab.tsx`, `apps/kiosk/src/features/settings/SettingsPage.tsx`

**Context:** SPEC S3c (blocks; timed actions with enable toggle and delete; "+ Add block" / "+ Add action" dashed like S3.E9);
CLAUDE.md "A tap adds a pending overlay; values change only on a server push": the toggle is `ToggleRow` (M04) with
`on` = the server value and `pending` while `useServerMutation` runs (the switch flips when the refetched schedule lands).
Delete: 56px trash button, pulses while pending. Blocks are deletable too (ARCHITECTURE CRUD; decision D17).

**States:** loading (skeletons in both cards), failed (Retry), empty lists ("No class blocks" / "No timed actions" text-3), toggle pending (pulse), delete pending (pulse), save failed ("Couldn't save · try again" under the row), offline (all controls disabled).

**Layout:** `grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6`: phone = Class blocks card, then Timed actions; lg = side by side. Rows: content `flex-1` + `size-14` delete button.

**Do:**
1. Create `apps/kiosk/src/features/settings/schedule/ScheduleTab.tsx`:
```tsx
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { Card } from "@/components/Card";
import { DashedAddButton } from "@/components/DashedAddButton";
import { InlineError } from "@/components/InlineError";
import { SectionLabel } from "@/components/SectionLabel";
import { DISABLED_CONTROL_CLASS, PENDING_CONTROL_CLASS } from "@/components/state-styles";
import { ToggleRow } from "@/components/ToggleRow";
import { queryKeys } from "@/data/query-keys";
import { useSchedule, useServerMutation } from "@/data/settings/hooks";
import { cn } from "@/lib/utils";
import { QueryStatus } from "../shared/QueryStatus";
import { useWritable } from "../shared/use-writable";
import { AddActionSheet } from "./AddActionSheet";
import { AddBlockSheet } from "./AddBlockSheet";
import { actionRows, blockRows, withEnabled, type ActionRow, type BlockRow } from "./schedule.view";

const SAVE_FAILED = "Couldn't save · try again";

function DeleteButton({ label, pending, disabled, onPress }: { label: string; pending: boolean; disabled: boolean; onPress: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-busy={pending}
      disabled={disabled}
      onClick={() => {
        if (!pending) onPress();
      }}
      className={cn(
        "flex size-14 shrink-0 items-center justify-center rounded-btn border-2 border-border-strong bg-control text-text-2 active:brightness-125",
        pending && PENDING_CONTROL_CLASS,
        disabled && DISABLED_CONTROL_CLASS,
      )}
    >
      <Trash2 aria-hidden="true" className="size-5" />
    </button>
  );
}

function BlockItem({ row }: { row: BlockRow }) {
  const writable = useWritable();
  const remove = useServerMutation((api, id: string) => api.schedule.deleteBlock(id), [queryKeys.schedule()]);
  return (
    <li className="flex flex-col gap-1">
      <div className="flex items-center gap-3">
        <div className="flex min-h-14 flex-1 flex-col justify-center rounded-btn bg-surface-2 px-4">
          <span className="font-mono text-button text-text-1">{row.time}</span>
          <span className="text-caption text-text-2">{row.days}</span>
        </div>
        <DeleteButton label={`Delete block ${row.time} ${row.days}`} pending={remove.isPending} disabled={!writable} onPress={() => remove.mutate(row.id)} />
      </div>
      <InlineError message={remove.isError ? SAVE_FAILED : null} />
    </li>
  );
}

function ActionItem({ row }: { row: ActionRow }) {
  const writable = useWritable();
  const toggle = useServerMutation((api, enabled: boolean) => api.schedule.updateAction(row.id, withEnabled(row.action, enabled)), [queryKeys.schedule()]);
  const remove = useServerMutation((api, id: string) => api.schedule.deleteAction(id), [queryKeys.schedule()]);
  return (
    <li className="flex flex-col gap-1">
      <div className="flex items-center gap-3">
        {/* The switch shows the server value; the row pulses until the refetch lands (never optimistic). */}
        <ToggleRow label={row.label} on={row.enabled} pending={toggle.isPending} disabled={!writable} onToggle={() => toggle.mutate(!row.enabled)} className="flex-1" />
        <DeleteButton label={`Delete ${row.label}`} pending={remove.isPending} disabled={!writable} onPress={() => remove.mutate(row.id)} />
      </div>
      <InlineError message={toggle.isError || remove.isError ? SAVE_FAILED : null} />
    </li>
  );
}

/** S3c: class blocks (end control sessions, §2.3) and timed actions (toggle, delete). lg: side by side. */
export function ScheduleTab() {
  const query = useSchedule();
  const writable = useWritable();
  const [adding, setAdding] = useState<"block" | "action" | null>(null);
  const schedule = query.data;
  const loading = schedule === undefined && (
    <QueryStatus status={query.isError ? "error" : "pending"} what="the schedule" onRetry={() => void query.refetch()} rows={2} />
  );
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
      <Card className="flex flex-col gap-3">
        <SectionLabel>Class blocks</SectionLabel>
        <p className="text-caption text-text-2">Room PIN sessions end when the current block ends.</p>
        {loading}
        {schedule !== undefined && schedule.class_blocks.length === 0 && <p className="text-caption text-text-3">No class blocks</p>}
        {schedule !== undefined && (
          <ul className="flex flex-col gap-2">
            {blockRows(schedule.class_blocks).map((row) => (
              <BlockItem key={row.id} row={row} />
            ))}
          </ul>
        )}
        <DashedAddButton label="Add block" disabled={!writable} onPress={() => setAdding("block")} className="h-14" />
      </Card>
      <Card className="flex flex-col gap-3">
        <SectionLabel>Timed actions</SectionLabel>
        <p className="text-caption text-text-2">Changes they make show as “· by schedule”.</p>
        {loading}
        {schedule !== undefined && schedule.actions.length === 0 && <p className="text-caption text-text-3">No timed actions</p>}
        {schedule !== undefined && (
          <ul className="flex flex-col gap-2">
            {actionRows(schedule.actions).map((row) => (
              <ActionItem key={row.id} row={row} />
            ))}
          </ul>
        )}
        <DashedAddButton label="Add action" disabled={!writable} onPress={() => setAdding("action")} className="h-14" />
      </Card>
      <AddBlockSheet open={adding === "block"} onOpenChange={(open) => setAdding(open ? "block" : null)} />
      <AddActionSheet open={adding === "action"} onOpenChange={(open) => setAdding(open ? "action" : null)} />
    </div>
  );
}
```
2. In `apps/kiosk/src/features/settings/SettingsPage.tsx` replace:
```tsx
import { SettingsTabs } from "./SettingsTabs";
```
with:
```tsx
import { ScheduleTab } from "./schedule/ScheduleTab";
import { SettingsTabs } from "./SettingsTabs";
```
3. In `apps/kiosk/src/features/settings/SettingsPage.tsx` replace:
```tsx
      return <PlaceholderPage title="Schedule" spec="S3c" milestone="M06" />;
```
with:
```tsx
      return <ScheduleTab />;
```

**Verify:** `pnpm verify` → exit 0. Human: Settings → Schedule: 3 blocks, "All off · 18:00 weekdays" On; toggling pulses, then shows Off; delete removes the row.

**Commit:** `git add -A && git commit -m "feat(kiosk): schedule tab"`

---

### T38 — Device registry selectors and permit-join label (S3d)
- [ ] done

**Files:** `apps/kiosk/src/features/settings/devices/devices.view.ts`, `apps/kiosk/src/features/settings/devices/devices.view.test.ts`

**Context:** SPEC S3d ("Registry of every room device: name, kind, transport (`zigbee` / `ZS06` / `mcu` / `local`), hardware ID or
friendly name"; "Row tap opens an edit sheet: rename, change transport, remove"; "Permit joining" opens the mesh for
4 min and S2.E21 shows the countdown), R8. Decision D18 (only IR devices change transport). The patch carries only
changed fields (`DevicePatch` validates it). The permit-join label counts down like S2.E21 ("Joining open · 3:59
left", `formatCountdown`).

**Do:**
1. Create `apps/kiosk/src/features/settings/devices/devices.view.ts`:
```ts
import { DevicePatch, type Device, type DeviceKind, type Mesh, type Transport } from "@eduscope/contracts";
import { formatCountdown } from "@/lib/format";
import type { Choice } from "../shared/ChoiceGroup";

// S3d: the device registry, its edit sheet and "Permit joining".

const KIND_LABEL: Record<DeviceKind, string> = {
  projector: "Projector", hdmi_switch: "HDMI switch", projection_screen: "Projection screen", lights: "Lights",
  ac: "Air conditioning", audio: "Audio", power_socket: "Power socket", sensor: "Sensor", ir_blaster: "IR blaster",
  coordinator: "Coordinator", other: "Other",
};
/** SPEC S3d: `zigbee` / `ZS06` / `mcu` / `local`. */
export const TRANSPORT_NAME: Record<Transport, string> = { zigbee: "Zigbee", ir_zs06: "ZS06", ir_mcu: "MCU", local: "Local" };

export interface RegistryRow {
  id: string;
  name: string;
  kind: string;
  transport: string;
  /** Hardware ID or friendly name: `r101_lights`, `ZG-808Z`, or "—". */
  hardwareId: string;
}

export function registryRow(device: Device): RegistryRow {
  return {
    id: device.id, name: device.name, kind: KIND_LABEL[device.kind], transport: TRANSPORT_NAME[device.transport],
    hardwareId: device.hw_ref ?? device.model ?? "—",
  };
}

/**
 * Which transports the edit sheet offers. Only an IR device can move (R8: ZS06 ↔ MCU); a
 * Zigbee or local device's transport is its hardware, so it is shown, not chosen `[INFERRED]`.
 */
export function transportChoices(transport: Transport): readonly Choice<Transport>[] | null {
  return transport === "ir_zs06" || transport === "ir_mcu"
    ? [{ value: "ir_zs06", label: "ZS06" }, { value: "ir_mcu", label: "MCU" }]
    : null;
}

export interface EditForm {
  name: string;
  transport: Transport;
}

/** Only the changed fields; `null` when nothing changed. */
export function devicePatch(device: Device, form: EditForm): { ok: true; patch: DevicePatch | null } | { ok: false; error: string } {
  const candidate: DevicePatch = {
    ...(form.name.trim() === device.name ? {} : { name: form.name }),
    ...(form.transport === device.transport ? {} : { transport: form.transport }),
  };
  const parsed = DevicePatch.safeParse(candidate);
  if (!parsed.success) return { ok: false, error: form.name.trim() === "" ? "Enter a name" : "40 characters at most" };
  return { ok: true, patch: Object.keys(parsed.data).length === 0 ? null : parsed.data };
}

/** S3d "Permit joining" → while open: "Joining open · 3:59 left" (S2.E21 shows the same countdown). */
export function permitJoinView(joining: Mesh["joining"], now: Date): { label: string; open: boolean } {
  if (joining.state === "closed") return { label: "Permit joining", open: false };
  return { label: `Joining open · ${formatCountdown((Date.parse(joining.until) - now.getTime()) / 1000)} left`, open: true };
}
```
2. Create `apps/kiosk/src/features/settings/devices/devices.view.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { roomState } from "@/data/test/room-state";
import { devicePatch, permitJoinView, registryRow, transportChoices } from "./devices.view";

const devices = roomState().devices;
const byId = (id: string) => {
  const device = devices.find((d) => d.id === id);
  if (device === undefined) throw new Error(id);
  return device;
};

describe("registry rows (S3d)", () => {
  it("name, kind, transport, hardware id or friendly name", () => {
    expect(registryRow(byId("lights"))).toEqual({ id: "lights", name: "Lighting switch", kind: "Lights", transport: "Zigbee", hardwareId: "r101_lights" });
    expect(registryRow(byId("projector"))).toMatchObject({ kind: "Projector", transport: "ZS06", hardwareId: "—" });
    expect(registryRow(byId("hdmi_switch"))).toMatchObject({ transport: "Local" });
  });
});

describe("edit sheet", () => {
  it("IR devices choose ZS06 / MCU; others are fixed", () => {
    expect(transportChoices("ir_zs06")?.map((c) => c.label)).toEqual(["ZS06", "MCU"]);
    expect(transportChoices("zigbee")).toBeNull();
  });
  it("patch holds only what changed", () => {
    const projector = byId("projector");
    expect(devicePatch(projector, { name: "Projector", transport: "ir_zs06" })).toEqual({ ok: true, patch: null });
    expect(devicePatch(projector, { name: " Main projector ", transport: "ir_mcu" })).toEqual({
      ok: true, patch: { name: "Main projector", transport: "ir_mcu" },
    });
  });
  it("refuses an empty or long name", () => {
    const projector = byId("projector");
    expect(devicePatch(projector, { name: " ", transport: "ir_zs06" })).toEqual({ ok: false, error: "Enter a name" });
    expect(devicePatch(projector, { name: "x".repeat(41), transport: "ir_zs06" })).toEqual({ ok: false, error: "40 characters at most" });
  });
});

describe("permitJoinView", () => {
  const now = new Date("2026-10-13T09:00:00Z");
  it("closed → the button; open → the countdown", () => {
    expect(permitJoinView({ state: "closed" }, now)).toEqual({ label: "Permit joining", open: false });
    expect(permitJoinView({ state: "open", until: "2026-10-13T09:03:59Z" }, now)).toEqual({ label: "Joining open · 3:59 left", open: true });
  });
});
```

**Test:** `devices.view.test.ts`: rows for lights / projector / HDMI switch; IR vs fixed transports; patch null / changed fields; empty and long names; closed / open joining.

**Verify:** `pnpm --filter @eduscope/kiosk exec vitest run src/features/settings/devices/devices.view.test.ts` → 5 tests pass; then `pnpm verify` → exit 0.

**Commit:** `git add -A && git commit -m "feat(kiosk): device registry selectors"`

---

### T39 — PIN change confirm logic (S3d)
- [ ] done

**Files:** `apps/kiosk/src/features/settings/devices/pin-change.ts`, `apps/kiosk/src/features/settings/devices/pin-change.test.ts`

**Context:** SPEC §2.3 (room PIN 4 digits; technician PIN 6), S3d ("Room PIN": "Change"; "Technician PIN": "Change"), AC6 ("Room
PIN change requires 4 digits twice (confirm), Technician PIN 6"), AC11 ("PIN change confirm logic"). Decision D19. Same
reducer style as `features/pin/pin-input.ts` (M03): pure, auto-advance when the last digit lands.

**Do:**
1. Create `apps/kiosk/src/features/settings/devices/pin-change.ts`:
```ts
// S3d "Change" PIN sheet (SPEC §2.3): enter the new PIN, enter it again, save. Pure reducer.

export type PinLevel = "room" | "technician";
export type PinChangeStep = "new" | "confirm" | "saving" | "mismatch" | "error";

export interface PinChangeState {
  length: 4 | 6;
  step: PinChangeStep;
  /** The first entry, kept while confirming and saving. */
  first: string;
  digits: string;
  /** Bumped on every mismatch so the dots shake again. */
  mismatches: number;
}

export type PinChangeAction = { type: "digit"; digit: string } | { type: "backspace" } | { type: "failed" };

export const PIN_LENGTH: Record<PinLevel, 4 | 6> = { room: 4, technician: 6 };

export function initialPinChange(level: PinLevel): PinChangeState {
  return { length: PIN_LENGTH[level], step: "new", first: "", digits: "", mismatches: 0 };
}

export function pinChangeReducer(state: PinChangeState, action: PinChangeAction): PinChangeState {
  switch (action.type) {
    case "digit": {
      if (state.step === "saving" || !/^\d$/.test(action.digit)) return state;
      // After a mismatch or a failed save, the next digit starts a new PIN.
      const restart = state.step === "mismatch" || state.step === "error";
      const step = restart ? "new" : state.step;
      const digits = (restart ? "" : state.digits) + action.digit;
      if (digits.length < state.length) return { ...state, step, first: restart ? "" : state.first, digits };
      if (step === "new") return { ...state, step: "confirm", first: digits, digits: "" };
      return digits === state.first
        ? { ...state, step: "saving", digits }
        : { ...state, step: "mismatch", first: "", digits: "", mismatches: state.mismatches + 1 };
    }
    case "backspace":
      if (state.step === "saving") return state;
      if (state.step === "mismatch" || state.step === "error") return { ...state, step: "new", first: "", digits: "" };
      return { ...state, digits: state.digits.slice(0, -1) };
    case "failed":
      return state.step === "saving" ? { ...state, step: "error", first: "", digits: "" } : state;
  }
}

const NAME: Record<PinLevel, string> = { room: "room PIN", technician: "technician PIN" };

/** Sheet heading for the step. */
export function pinChangeTitle(level: PinLevel, state: PinChangeState): string {
  return state.step === "confirm" || state.step === "saving" ? `Enter the new ${NAME[level]} again` : `New ${NAME[level]}`;
}

/** The line under the dots; `null` = nothing to say. */
export function pinChangeMessage(state: PinChangeState): string | null {
  switch (state.step) {
    case "mismatch":
      return "The PINs don't match · start again";
    case "error":
      return "Couldn't save the PIN · try again";
    case "saving":
      return "Saving…";
    case "new":
    case "confirm":
      return null;
  }
}
```
2. Create `apps/kiosk/src/features/settings/devices/pin-change.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { initialPinChange, pinChangeMessage, pinChangeReducer, pinChangeTitle, type PinChangeState } from "./pin-change";

const type = (state: PinChangeState, digits: string): PinChangeState =>
  [...digits].reduce((next, digit) => pinChangeReducer(next, { type: "digit", digit }), state);

describe("PIN change confirm logic (S3d)", () => {
  it("room PIN: 4 digits, then the same 4 again → saving", () => {
    const first = type(initialPinChange("room"), "4321");
    expect(first).toMatchObject({ step: "confirm", first: "4321", digits: "" });
    expect(pinChangeTitle("room", first)).toBe("Enter the new room PIN again");
    expect(type(first, "4321")).toMatchObject({ step: "saving", first: "4321" });
  });

  it("technician PIN needs 6 digits", () => {
    expect(type(initialPinChange("technician"), "1234")).toMatchObject({ step: "new", digits: "1234" });
    expect(type(initialPinChange("technician"), "123456")).toMatchObject({ step: "confirm", first: "123456" });
    expect(pinChangeTitle("technician", initialPinChange("technician"))).toBe("New technician PIN");
  });

  it("a different second entry is a mismatch; the next digit starts over", () => {
    const mismatch = type(type(initialPinChange("room"), "4321"), "4320");
    expect(mismatch).toMatchObject({ step: "mismatch", first: "", digits: "", mismatches: 1 });
    expect(pinChangeMessage(mismatch)).toBe("The PINs don't match · start again");
    expect(type(mismatch, "9")).toMatchObject({ step: "new", digits: "9", first: "" });
  });

  it("backspace edits the current entry; ignored while saving", () => {
    const state = type(initialPinChange("room"), "12");
    expect(pinChangeReducer(state, { type: "backspace" })).toMatchObject({ digits: "1" });
    const saving = type(type(initialPinChange("room"), "1111"), "1111");
    expect(pinChangeReducer(saving, { type: "backspace" })).toBe(saving);
    expect(pinChangeReducer(saving, { type: "digit", digit: "2" })).toBe(saving);
  });

  it("a failed save starts over with a message", () => {
    const saving = type(type(initialPinChange("room"), "1111"), "1111");
    const failed = pinChangeReducer(saving, { type: "failed" });
    expect(failed).toMatchObject({ step: "error", first: "", digits: "" });
    expect(pinChangeMessage(failed)).toBe("Couldn't save the PIN · try again");
    expect(type(failed, "5")).toMatchObject({ step: "new", digits: "5" });
  });

  it("ignores non-digits", () => {
    const state = initialPinChange("room");
    expect(pinChangeReducer(state, { type: "digit", digit: "a" })).toBe(state);
  });
});
```

**Test:** `pin-change.test.ts`: 4 digits twice → saving; technician needs 6; mismatch → message, next digit restarts; backspace; ignored while saving; failed save restarts; non-digits ignored.

**Verify:** `pnpm --filter @eduscope/kiosk exec vitest run src/features/settings/devices/pin-change.test.ts` → 6 tests pass; then `pnpm verify` → exit 0.

**Commit:** `git add -A && git commit -m "feat(kiosk): PIN change reducer"`

---

### T40 — `DeviceEditSheet` (S3d)
- [ ] done

**Files:** `apps/kiosk/src/features/settings/devices/DeviceEditSheet.tsx`

**Context:** SPEC S3d edit sheet (rename, change transport, remove). Reuse the shared sheet pieces, `ConfirmDialog` (T11) for
Remove ("Remove {name}?" / "It disappears from every screen in the room. Captured IR codes for it are deleted too." /
**Remove**), `useServerMutation` refetching `["devices"]` and `["ir","devices"]` (an IR rename shows in S3 too).
Saving with nothing changed just closes.

**States:** editing, invalid name ("Enter a name" / "40 characters at most"), saving, save failed, fixed transport (read-only row), IR transport choice (ZS06 / MCU), remove confirm open, removing (pulse), remove failed, offline (Save/Remove disabled).

**Layout:** Bottom sheet `<lg`, right `lg:`; Remove is a full-width 48px `CommandButton` with `border-danger text-danger` below Cancel/Save.

**Do:**
1. Create `apps/kiosk/src/features/settings/devices/DeviceEditSheet.tsx`:
```tsx
import type { Device, DevicePatch } from "@eduscope/contracts";
import { useState } from "react";
import { CommandButton } from "@/components/CommandButton";
import { queryKeys } from "@/data/query-keys";
import { useServerMutation } from "@/data/settings/hooks";
import { ChoiceGroup } from "../shared/ChoiceGroup";
import { ConfirmDialog } from "../shared/ConfirmDialog";
import { SettingsRow } from "../shared/SettingsRow";
import { SettingsSheet } from "../shared/SettingsSheet";
import { SheetActions } from "../shared/SheetActions";
import { TextField } from "../shared/TextField";
import { useWritable } from "../shared/use-writable";
import { devicePatch, TRANSPORT_NAME, transportChoices, type EditForm } from "./devices.view";

const KEYS = [queryKeys.devices(), queryKeys.irDevices()];

/** S3d row tap: rename, change transport (IR devices), remove (confirmed). Mount with `key={device.id}`. */
export function DeviceEditSheet({ device, onClose }: { device: Device; onClose: () => void }) {
  const [form, setForm] = useState<EditForm>({ name: device.name, transport: device.transport });
  const [showErrors, setShowErrors] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const writable = useWritable();
  const update = useServerMutation((api, patch: DevicePatch) => api.devices.update(device.id, patch), KEYS);
  const remove = useServerMutation((api, id: string) => api.devices.remove(id), KEYS);
  const result = devicePatch(device, form);
  const choices = transportChoices(device.transport);

  const save = (): void => {
    if (!result.ok) {
      setShowErrors(true);
      return;
    }
    if (result.patch === null) {
      onClose();
      return;
    }
    update.mutate(result.patch, { onSuccess: onClose });
  };

  return (
    <SettingsSheet open onOpenChange={(open) => (open ? undefined : onClose())} title={`Edit ${device.name}`}>
      <TextField
        label="Name"
        value={form.name}
        error={showErrors && !result.ok ? result.error : null}
        onChange={(name) => setForm({ ...form, name })}
      />
      {choices === null ? (
        <SettingsRow label="Transport" value={TRANSPORT_NAME[device.transport]} />
      ) : (
        <ChoiceGroup label="Transport" columns={2} options={choices} value={form.transport} onChange={(transport) => setForm({ ...form, transport })} />
      )}
      <SheetActions onCancel={onClose} onSave={save} pending={update.isPending} disabled={!writable} error={update.isError ? "Couldn't save · try again" : null} />
      <CommandButton label="Remove device" disabled={!writable} onPress={() => setConfirming(true)} className="border-danger text-danger" />
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={`Remove ${device.name}?`}
        description="It disappears from every screen in the room. Captured IR codes for it are deleted too."
        confirmLabel="Remove"
        pending={remove.isPending}
        error={remove.isError ? "Couldn't remove · try again" : null}
        onConfirm={() => remove.mutate(device.id, { onSuccess: onClose })}
      />
    </SettingsSheet>
  );
}
```

**Verify:** `pnpm verify` → exit 0 (opened from T41).

**Commit:** `git add -A && git commit -m "feat(kiosk): device edit sheet"`

---

### T41 — `RegistryCard` (S3d device list)
- [ ] done

**Files:** `apps/kiosk/src/features/settings/devices/RegistryCard.tsx`

**Context:** SPEC S3d registry; §2.2 (phone lists become cards of lines, like S2's battery list). Each row is one 56px button that
opens `DeviceEditSheet` (T40); a chevron shows it is tappable (no hover affordance). Data: `useDeviceRegistry` (T7).

**States:** loading (6 skeleton rows), failed (Retry), list, pressed row.

**Layout:** `<600`: two lines — name (16 semibold) / "Lights · Zigbee · `r101_lights`" (12, text-2, id mono). `sm:` one line `grid-cols-[minmax(0,2fr)_minmax(0,1.5fr)_5rem_minmax(0,1.5fr)_auto]`: name · kind · transport · id · chevron.

**Do:**
1. Create `apps/kiosk/src/features/settings/devices/RegistryCard.tsx`:
```tsx
import type { Device } from "@eduscope/contracts";
import { ChevronRight } from "lucide-react";
import { useState } from "react";
import { Card } from "@/components/Card";
import { SectionLabel } from "@/components/SectionLabel";
import { useDeviceRegistry } from "@/data/settings/hooks";
import { usePressed } from "@/lib/use-pressed";
import { QueryStatus } from "../shared/QueryStatus";
import { DeviceEditSheet } from "./DeviceEditSheet";
import { registryRow } from "./devices.view";

function RegistryItem({ device, onOpen }: { device: Device; onOpen: () => void }) {
  const pressed = usePressed();
  const row = registryRow(device);
  return (
    <li>
      <button
        type="button"
        {...pressed}
        onClick={onOpen}
        className="grid min-h-14 w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 rounded-btn bg-surface-2 px-4 py-2 text-left active:brightness-125 data-[pressed=true]:brightness-125 sm:grid-cols-[minmax(0,2fr)_minmax(0,1.5fr)_5rem_minmax(0,1.5fr)_auto]"
      >
        <span className="truncate text-card-title font-semibold text-text-1">{row.name}</span>
        <ChevronRight aria-hidden="true" className="col-start-2 row-span-2 size-5 text-text-3 sm:col-start-5 sm:row-span-1" />
        {/* Phone: line 2 = kind · transport · id. ≥600: columns. */}
        <span className="truncate text-caption text-text-2 sm:hidden">
          {row.kind} · {row.transport} · <span className="font-mono">{row.hardwareId}</span>
        </span>
        <span className="hidden truncate text-caption text-text-2 sm:col-start-2 sm:row-start-1 sm:block">{row.kind}</span>
        <span className="hidden text-caption text-text-2 sm:col-start-3 sm:row-start-1 sm:block">{row.transport}</span>
        <span className="hidden truncate font-mono text-caption text-text-2 sm:col-start-4 sm:row-start-1 sm:block">{row.hardwareId}</span>
      </button>
    </li>
  );
}

/** S3d registry of every room device; a row opens the edit sheet. */
export function RegistryCard() {
  const query = useDeviceRegistry();
  const [editing, setEditing] = useState<string | null>(null);
  const devices = query.data;
  const editingDevice = devices?.find((device) => device.id === editing);
  return (
    <Card className="flex flex-col gap-3">
      <SectionLabel>Room devices</SectionLabel>
      {devices === undefined ? (
        <QueryStatus status={query.isError ? "error" : "pending"} what="devices" onRetry={() => void query.refetch()} rows={6} />
      ) : (
        <ul className="flex flex-col gap-2">
          {devices.map((device) => (
            <RegistryItem key={device.id} device={device} onOpen={() => setEditing(device.id)} />
          ))}
        </ul>
      )}
      {editingDevice !== undefined && <DeviceEditSheet key={editingDevice.id} device={editingDevice} onClose={() => setEditing(null)} />}
    </Card>
  );
}
```

**Verify:** `pnpm verify` → exit 0 (rendered in T45).

**Commit:** `git add -A && git commit -m "feat(kiosk): device registry card"`

---

### T42 — `PermitJoinCard` (S3d)
- [ ] done

**Files:** `apps/kiosk/src/features/settings/devices/PermitJoinCard.tsx`

**Context:** SPEC S3d ("Permit joining" opens the Zigbee mesh for 4 min, S2.E21 shows the countdown), H9 (no joining while the
coordinator is not online). The countdown is server state: `RoomState.zigbee.mesh.joining` + `useServerNow` → `permitJoinView`
(T38). A plain `useMutation` (no query to refetch; decision D10). While open, the button shows the amber
assumed fill (SPEC §3.4 `warn`, same tone as S2.E21's amber "Open · 4:12 left").

**States:** closed ("Permit joining"), sending (pulse), open (amber, disabled, countdown), failed ("Couldn't open joining · try again"), coordinator offline/starting or disconnected (disabled), before snapshot (disabled).

**Layout:** Same at every width; button `size="primary"` (56px) full width.

**Do:**
1. Create `apps/kiosk/src/features/settings/devices/PermitJoinCard.tsx`:
```tsx
import { useMutation } from "@tanstack/react-query";
import { Card } from "@/components/Card";
import { CommandButton } from "@/components/CommandButton";
import { InlineError } from "@/components/InlineError";
import { SectionLabel } from "@/components/SectionLabel";
import { useApiClient } from "@/data/api-context";
import { useRoomState } from "@/data/hooks";
import { useServerNow } from "@/lib/server-time";
import { useWritable } from "../shared/use-writable";
import { permitJoinView } from "./devices.view";

/** S3d "Permit joining": opens the mesh for 4 min; the label counts down from the pushed `mesh.joining`. */
export function PermitJoinCard() {
  const joining = useRoomState((state) => state.zigbee.mesh.joining);
  const coordinatorOnline = useRoomState((state) => state.zigbee.coordinator.status === "online") ?? false;
  const now = useServerNow();
  const writable = useWritable();
  const api = useApiClient();
  // No query to refetch: the open window arrives in the next pushed `state` (zigbee.mesh.joining).
  const permit = useMutation({ mutationFn: () => api.devices.permitJoin() });
  const view = joining === undefined || now === null ? null : permitJoinView(joining, now);
  return (
    <Card className="flex flex-col gap-3">
      <SectionLabel>Zigbee</SectionLabel>
      <p className="text-caption text-text-2">Open the mesh for 4 minutes so a new device can pair.</p>
      <CommandButton
        label={view?.label ?? "Permit joining"}
        size="primary"
        active={view?.open === true ? "assumed" : null}
        pending={permit.isPending}
        disabled={!writable || view === null || view.open || !coordinatorOnline}
        onPress={() => permit.mutate()}
      />
      <InlineError message={permit.isError ? "Couldn't open joining · try again" : null} />
    </Card>
  );
}
```

**Verify:** `pnpm verify` → exit 0. Human (after T45): Permit joining → button reads "Joining open · 3:59 left" (amber) and counts down; `/devices` Mesh shows "Open · 3:5x left".

**Commit:** `git add -A && git commit -m "feat(kiosk): permit joining card"`

---

### T43 — `PinChangeSheet` (S3d)
- [ ] done

**Files:** `apps/kiosk/src/features/settings/devices/PinChangeSheet.tsx`

**Context:** S3d "Change" with the S4 keypad (milestone: "Room PIN / Technician PIN 'Change' sheets using `PinPad`"). Reuse
`PinPad` (64×64 keys, Cancel = close), `PinDots` (4 or 6, shake on mismatch), `pin-change.ts` (T39). On `saving` it
calls `api.settings.setRoomPin` / `setTechnicianPin` once; success → toast "Room PIN changed" / "Technician PIN changed"
(H13 toaster) and close. The PIN is never shown or logged.

**States:** new PIN, confirm ("Enter the new room PIN again"), mismatch (red dots + shake + "The PINs don't match · start again"), saving ("Saving…", keypad disabled), save failed ("Couldn't save the PIN · try again"), saved (toast).

**Layout:** Bottom sheet `<lg` (keypad in thumb reach, like S4 on phone), right `lg:`; dots, message and keypad centred.

**Do:**
1. Create `apps/kiosk/src/features/settings/devices/PinChangeSheet.tsx`:
```tsx
import { useEffect, useReducer } from "react";
import { toast } from "sonner";
import { PinDots } from "@/components/PinDots";
import { PinPad } from "@/components/PinPad";
import { useApiClient } from "@/data/api-context";
import { cn } from "@/lib/utils";
import { SettingsSheet } from "../shared/SettingsSheet";
import { initialPinChange, pinChangeMessage, pinChangeReducer, pinChangeTitle, type PinLevel } from "./pin-change";

const SAVED: Record<PinLevel, string> = { room: "Room PIN changed", technician: "Technician PIN changed" };

/** S3d "Change": new PIN twice on the S4 keypad, then save. Mount with a `key` per opening. */
export function PinChangeSheet({ level, onClose }: { level: PinLevel; onClose: () => void }) {
  const [state, dispatch] = useReducer(pinChangeReducer, level, initialPinChange);
  const api = useApiClient();
  const { step, first } = state;

  useEffect(() => {
    if (step !== "saving") return;
    const save = level === "room" ? api.settings.setRoomPin(first) : api.settings.setTechnicianPin(first);
    save.then(
      () => {
        toast(SAVED[level]);
        onClose();
      },
      () => dispatch({ type: "failed" }),
    );
  }, [step, first, level, api, onClose]);

  const message = pinChangeMessage(state);
  return (
    <SettingsSheet open onOpenChange={(open) => (open ? undefined : onClose())} title={pinChangeTitle(level, state)}>
      <div className="flex flex-col items-center gap-4 pb-2">
        <PinDots length={state.length} filled={state.digits.length} error={step === "mismatch" || step === "error"} shakeKey={state.mismatches} />
        <p aria-live="polite" className={cn("min-h-4 text-caption", step === "saving" ? "text-text-2" : "text-danger")}>
          {message ?? ""}
        </p>
        <PinPad
          disabled={step === "saving"}
          onDigit={(digit) => dispatch({ type: "digit", digit })}
          onBackspace={() => dispatch({ type: "backspace" })}
          onCancel={onClose}
        />
      </div>
    </SettingsSheet>
  );
}
```

**Verify:** `pnpm verify` → exit 0 (opened from T44).

**Commit:** `git add -A && git commit -m "feat(kiosk): PIN change sheet"`

---

### T44 — `PinsCard` (S3d)
- [ ] done

**Files:** `apps/kiosk/src/features/settings/devices/PinsCard.tsx`

**Context:** SPEC S3d ("Room PIN": "Change"; "Technician PIN": "Change"). Rows reuse `SettingsRow` with the length as the value
("4 digits" / "6 digits"); a new `key` per opening resets the sheet's reducer.

**States:** default, offline (Change disabled), sheet open.

**Layout:** Same at every width; `Change` is a 48px `CommandButton` at the row's end.

**Do:**
1. Create `apps/kiosk/src/features/settings/devices/PinsCard.tsx`:
```tsx
import { useState } from "react";
import { Card } from "@/components/Card";
import { CommandButton } from "@/components/CommandButton";
import { SectionLabel } from "@/components/SectionLabel";
import { SettingsRow } from "../shared/SettingsRow";
import { useWritable } from "../shared/use-writable";
import type { PinLevel } from "./pin-change";
import { PinChangeSheet } from "./PinChangeSheet";

/** S3d PIN management: "Room PIN" / "Technician PIN" with "Change". PINs are never shown. */
export function PinsCard() {
  const [changing, setChanging] = useState<{ level: PinLevel; key: number } | null>(null);
  const writable = useWritable();
  const open = (level: PinLevel): void => setChanging({ level, key: Date.now() });
  return (
    <Card className="flex flex-col gap-2">
      <SectionLabel>PINs</SectionLabel>
      <div>
        <SettingsRow label="Room PIN" value="4 digits">
          <CommandButton label="Change" disabled={!writable} onPress={() => open("room")} />
        </SettingsRow>
        <SettingsRow label="Technician PIN" value="6 digits">
          <CommandButton label="Change" disabled={!writable} onPress={() => open("technician")} />
        </SettingsRow>
      </div>
      {changing !== null && <PinChangeSheet key={changing.key} level={changing.level} onClose={() => setChanging(null)} />}
    </Card>
  );
}
```

**Verify:** `pnpm verify` → exit 0 (rendered in T45).

**Commit:** `git add -A && git commit -m "feat(kiosk): PINs card"`

---

### T45 — `DevicesTab` (S3d), wired into Settings
- [ ] done

**Files:** `apps/kiosk/src/features/settings/devices/DevicesTab.tsx`, `apps/kiosk/src/features/settings/SettingsPage.tsx`

**Context:** SPEC S3d layout `[INFERRED]` (decision D18 note): registry on the left (~2/3 at lg), Zigbee + PINs on the right; phone:
one column in that order.

**States:** as its three cards.

**Layout:** `grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:gap-6`; right column `flex flex-col gap-4 lg:gap-6`.

**Do:**
1. Create `apps/kiosk/src/features/settings/devices/DevicesTab.tsx`:
```tsx
import { PermitJoinCard } from "./PermitJoinCard";
import { PinsCard } from "./PinsCard";
import { RegistryCard } from "./RegistryCard";

/** S3d: registry (left, ~2/3 at lg), Zigbee permit joining and PINs (right). Phone: one column in that order. */
export function DevicesTab() {
  return (
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:gap-6">
      <RegistryCard />
      <div className="flex flex-col gap-4 lg:gap-6">
        <PermitJoinCard />
        <PinsCard />
      </div>
    </div>
  );
}
```
2. In `apps/kiosk/src/features/settings/SettingsPage.tsx` replace:
```tsx
import { NetworkTab } from "./network/NetworkTab";
```
with:
```tsx
import { DevicesTab } from "./devices/DevicesTab";
import { NetworkTab } from "./network/NetworkTab";
```
3. In `apps/kiosk/src/features/settings/SettingsPage.tsx` replace:
```tsx
      return <PlaceholderPage title="Devices" spec="S3d" milestone="M06" />;
```
with:
```tsx
      return <DevicesTab />;
```

**Verify:** `pnpm verify` → exit 0. Then the Checkpoint listed for this task.

**Commit:** `git add -A && git commit -m "feat(kiosk): devices tab"`

---

### T46 — About selectors: uptime text and the QR path (S3e)
- [ ] done

**Files:** `apps/kiosk/src/features/settings/about/about.view.ts`, `apps/kiosk/src/features/settings/about/about.view.test.ts`, `apps/kiosk/package.json`, `pnpm-lock.yaml`

**Context:** SPEC S3e (controller uptime; "QR code for `http://r-101.local` with the URL as text beneath it"); milestone note "Use
`qrcode` (SVG output) for the About QR; the URL comes from `AboutInfo.url`, not hardcoded". Decision D20: `QRCode.create`
gives the module matrix and the page draws it as one SVG `<path>`, so the colours are tokens (no SVG string with
`#000`, no `dangerouslySetInnerHTML`). Error correction M; 4-module quiet zone. `http://r-101.local` is 18 bytes →
version 2 (25×25).

**Do:**
1. Run `pnpm --filter @eduscope/kiosk add 'qrcode@^1.5.4'`
2. Run `pnpm --filter @eduscope/kiosk add -D '@types/qrcode@^1.5.6'`
3. Create `apps/kiosk/src/features/settings/about/about.view.ts`:
```ts
import QRCode from "qrcode";

// S3e: uptime text and the QR code for the room URL (milestone: `qrcode`, SVG output).

/** "under a minute", "12 min", "5 h 12 min", "3 d 4 h". */
export function formatUptime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  if (minutes < 1) return "under a minute";
  const hours = Math.floor(minutes / 60);
  if (hours < 1) return `${minutes} min`;
  const days = Math.floor(hours / 24);
  if (days < 1) return `${hours} h ${minutes % 60} min`;
  return `${days} d ${hours % 24} h`;
}

/** Quiet zone around the code, in modules (ISO/IEC 18004 asks for 4). */
export const QR_QUIET_MODULES = 4;

export interface QrPath {
  /** Modules per side, without the quiet zone. */
  size: number;
  /** One `M x y h1 v1 h-1 z` square per dark module, already offset by the quiet zone. */
  d: string;
}

/** The QR matrix as one SVG path (error correction M), so the page draws it with token colours. */
export function qrPath(text: string): QrPath {
  const { modules } = QRCode.create(text, { errorCorrectionLevel: "M" });
  const squares: string[] = [];
  for (let row = 0; row < modules.size; row += 1) {
    for (let col = 0; col < modules.size; col += 1) {
      if (modules.get(row, col) === 1) squares.push(`M${col + QR_QUIET_MODULES} ${row + QR_QUIET_MODULES}h1v1h-1z`);
    }
  }
  return { size: modules.size, d: squares.join("") };
}
```
4. Create `apps/kiosk/src/features/settings/about/about.view.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { formatUptime, qrPath } from "./about.view";

describe("formatUptime (S3e)", () => {
  it.each<[number, string]>([
    [30, "under a minute"],
    [12 * 60, "12 min"],
    [5 * 3600 + 12 * 60, "5 h 12 min"],
    [(3 * 24 + 4) * 3600 + 59, "3 d 4 h"],
  ])("%d s → %s", (seconds, text) => {
    expect(formatUptime(seconds)).toBe(text);
  });
});

describe("qrPath", () => {
  it("encodes http://r-101.local as a 25×25 code (version 2, level M)", () => {
    const qr = qrPath("http://r-101.local");
    expect(qr.size).toBe(25);
    // Finder pattern: the top-left module is dark, offset by the 4-module quiet zone.
    expect(qr.d.startsWith("M4 4h1v1h-1z")).toBe(true);
  });
  it("is deterministic and depends on the text", () => {
    expect(qrPath("http://r-101.local").d).toBe(qrPath("http://r-101.local").d);
    expect(qrPath("http://r-102.local").d).not.toBe(qrPath("http://r-101.local").d);
  });
});
```

**Test:** `about.view.test.ts`: uptime under a minute / 12 min / 5 h 12 min / 3 d 4 h; QR is 25 modules with the finder at (4,4); deterministic; different text → different path.

**Verify:** `pnpm --filter @eduscope/kiosk exec vitest run src/features/settings/about` → 6 tests pass; `grep '"qrcode"' apps/kiosk/package.json` → one line; then `pnpm verify` → exit 0.

**Commit:** `git add -A && git commit -m "feat(kiosk): about selectors and QR path"`

---

### T47 — `QrCode` (S3e)
- [ ] done

**Files:** `apps/kiosk/src/features/settings/about/QrCode.tsx`

**Context:** S3e QR. Dark modules in `bg` on a `text-1` square (`fill-bg`, `bg-text-1`: tokens only) — light background so phone
cameras read it on the dark UI. `shapeRendering="crispEdges"` keeps module edges sharp.

**States:** static for a URL (memoised).

**Layout:** `size-48` (192px) below `lg`, `lg:size-56` (224px).

**Do:**
1. Create `apps/kiosk/src/features/settings/about/QrCode.tsx`:
```tsx
import { useMemo } from "react";
import { QR_QUIET_MODULES, qrPath } from "./about.view";

/** S3e QR: dark modules (`bg`) on a light square (`text-1`) so phone cameras read it on the dark UI. */
export function QrCode({ url }: { url: string }) {
  const qr = useMemo(() => qrPath(url), [url]);
  const side = qr.size + 2 * QR_QUIET_MODULES;
  return (
    <svg
      role="img"
      aria-label={`QR code for ${url}`}
      viewBox={`0 0 ${side} ${side}`}
      shapeRendering="crispEdges"
      className="size-48 rounded-btn bg-text-1 lg:size-56"
    >
      <path d={qr.d} className="fill-bg" />
    </svg>
  );
}
```

**Verify:** `pnpm verify` → exit 0.

**Commit:** `git add -A && git commit -m "feat(kiosk): QR code"`

---

### T48 — `RestartButton` with confirm (S3e)
- [ ] done

**Files:** `apps/kiosk/src/features/settings/about/RestartButton.tsx`

**Context:** SPEC S3e ("Restart controller" button (asks to confirm)), AC7 (confirm → reconnecting banner → "Back online"). Reuse
`ConfirmDialog` (T11): "Restart the controller?" / "Every screen in the room disconnects for about half a minute, then
reconnects by itself." / **Restart**. The banner is the existing `ConnectionBanner` (H3/H4); nothing new is needed after
the 202 (decision D21).

**States:** idle, confirm open, restarting (Restart pulses), failed ("Couldn't restart · try again"), offline (disabled).

**Layout:** Full-width 48px `CommandButton`, `border-danger text-danger`, at every width.

**Do:**
1. Create `apps/kiosk/src/features/settings/about/RestartButton.tsx`:
```tsx
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { CommandButton } from "@/components/CommandButton";
import { useApiClient } from "@/data/api-context";
import { ConfirmDialog } from "../shared/ConfirmDialog";
import { useWritable } from "../shared/use-writable";

/** S3e "Restart controller" → confirm → the connection banner shows Reconnecting…, then Back online (H3/H4). */
export function RestartButton() {
  const [confirming, setConfirming] = useState(false);
  const api = useApiClient();
  const writable = useWritable();
  const restart = useMutation({ mutationFn: () => api.system.restart() });
  return (
    <>
      <CommandButton label="Restart controller" disabled={!writable} onPress={() => setConfirming(true)} className="border-danger text-danger" />
      <ConfirmDialog
        open={confirming}
        onOpenChange={(open) => {
          setConfirming(open);
          if (!open) restart.reset();
        }}
        title="Restart the controller?"
        description="Every screen in the room disconnects for about half a minute, then reconnects by itself."
        confirmLabel="Restart"
        pending={restart.isPending}
        error={restart.isError ? "Couldn't restart · try again" : null}
        onConfirm={() => restart.mutate(undefined, { onSuccess: () => setConfirming(false) })}
      />
    </>
  );
}
```

**Verify:** `pnpm verify` → exit 0 (rendered in T49).

**Commit:** `git add -A && git commit -m "feat(kiosk): restart controller button"`

---

### T49 — `AboutTab` (S3e), wired into Settings
- [ ] done

**Files:** `apps/kiosk/src/features/settings/about/AboutTab.tsx`, `apps/kiosk/src/features/settings/SettingsPage.tsx`

**Context:** SPEC S3e (Room `R-101`; Software version, controller uptime, Pi model; QR + URL text; Restart). Reuse `SettingsRow`,
`QueryStatus`, `Skeleton`, `useAboutInfo` (T7, refetched on every visit so uptime is current).

**States:** loading (rows skeleton + QR skeleton, URL `—`), failed (Retry), loaded, Pi model unknown (`—`).

**Layout:** `grid grid-cols-1 items-start gap-4 lg:grid-cols-2 lg:gap-6`: phone = About card (rows + Restart) then the QR card; lg = side by side.

**Do:**
1. Create `apps/kiosk/src/features/settings/about/AboutTab.tsx`:
```tsx
import { Card } from "@/components/Card";
import { SectionLabel } from "@/components/SectionLabel";
import { useAboutInfo } from "@/data/settings/hooks";
import { Skeleton } from "@/ui/skeleton";
import { QueryStatus } from "../shared/QueryStatus";
import { SettingsRow } from "../shared/SettingsRow";
import { formatUptime } from "./about.view";
import { QrCode } from "./QrCode";
import { RestartButton } from "./RestartButton";

/** S3e: room, version, uptime, Pi model, QR for the room URL (from AboutInfo.url), Restart. lg: two columns. */
export function AboutTab() {
  const query = useAboutInfo();
  const about = query.data;
  return (
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2 lg:gap-6">
      <Card className="flex flex-col gap-3">
        <SectionLabel>About</SectionLabel>
        {about === undefined ? (
          <QueryStatus status={query.isError ? "error" : "pending"} what="controller details" onRetry={() => void query.refetch()} rows={4} />
        ) : (
          <div>
            <SettingsRow label="Room" value={about.room} mono />
            <SettingsRow label="Software version" value={about.version} mono />
            <SettingsRow label="Controller uptime" value={formatUptime(about.uptime_s)} />
            <SettingsRow label="Pi model" value={about.pi_model} />
          </div>
        )}
        <RestartButton />
      </Card>
      <Card className="flex flex-col items-center gap-3">
        <SectionLabel className="self-start">Open on a phone</SectionLabel>
        {about === undefined ? <Skeleton className="size-48 lg:size-56" /> : <QrCode url={about.url} />}
        <p className="font-mono text-button text-text-1">{about?.url ?? "—"}</p>
      </Card>
    </div>
  );
}
```
2. In `apps/kiosk/src/features/settings/SettingsPage.tsx` replace:
```tsx
import { DevicesTab } from "./devices/DevicesTab";
```
with:
```tsx
import { AboutTab } from "./about/AboutTab";
import { DevicesTab } from "./devices/DevicesTab";
```
3. In `apps/kiosk/src/features/settings/SettingsPage.tsx` replace:
```tsx
      return <PlaceholderPage title="About" spec="S3e" milestone="M06" />;
```
with:
```tsx
      return <AboutTab />;
```
4. In `apps/kiosk/src/features/settings/SettingsPage.tsx` replace:
```tsx
import { PlaceholderPage } from "@/components/PlaceholderPage";
```
with:
```tsx
```

**Verify:** `pnpm verify` → exit 0. Then the Checkpoint listed for this task.

**Commit:** `git add -A && git commit -m "feat(kiosk): about tab"`

---

### T50 — No `/favicon.ico` 404 (console error)
- [ ] done

**Files:** `apps/kiosk/index.html`

**Context:** AC10 requires "no console errors"; every page load logs `Failed to load resource … /favicon.ico 404` (REVIEW-M03 L3,
M00 backlog M03-L3). Decision D22: an empty `data:` icon stops the request; there is no favicon design yet and an SVG
icon would need colour literals outside `tokens.css`.

**Do:**
1. In `apps/kiosk/index.html` replace:
```html
    <meta name="color-scheme" content="dark" />
```
with:
```html
    <meta name="color-scheme" content="dark" />
    <!-- No favicon file yet: an empty data URL stops the /favicon.ico 404 (console error, M03-L3). -->
    <link rel="icon" href="data:," />
```

**Verify:** `pnpm verify` → exit 0. Human: `pnpm --filter @eduscope/kiosk dev`, reload `/` with DevTools → Console: no `favicon.ico` error.

**Commit:** `git add -A && git commit -m "fix(kiosk): stop the favicon 404"`

---

### T51 — Acceptance walk-through (M06 criteria, FRONTEND COMPLETE GATE)
- [ ] done

**Files:** this plan file only (tick the boxes below; write any failure under `## Blockers` and stop).

**Context:** Every M06 acceptance criterion with its exact check. Start once: `pnpm --filter @eduscope/kiosk dev`
(mock). Use Chromium DevTools device mode (1280×800; 390×844 with touch). "Panel" = the mock panel (`?mock-panel` once
per tab); collapse it ("Mock panel −") before comparing layouts. Reach Settings with the header **Settings** button →
PIN `123456` (a reload drops the mock session to `view`). Console one-liners are pasted into DevTools. The numbers
below were measured on the plan's reference run.

**Do:** check each item; tick it when it holds.

- [ ] **AC1 — 1280×800 `/settings/remote` matches screenshot 03.** Open `/?mock-panel`, collapse the panel, Settings →
  `123456`. Compare with `reference/screens/03-settings-remote-config.png`: header "← Controls · Settings … Technician
  access [Lock] `R-101`"; tabs with "Remote configuration" active (attached, `surface`); left column DEVICE: "Air
  conditioning" / "Panasonic · via ZS06" / `14` (green), "Projector" / "Epson · via ZS06" / `2` (green) **selected**
  (teal fill, green border), dashed "+ Add device", BLASTER (green dot `ZS06`, `LQI 196`, Topic `r101_ir`, Coverage
  `360°, 12 m`, mains caption), FALLBACK; right column "Projector" + "Epson · two commands · via ZS06", table COMMAND ·
  CAPTURE with "Power on" / "Power off" · "Tuya code · captured" · **Test** · **Re-learn**, dashed "+ Add a command",
  HOW CAPTURE WORKS (verbatim, 3 paragraphs). Console:
  `[...document.querySelector("main > div > div.grid").children].slice(0,2).map(e=>Math.round(e.getBoundingClientRect().width))`
  → `[271, 937]` (±2); `document.documentElement.scrollHeight` → `800`. Expected differences: header 64px (screenshot
  ~76), "Lock" button next to "Technician access" (SPEC S3.E3 `[INFERRED]`), the left column is 22% (ARCHITECTURE §4.1)
  where the screenshot is ~18%.
- [ ] **AC2 — capture.** On "Power on" tap **Re-learn**: the row reads "Listening… point the remote at the ZS06 and
  press the button" with `0:20` counting down and only **Cancel**; the other row's buttons are disabled. After ~3 s:
  status "Tuya code · captured · untested" (amber), green "Captured · now test it", **Test** highlighted (green fill);
  the Projector count `2` turns amber.
- [ ] **AC3 — test.** **Test** → "Did the Projector react?" **Yes** / **No**. **Yes** → "Tuya code · tested ✓ just now",
  count green again. On "Power off": **Test** → **No** → "Tuya code · no reaction" in red (count amber). Panel "Next
  capture: nothing received", then **Re-learn** on "Power on" → after ~3 s "Nothing received" (red) + **Try again**;
  the status line still reads "Tuya code · tested ✓ …" (old code kept).
- [ ] **AC4 — blaster offline.** Panel "Toggle blaster offline": BLASTER card red border, red dot, "Offline · last seen
  …"; every Test / Re-learn / Try again button and "+ Add a command" disabled (40%). Toggle back.
- [ ] **AC5 — add device, add command.** "+ Add device" → Save with empty fields shows "Enter a name" / "Enter a brand".
  Enter Name `Screen relay`, Brand `Generic`, Transport **MCU**, Kind **Other** → Save: the detail opens
  (`/settings/remote/mock-dev-1`), the list shows "Screen relay" / "Generic · via MCU" / `0` (grey), detail "Generic ·
  no commands · via MCU" and "No commands yet" (decision D14 reads the milestone's "Screen relay · Other · via MCU" as
  name · kind · transport). Select **Air conditioning** → "+ Add a command" → sheet "Add a command · Air conditioning":
  tap **+** once (24 → `25 °C`), Mode **Cool**, Fan **Auto** (defaults) → description "Saves as “25°”, …" → **Save and
  learn**: a new last row "25°" is listening; tap **Cancel** → "Not captured" (amber), buttons **Test** (disabled) and
  **Learn**; the AC count turns amber.
- [ ] **AC6 — Network, Schedule, Devices, About.** Network: Hostname `r-101.local`, Address `192.168.10.41`,
  Connection "Ethernet", Controller "Online" (green), Connected clients `4` + "room screen · phone ×2 · laptop".
  Schedule: blocks `08:00–10:00` weekdays, `10:15–12:15` weekdays, `13:00–15:00` Mon, Wed; action "All off · 18:00
  weekdays" On. "+ Add block": Start `10:00`, End `09:00` → Save → "End must be after start"; End `11:30` → Save → row
  `10:00–11:30` weekdays. Tap the "All off" row → it pulses, then reads Off. "+ Add action": **Lights off**, Time `21:00`
  → Save → "Lights off · 21:00 weekdays"; its trash button removes it. Switch to Network and back: the changes are still
  there. Devices: tap "Projector" → Name `Main projector` → Save → the row reads "Main projector"; Remote configuration
  lists "Main projector" too. **Permit joining** → "Joining open · 3:59 left" (amber) counting down; `/devices` (header
  ← Controls, then Devices) shows Joining "Open · 3:5x left". Back in Settings → Devices: Room PIN **Change** → 4 dots
  "New room PIN"; type `4321` → "Enter the new room PIN again"; `4320` → shake + "The PINs don't match · start again";
  `4321` `4321` → toast "Room PIN changed". Technician PIN **Change** → 6 dots → Cancel. About: Room `R-101`, Software
  version `0.6.0`, Controller uptime "3 d 4 h", Pi model "Raspberry Pi 5 Model B Rev 1.0", QR with `http://r-101.local`
  under it; a phone camera pointed at the screen offers `http://r-101.local`. (Reference run: a screenshot of the About
  tab decoded with `zbarimg` → `QR-Code:http://r-101.local`.) After the room PIN change, Lock and unlock a control with
  `4321` (the old `1234` is "Wrong PIN").
- [ ] **AC7 — restart.** About → **Restart controller** → dialog "Restart the controller?" → **Restart**: the dialog
  closes, the amber "Reconnecting…" banner shows and the page greys; ~6–8 s later "Back online" (green, 2 s), then the
  banner hides; still on `/settings/about`, uptime "under a minute".
- [ ] **AC8 — 390px.** 390×844 (touch), Settings → `123456`. Tab strip: drag it sideways — it scrolls inside itself; open
  About, the strip is scrolled so "About" is visible. Console on every tab:
  `document.documentElement.scrollWidth === innerWidth` → `true`. Remote configuration shows the device list first
  (+ Add device, BLASTER, FALLBACK below). Tap **Projector** → `/settings/remote/projector` with "← All devices";
  rows are two lines (name + status; then **Test** | **Re-learn** at half width). Console:
  `[...document.querySelectorAll("main a, main button, header a, header button")].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&(r.width<48||r.height<48)}).length`
  → `0`. HOW CAPTURE WORKS shows the first sentence + **More**; More shows the rest. "← All devices" returns to the list.
- [ ] **AC9 — losing technician.** On each tab (Remote configuration, Network, Schedule, Devices, About): panel "Expire
  session" → the app is on `/` (S1) with the "Locked · enter PIN to control" toast.
- [ ] **AC10 — FRONTEND COMPLETE GATE.** Stop the dev server. `VITE_API_MODE=mock pnpm --filter @eduscope/kiosk build`
  → exit 0 (the >500 kB chunk warning is M02-L1), then `pnpm --filter @eduscope/kiosk preview` (prints
  `http://localhost:4173`). In a second terminal: `chromium --kiosk --window-size=1280,800 http://localhost:4173/?mock-panel`
  with DevTools open (`Ctrl+Shift+I`, Console): click through S1 (`/`), S2 (Devices), S4 (Settings → PIN) and S3–S3e (all
  five tabs, one sheet each); then the same at 390×844 in device mode. Console shows **no** errors or warnings
  (`[vite]`/React DevTools info lines are not errors; there are none in preview). Close Chromium and stop the preview.
- [ ] **AC11 — `pnpm verify` green** with the M06 tests: `command-row.test.ts` (capture/test row state machine),
  `remote.view.test.ts` (all S3.E14 status variants, device count colour rule), `schedule-form.test.ts` (time/day
  validation), `pin-change.test.ts` (confirm logic), plus `fake-ir`, `fake-schedule`, `fake-room-settings`,
  `capture-store`, `apply-event`, `http-client`, `queries`, `forms`, `network.view`, `schedule.view`, `devices.view`,
  `about.view`. `pnpm build` → exit 0.
- [ ] **S1/S2 regression.** `/` at 1280×800: `[document.documentElement.scrollHeight, innerHeight]` → `[800, 800]`
  (D-20). `/devices` unchanged (REVIEW-M05).

**Verify:** all boxes ticked; `pnpm verify` → exit 0.

**Commit:** `git add -A && git commit -m "chore: M06 acceptance walk-through"`

---

## Checkpoints

- After T14: "Human: run `pnpm --filter @eduscope/kiosk dev`; Settings → `123456`. Compare the header and the tab strip
  with screen 03 at 1280×800 (tabs below the header, "Remote configuration" attached); at 390×844 the header fits one row
  and the strip scrolls inside itself."
- After T28: "Human: compare `/settings/remote` with screen 03 at 1280×800 (left column 22%, Projector selected,
  rows, + Add a command, HOW CAPTURE WORKS); run Re-learn → Test → Yes on Power on; at 390×844 tap Projector → detail
  with ← All devices and two-line rows."
- After T37: "Human: Network and Schedule at 1280×800 and 390×844; add a block, toggle and delete an action."
- After T45: "Human: Devices at 1280×800 and 390×844; rename a device, Permit joining, change the room PIN
  (then Lock and unlock a control with it)."
- After T49: "Human: About at 1280×800 and 390×844; scan the QR with a phone; Restart controller."

## Blockers

(executor writes here; leave empty)

## Nice-to-haves (not tasks)

- Delete an IR command (contract `DELETE /api/ir/commands/:id` exists; no SPEC element asks for it yet).
- Edit an existing class block or timed action (today: delete and add again).
- Mark this client in the S3b clients list ("laptop · this device").
- Show the joining countdown on the S2 header while joining is open (M05 nice-to-have, still open).
- Keep the 1 s countdown in the listening row in sync with a 20 s ring/progress bar for glanceability.
- Code-split `features/settings/` and the mock adapter (M02-L1; the chunk grows by `qrcode`).
