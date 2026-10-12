# PLAN-M03 — Access & kiosk behaviour
Milestone: `docs/milestones/M03-access-kiosk.md` · Start tag: `m03-start` · Verify-all: `pnpm verify`

Inputs read for this plan: M03; SPEC §2.2 (phone S1 header, S4), §2.3, §2.6, §3.1–3.4, S1.E7, S1.E8, S1
view-only presentation, S3.E1–E3, S4.E1–E5, H12, H17, H23, H24, R14, R15; ARCHITECTURE §1, §3.3, §4.3–4.8,
§5; CLAUDE.md; PLAN-M02 + REVIEW-M02; `reference/screens/03-settings-remote-config.png` (S3.E3
"Technician access"; there is no screenshot of S4, it is `[INFERRED]`); the current code (`apps/kiosk`,
`packages/contracts`). No contract changes are needed: `ClientSession`, `LoginRequest`, `PinError`,
`LoginResult`, `LockResponse` and the `session` WS event already exist in `@eduscope/contracts`.

## Executor notes (read once, apply to every task)

- Paths are relative to the repo root `/home/rust-cohle/edcontrol`. Kiosk code imports with the `@/` alias
  and **no** file extension. `verbatimModuleSyntax` and `exactOptionalPropertyTypes` are on.
- **Every code block in this plan was compiled, linted and tested** in a throw-away worktree on 2026-10-12,
  and the whole plan was then **replayed task by task** in a second fresh worktree with `pnpm verify` green
  after every task (final: kiosk 28 test files / 258 tests). The app was also driven in Chromium at 1280×800
  and 390×844 through AC1–AC8. Write code blocks **verbatim**: "Create" / "Replace the whole file" = the
  block is the full file content; "replace … with …" = an exact, unique text replacement; "Append" = add at
  the end of the file.
- Tests run in Vitest's `node` environment (no DOM). Only pure logic is tested; components are checked by
  eye (CLAUDE.md: no tests of pure markup).
- No `as` casts other than `as const`. No hex/rgb literals outside `tokens.css`. Tailwind class strings stay
  literal. Arbitrary values in this plan (`z-[100]`, `z-[1000000000]`, `max-h-[calc(100dvh-2rem)]`) are
  sizes/layers, not colours, and are allowed.
- **Decisions this plan makes** (do not re-open them):
  - **D1 — access logic lives in `apps/kiosk/src/data/access/`, not `features/pin/`.** ARCHITECTURE §1
    lists "pin store, useRequireAccess" under `features/pin/`, but §4.8 / CLAUDE.md forbid feature→feature
    imports and `data/`→`features/` imports, and three other places need it: `useCommand` (`data/hooks.ts`,
    locked taps), the header Settings button (`app/`) and `SettingsGuard` (`features/settings/`). So
    `decideAccess`, the PIN request store and the session actions go in `data/access/`, the hooks in
    `data/hooks.ts`, and `features/pin/` keeps the overlay and its reducer. This is deliberate, not a
    contradiction to stop on.
  - **D2 — `PinPad`, `PinDots` and `LockButton` live in `components/`.** ARCHITECTURE §1 already lists
    `PinPad` there; M06 reuses the pad for PIN-change sheets, and the Lock button is used by both the header
    (`features/session`) and S3.E3 (`features/settings`).
  - **D3 — locked ≠ disabled.** A `view` session's controls stay tappable at full colour with a padlock
    (SPEC S1 view-only, H12). `gateDisablesControl(gate)` disables only for `disconnected`/`offline`;
    `useCommand.send()` opens S4 when locked and never sends; sliders get `onPressLocked`.
  - **D4 — own Lock shows no H24 toast.** `lock()` sets a flag; the session watcher consumes it on the next
    access change. Expiry pushed by the server (or "Expire session" in the mock) toasts.
  - **D5 — http `login` accepts a `PinError` body with any HTTP status** (200/401/429), so M08 can choose.
  - **D6 — mock lockout is per level** (like core-api's per `(ip, level)`), 60 s from the 5th wrong answer.
    The countdown rounds up, so it shows `1:00` for the first second, then `0:59`, … and re-enables at
    `0:00`.
  - **D7 — kiosk Lock / expiry drop technician to `control`;** remote ones drop to `view` (ARCHITECTURE §5).
    The mock pushes a `session` event on lock, expire and "be kiosk/remote" (login only returns it).
  - **D8 — black is a token:** `--color-sleep: #000000` (`bg-sleep`, `bg-sleep/80`), the only new colour.
  - **D9 — z-order:** PIN overlay `z-[100]` < sonner toasts (999999999) < sleep overlay `z-[1000000000]` <
    dev mock panel `z-[1000000001]`. The mock panel is marked `data-wake-exempt`, so the kiosk ignores taps
    on it (otherwise "Occupancy detected" could never be tested while dimmed).
  - **D10 — `?idle-scale=` works in dev builds only** and is read once at page load.
  - **D11 — header Settings is a button, not a link:** it asks for the technician PIN first and navigates
    only on success, so Cancel adds no history entry (AC3). Typed `/settings/*` URLs hit `SettingsGuard`.
  - **D12 — S3.E3** ("Technician access" + Lock) is added as a row above the Settings placeholder card; M06
    moves it into the real S3 header. It is the kiosk technician's way to lock.
- After each task: run the task's **Verify**, then `pnpm verify`; when both are green tick the task's
  checkbox in this file and commit **with this plan file included**, e.g.
  `git add -A && git commit -m "<message from the task>"`.

## File map

| File | Create/Modify | Responsibility |
|---|---|---|
| `apps/kiosk/src/data/adapters/mock/fake-room.ts` (+ test) | Modify | Mock sessions: default `view`, PIN `1234`/`123456`, 5 wrong → 60 s, Lock, expire, be kiosk/remote, occupancy (T1, T2) |
| `apps/kiosk/src/data/api-client.ts` | Modify | `login`, `lock` on `ApiClient` (T3) |
| `apps/kiosk/src/data/adapters/http/http-client.ts` (+ test) | Modify | `POST /api/session/login`, `/lock`, PinError with any status (T3) |
| `apps/kiosk/src/data/adapters/mock/mock-client.ts` | Modify | Delegate `login`/`lock` to FakeRoom (T3) |
| `apps/kiosk/src/data/realtime/cache-port.test.ts` | Modify | Test fake gains `login`/`lock` (T3) |
| `apps/kiosk/src/lib/format.ts` (+ test) | Modify | `formatCountdown` `m:ss` (T4) |
| `apps/kiosk/src/data/access/decide-access.ts` (+ test) | Create | `decideAccess(required, access)` → granted / prompt / wait (T5) |
| `apps/kiosk/src/data/access/pin-requests.ts` (+ test) | Create | The one open S4 request; `request(level)` → Promise<boolean> (T6) |
| `apps/kiosk/src/data/access/session-actions.ts` (+ test) | Create | Login outcome, Lock, own-lock flag (T7) |
| `apps/kiosk/src/data/gate.ts` (+ test) | Modify | `gateDisablesControl` (T8) |
| `apps/kiosk/src/data/hooks.ts` | Modify | `useRequireAccess`, `useSessionActions`, `useLock`; `useCommand` locked → S4 (T9) |
| `apps/kiosk/src/features/pin/pin-input.ts` (+ test) | Create | PIN entry reducer + message copy (T10) |
| `apps/kiosk/src/styles/tokens.css`, `token-names.ts` (+ test) | Modify | `--color-sleep`, `--animate-shake` (T11) |
| `apps/kiosk/src/components/PinDots.tsx` | Create | S4.E3 dots (T12) |
| `apps/kiosk/src/components/PinPad.tsx` | Create | S4.E4 keypad, 64×64 keys (T13) |
| `apps/kiosk/src/components/LockButton.tsx` | Create | S1.E8 / S3.E3 button (T14) |
| `apps/kiosk/src/features/pin/PinOverlay.tsx` | Create | S4 overlay, phone lower-half keypad, centred card ≥600 (T15) |
| `apps/kiosk/src/features/session/session-change.ts` (+ test) | Create | H24 toast / leave-settings rule (T16) |
| `apps/kiosk/src/features/session/use-session-watcher.ts` | Create | Applies the rule on every `session` change (T17) |
| `apps/kiosk/src/features/session/HeaderLockButton.tsx` | Create | S1.E8 visibility (remote control/technician) (T18) |
| `apps/kiosk/src/app/Header.tsx` | Modify | Guarded Settings button, Lock (T19) |
| `apps/kiosk/src/features/settings/SettingsGuard.tsx` | Create | Technician gate on `/settings/*` (T20) |
| `apps/kiosk/src/app/router.tsx` | Modify | Settings routes under the guard (T20) |
| `apps/kiosk/src/features/settings/TechnicianAccess.tsx`, `SettingsPage.tsx` | Create / Modify | S3.E3 row (T21) |
| `apps/kiosk/src/components/LevelSlider.tsx` | Modify | `onPressLocked` (T22) |
| `apps/kiosk/src/app/dev/LiveDemo.tsx` | Modify | Padlocks + locked taps on the demo controls (T23) |
| `apps/kiosk/src/features/kiosk/idle-timer.ts` (+ test) | Create | 2 / 5 / 15 min timers, injectable (T24) |
| `apps/kiosk/src/features/kiosk/wake-guard.ts` (+ test) | Create | Swallow the waking tap (T25) |
| `apps/kiosk/src/features/kiosk/kiosk-params.ts` (+ test) | Create | `?idle-scale`, occupancy wake rule (T26) |
| `apps/kiosk/src/features/kiosk/SleepOverlay.tsx` | Create | Dim / black overlay (T27) |
| `apps/kiosk/src/features/kiosk/KioskBehaviour.tsx` | Create | Wires timers, guard, occupancy, CSS hook, context menu (T28) |
| `apps/kiosk/src/styles/index.css` | Modify | `touch-action`, `html.kiosk` guards (T29) |
| `apps/kiosk/src/app/AppShell.tsx` | Modify | Mount PinOverlay, watcher, KioskBehaviour (T30) |
| `apps/kiosk/src/app/dev/MockPanel.tsx` | Modify | Expire / be kiosk / be remote / occupancy buttons (T31) |
| `apps/kiosk/src/features/{pin,session,kiosk}/.gitkeep` | Delete | Folders now have real files (T10, T16, T24) |

## Tasks

### T1 — Mock: PIN login, lockout and Lock in `FakeRoom`
- [x] done

**Files:** `apps/kiosk/src/data/adapters/mock/fake-room.ts`, `apps/kiosk/src/data/adapters/mock/fake-room.test.ts`

**Context:** ARCHITECTURE §4.4 (mock PINs `1234` / `123456`), §5 (Lock: kiosk drops back to `control`; lock pushes `session` to that session's sockets; 5 wrong → 60 s per `(ip, level)`), SPEC §2.3 (remote without PIN = `view`), H17. M02 decision 3 promised: "M03 makes `view` the mock default". After this task the `/dev/components` demo controls are disabled for `view` until T23 makes locked controls tappable — expected.

**Do:**
1. In `apps/kiosk/src/data/adapters/mock/fake-room.ts` replace:
```ts
import {
  ClientSession, Command, CommandRequest, RoomState, ServerEvent, type ClientLabel,
} from "@eduscope/contracts";
```
   with:
```ts
import {
  ClientSession, Command, CommandRequest, LoginRequest, RoomState, ServerEvent, type ClientLabel,
  type LoginResult,
} from "@eduscope/contracts";
```
2. In `apps/kiosk/src/data/adapters/mock/fake-room.ts` replace:
```ts
const OWN_PUBLIC_ID = "mock-self";
```
   with:
```ts
/** ARCHITECTURE §4.4: the mock's PINs (the real ones are hashed in core-api, M08). */
export const MOCK_ROOM_PIN = "1234";
export const MOCK_TECHNICIAN_PIN = "123456";
/** H17 / ARCHITECTURE §5: 5 wrong → locked for 60 s (per level, like core-api's per (ip, level)). */
export const MOCK_MAX_PIN_ATTEMPTS = 5;
export const MOCK_PIN_LOCKOUT_S = 60;
/** SPEC §2.3 session lengths, shown in `expires_at` only (the mock never expires on its own). */
const CONTROL_SESSION_MS = 2 * 60 * 60_000;
const TECHNICIAN_SESSION_MS = 15 * 60_000;
const KIOSK_TECHNICIAN_SESSION_MS = 2 * 60_000;
const OWN_PUBLIC_ID = "mock-self";
```
3. In `apps/kiosk/src/data/adapters/mock/fake-room.ts` replace:
```ts
  private session: ClientSession;
```
   with:
```ts
  private session: ClientSession;
  /** The label from the last `hello` (a remote client's own label; the kiosk is "room screen"). */
  private helloLabel: ClientLabel = "laptop";
  private readonly pinFailures = { control: 0, technician: 0 };
  /** Epoch ms until which PIN entry is locked, per level. */
  private readonly lockedUntil = { control: 0, technician: 0 };
```
4. In `apps/kiosk/src/data/adapters/mock/fake-room.ts` replace:
```ts
    // M02: the mock client may control. M03 makes `view` the default and adds PIN login.
    this.session = ClientSession.parse({
      public_id: OWN_PUBLIC_ID, client_type: "remote", label: "laptop", access: "control",
      unlocked_at: null, last_activity: null, expires_at: null,
    });
```
   with:
```ts
    // SPEC §2.3: a remote browser without a PIN starts at `view`.
    this.session = ClientSession.parse({
      public_id: OWN_PUBLIC_ID, client_type: "remote", label: this.helloLabel, access: "view",
      unlocked_at: null, last_activity: null, expires_at: null,
    });
```
5. In `apps/kiosk/src/data/adapters/mock/fake-room.ts` replace:
```ts
  async getState(): Promise<RoomState> {
```
   with:
```ts
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
```
6. In `apps/kiosk/src/data/adapters/mock/fake-room.ts` replace:
```ts
    this.session = { ...this.session, label };
```
   with:
```ts
    this.helloLabel = label;
    if (this.session.client_type === "remote") this.session = { ...this.session, label };
```
7. In `apps/kiosk/src/data/adapters/mock/fake-room.ts` replace:
```ts
  // ── internals ────────────────────────────────────────────────────────────────────────
```
   with:
```ts
  // ── internals ────────────────────────────────────────────────────────────────────────

  private downgraded(): ClientSession {
    const access = this.session.client_type === "kiosk" ? "control" : "view";
    return { ...this.session, access, unlocked_at: null, last_activity: null, expires_at: null };
  }

  private setSession(next: ClientSession): void {
    this.session = next;
    this.emitAll({ type: "session", session: next });
  }
```
8. Append to the end of `apps/kiosk/src/data/adapters/mock/fake-room.test.ts`:
```ts

/** login() waits one mock latency (600 ms with random = 1). */
async function login(room: FakeRoom, level: "control" | "technician", pin: string) {
  const result = room.login({ level, pin, label: "phone" });
  await vi.advanceTimersByTimeAsync(MOCK_LATENCY_MAX_MS);
  return result;
}
const sessionEvents = (events: ServerEvent[]) => events.flatMap((e) => (e.type === "session" ? [e.session] : []));

describe("FakeRoom sessions", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts as a remote view session labelled from hello", async () => {
    const { room } = connected();
    const session = room.getSession();
    await vi.advanceTimersByTimeAsync(MOCK_LATENCY_MAX_MS);
    expect(await session).toMatchObject({ client_type: "remote", label: "phone", access: "view" });
  });

  it("room PIN 1234 gives control, technician PIN 123456 gives technician", async () => {
    const { room } = connected();
    expect(await login(room, "control", "1234")).toMatchObject({ access: "control" });
    expect(await login(room, "technician", "123456")).toMatchObject({ access: "technician" });
  });

  it("counts wrong PINs down, locks for 60 s on the fifth, then accepts again (H17)", async () => {
    const { room } = connected();
    for (const left of [4, 3, 2, 1]) {
      expect(await login(room, "control", "0000")).toEqual({ reason: "wrong", retry_after_s: null, attempts_left: left });
    }
    expect(await login(room, "control", "0000")).toEqual({ reason: "locked", retry_after_s: 60, attempts_left: 0 });
    // The right PIN is refused while locked; the remaining time counts down.
    await vi.advanceTimersByTimeAsync(9_400);
    expect(await login(room, "control", "1234")).toEqual({ reason: "locked", retry_after_s: 50, attempts_left: 0 });
    // The other level has its own counter.
    expect(await login(room, "technician", "123456")).toMatchObject({ access: "technician" });
    await vi.advanceTimersByTimeAsync(60_000);
    expect(await login(room, "control", "1234")).toMatchObject({ access: "control" });
  });

  it("lock drops a remote session to view and pushes it", async () => {
    const { room, events } = connected();
    await login(room, "control", "1234");
    const locked = room.lock();
    await vi.advanceTimersByTimeAsync(MOCK_LATENCY_MAX_MS);
    expect(await locked).toMatchObject({ access: "view", unlocked_at: null });
    expect(sessionEvents(events).at(-1)).toMatchObject({ access: "view" });
  });
});
```

**Test:** The existing tests stay unchanged; the appended block reuses the file's `connected()` helper.

**Verify:** `pnpm --filter @eduscope/kiosk exec vitest run src/data/adapters/mock/fake-room.test.ts` → 15 passed. `pnpm verify` → exit 0.

**Commit:** `git commit -m "feat(kiosk): mock PIN login, lockout and lock"`

### T2 — Mock: expire session, be kiosk / be remote, occupancy detected
- [x] done

**Files:** `apps/kiosk/src/data/adapters/mock/fake-room.ts`, `apps/kiosk/src/data/adapters/mock/fake-room.test.ts`

**Context:** Milestone scope: mock "expiry simulation in the mock panel ('expire session'), 'be kiosk' / 'be remote' toggle"; AC5–AC7. The kiosk/remote decision comes from `session.client_type` (server decided), never the user agent (milestone notes). Occupancy wakes only on a **transition** to `detected` (H23) and the fixture already says `detected`, so the panel action reports `clear` then `detected` 1 s later. The panel buttons arrive in T31.

**Do:**
1. In `apps/kiosk/src/data/adapters/mock/fake-room.ts` replace:
```ts
  ClientSession, Command, CommandRequest, LoginRequest, RoomState, ServerEvent, type ClientLabel,
  type LoginResult,
```
   with:
```ts
  ClientSession, Command, CommandRequest, LoginRequest, RoomState, ServerEvent, type ClientLabel, type ClientType,
  type LoginResult,
```
2. In `apps/kiosk/src/data/adapters/mock/fake-room.ts` replace:
```ts
export const MOCK_PIN_LOCKOUT_S = 60;
```
   with:
```ts
export const MOCK_PIN_LOCKOUT_S = 60;
/** "Occupancy detected" first reports clear, then detected this much later (a real transition). */
export const MOCK_OCCUPANCY_REDETECT_MS = 1000;
```
3. In `apps/kiosk/src/data/adapters/mock/fake-room.ts` replace:
```ts
  failNextCommand(): void {
```
   with:
```ts
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
```
4. In `apps/kiosk/src/data/adapters/mock/fake-room.ts` replace:
```ts
  private setSession(next: ClientSession): void {
    this.session = next;
    this.emitAll({ type: "session", session: next });
  }
```
   with:
```ts
  private setSession(next: ClientSession): void {
    this.session = next;
    this.emitAll({ type: "session", session: next });
  }

  private setOccupancy(value: "detected" | "clear"): void {
    const { environment } = this.state;
    const occupancy = { ...environment.sensors.occupancy, kind: "occupancy" as const, value, at: this.iso(), stale: false };
    this.commit({ ...this.state, environment: { ...environment, sensors: { ...environment.sensors, occupancy } } });
  }
```
5. In `apps/kiosk/src/data/adapters/mock/fake-room.test.ts` replace:
```ts
import { FakeRoom, MOCK_COMMAND_TIMEOUT_MS, MOCK_LATENCY_MAX_MS, MOCK_PING_MS } from "./fake-room";
```
   with:
```ts
import {
  FakeRoom, MOCK_COMMAND_TIMEOUT_MS, MOCK_LATENCY_MAX_MS, MOCK_OCCUPANCY_REDETECT_MS, MOCK_PING_MS,
} from "./fake-room";
```
6. Append to the end of `apps/kiosk/src/data/adapters/mock/fake-room.test.ts`:
```ts

describe("FakeRoom mock panel: session and occupancy", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("expire session pushes the downgraded session (H24)", async () => {
    const { room, events } = connected();
    await login(room, "technician", "123456");
    room.expireSession();
    expect(sessionEvents(events).at(-1)).toMatchObject({ client_type: "remote", access: "view" });
  });

  it("be kiosk: room screen at control; expire drops technician back to control; be remote: view", async () => {
    const { room, events } = connected();
    room.setClientType("kiosk");
    expect(sessionEvents(events).at(-1)).toMatchObject({ client_type: "kiosk", label: "room screen", access: "control" });
    await login(room, "technician", "123456");
    room.expireSession();
    expect(sessionEvents(events).at(-1)).toMatchObject({ client_type: "kiosk", access: "control" });
    room.setClientType("remote");
    expect(sessionEvents(events).at(-1)).toMatchObject({ client_type: "remote", label: "phone", access: "view" });
  });

  it("occupancy detected reports clear, then detected a second later (H23)", () => {
    const { room } = connected();
    room.occupancyDetected();
    expect(room.peek().environment.sensors.occupancy.value).toBe("clear");
    vi.advanceTimersByTime(MOCK_OCCUPANCY_REDETECT_MS);
    expect(room.peek().environment.sensors.occupancy.value).toBe("detected");
  });
});
```

**Verify:** `pnpm --filter @eduscope/kiosk exec vitest run src/data/adapters/mock/fake-room.test.ts` → 18 passed. `pnpm verify` → exit 0.

**Commit:** `git commit -m "feat(kiosk): mock session expiry, client type and occupancy"`

### T3 — `ApiClient.login` / `lock` in both adapters
- [ ] done

**Files:** `apps/kiosk/src/data/api-client.ts`, `apps/kiosk/src/data/adapters/http/http-client.ts`, `apps/kiosk/src/data/adapters/http/http-client.test.ts`, `apps/kiosk/src/data/adapters/mock/mock-client.ts`, `apps/kiosk/src/data/realtime/cache-port.test.ts`

**Context:** ARCHITECTURE §4.4 (`login(req): Promise<LoginResult>`, `lock(): Promise<ClientSession>`), §3.3 (`POST /api/session/login` {level, pin, label} → ClientSession | PinError; `POST /api/session/lock` → ClientSession). Contracts already exist in `packages/contracts/src/api/session.ts` — use them, don't redefine. **Decision:** core-api (M08) may send a PinError with 200, 401 or 429; the http adapter accepts a PinError body with any status, so M08 can choose. A request that fails `LoginRequest` (wrong digit count) throws `ApiRequestError("validation")` before fetching (unlike `sendCommand`, see REVIEW-M02 L6).

**Do:**
Steps 1, 2 and 4 replace whole files (the http adapter's `request` is split into `fetchJson` / `fail` / `parse` so `login` can read a PinError from any status; behaviour of the existing methods is unchanged and their tests still pass).

1. Replace the whole file `apps/kiosk/src/data/api-client.ts`:
```ts
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
```
2. Replace the whole file `apps/kiosk/src/data/adapters/http/http-client.ts`:
```ts
import {
  ApiError, ClientMessage, CommandRequest, GetSessionResponse, GetStateResponse, LockResponse,
  LoginRequest, PinError, PostCommandResponse, ServerEvent,
} from "@eduscope/contracts";
import type { z } from "zod";
import { ApiRequestError, type ApiClient, type RealtimeConnection } from "@/data/api-client";

// fetch + WebSocket adapter (ARCHITECTURE §4.4). Every response and frame is zod-parsed.
// Exercised by tests only until M08 brings core-api.

/** The slice of the browser WebSocket this adapter uses (a fake implements it in tests). */
export interface SocketLike {
  onopen: ((event: Event) => void) | null;
  onmessage: ((event: MessageEvent) => void) | null;
  onclose: ((event: CloseEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  send(data: string): void;
  close(): void;
}

export interface HttpClientOptions {
  fetch?: typeof fetch;
  /** Prefix for `/api/...`; empty = same origin. */
  baseUrl?: string;
  /** Full WS URL, e.g. `ws://r-101.local/ws`. */
  wsUrl: string;
  createSocket?: (url: string) => SocketLike;
}

/** `ws(s)://<host>/ws` for the page's own origin. */
export function sameOriginWsUrl(location: Pick<Location, "protocol" | "host">): string {
  return `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`;
}

export function createHttpApiClient(options: HttpClientOptions): ApiClient {
  const doFetch = options.fetch ?? globalThis.fetch.bind(globalThis);
  const baseUrl = options.baseUrl ?? "";
  const createSocket = options.createSocket ?? ((url: string): SocketLike => new WebSocket(url));

  async function fetchJson(path: string, init?: RequestInit): Promise<{ response: Response; body: unknown }> {
    let response: Response;
    try {
      response = await doFetch(`${baseUrl}${path}`, { credentials: "same-origin", ...init });
    } catch {
      throw new ApiRequestError("network", "Can't reach the controller", null);
    }
    const body: unknown = await response.json().catch(() => null);
    return { response, body };
  }

  function fail(response: Response, body: unknown): never {
    const error = ApiError.safeParse(body);
    if (error.success) throw new ApiRequestError(error.data.code, error.data.message, response.status);
    throw new ApiRequestError("bad_response", `HTTP ${response.status}`, response.status);
  }

  function parse<S extends z.ZodType>(schema: S, path: string, response: Response, body: unknown): z.infer<S> {
    const parsed = schema.safeParse(body);
    if (!parsed.success) throw new ApiRequestError("bad_response", `Unexpected response from ${path}`, response.status);
    return parsed.data;
  }

  async function request<S extends z.ZodType>(schema: S, path: string, init?: RequestInit): Promise<z.infer<S>> {
    const { response, body } = await fetchJson(path, init);
    if (!response.ok) fail(response, body);
    return parse(schema, path, response, body);
  }

  const postJson = (body: unknown): RequestInit => ({
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  return {
    getSession: () => request(GetSessionResponse, "/api/session"),
    async login(loginRequest) {
      const checked = LoginRequest.safeParse(loginRequest);
      if (!checked.success) throw new ApiRequestError("validation", "The PIN has the wrong number of digits", null);
      const path = "/api/session/login";
      const { response, body } = await fetchJson(path, postJson(checked.data));
      // A wrong or locked PIN is an answer, not a failure: a PinError body counts with any status.
      const pinError = PinError.safeParse(body);
      if (pinError.success) return pinError.data;
      if (!response.ok) fail(response, body);
      return parse(GetSessionResponse, path, response, body);
    },
    lock: () => request(LockResponse, "/api/session/lock", postJson({})),
    getState: () => request(GetStateResponse, "/api/state"),
    sendCommand: async (commandRequest) =>
      request(PostCommandResponse, "/api/commands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(CommandRequest.parse(commandRequest)),
      }),
    connect(label, handlers): RealtimeConnection {
      const socket = createSocket(options.wsUrl);
      let closed = false;
      const send = (message: ClientMessage): void => socket.send(JSON.stringify(ClientMessage.parse(message)));
      const finish = (): void => {
        if (closed) return;
        closed = true;
        handlers.onClose();
      };
      socket.onopen = () => {
        send({ type: "hello", label });
        handlers.onOpen();
      };
      socket.onmessage = (message) => {
        let raw: unknown;
        try {
          raw = JSON.parse(String(message.data));
        } catch {
          console.warn("ws: dropped a non-JSON frame");
          return;
        }
        const parsed = ServerEvent.safeParse(raw);
        if (!parsed.success) {
          console.warn("ws: dropped an invalid frame", parsed.error.issues);
          return;
        }
        if (parsed.data.type === "ping") send({ type: "pong" });
        handlers.onEvent(parsed.data);
      };
      socket.onclose = finish;
      socket.onerror = finish;
      return {
        close() {
          closed = true; // a deliberate close is not reported as a drop
          socket.close();
        },
      };
    },
  };
}
```
3. In `apps/kiosk/src/data/adapters/http/http-client.test.ts` replace:
```ts
describe("http adapter: WebSocket", () => {
```
   with:
```ts
describe("http adapter: session", () => {
  const session = {
    public_id: "p1", client_type: "remote", label: "phone", access: "control",
    unlocked_at: "2026-10-05T10:42:00Z", last_activity: "2026-10-05T10:42:00Z", expires_at: null,
  };

  it("login POSTs the request and returns the new session", async () => {
    const fetchMock = vi.fn(async () => json(200, session));
    const result = await client(fetchMock).login({ level: "control", pin: "1234", label: "phone" });
    expect(result).toEqual(session);
    expect(fetchMock).toHaveBeenCalledWith("/api/session/login", {
      credentials: "same-origin",
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ level: "control", pin: "1234", label: "phone" }),
    });
  });

  it.each([200, 401, 429])("login returns a PinError body sent with status %i", async (status) => {
    const pinError = { reason: "locked", retry_after_s: 60, attempts_left: 0 };
    const fetchMock = vi.fn(async () => json(status, pinError));
    await expect(client(fetchMock).login({ level: "control", pin: "0000", label: "phone" })).resolves.toEqual(pinError);
  });

  it("login maps other errors to ApiRequestError", async () => {
    const fetchMock = vi.fn(async () => json(403, { code: "forbidden", message: "Origin mismatch" }));
    await expect(client(fetchMock).login({ level: "technician", pin: "123456", label: "phone" })).rejects.toMatchObject({
      code: "forbidden",
      status: 403,
    });
  });

  it("login refuses a PIN of the wrong length before fetching", async () => {
    const fetchMock = vi.fn(async () => json(200, session));
    await expect(client(fetchMock).login({ level: "control", pin: "123456", label: "phone" })).rejects.toMatchObject({
      code: "validation",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("lock POSTs and parses the downgraded session", async () => {
    const fetchMock = vi.fn(async () => json(200, { ...session, access: "view" }));
    await expect(client(fetchMock).lock()).resolves.toMatchObject({ access: "view" });
    expect(fetchMock).toHaveBeenCalledWith("/api/session/lock", {
      credentials: "same-origin",
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
  });
});

describe("http adapter: WebSocket", () => {
```
4. Replace the whole file `apps/kiosk/src/data/adapters/mock/mock-client.ts`:
```ts
import type { ApiClient } from "@/data/api-client";
import { FakeRoom } from "./fake-room";

/** The one FakeRoom of this page; the mock panel drives it directly. */
export const fakeRoom = new FakeRoom();

export function createMockApiClient(room: FakeRoom = fakeRoom): ApiClient {
  return {
    getSession: () => room.getSession(),
    login: (request) => room.login(request),
    lock: () => room.lock(),
    getState: () => room.getState(),
    sendCommand: (request) => room.sendCommand(request),
    connect: (label, handlers) => room.connect(label, handlers),
  };
}
```
5. In `apps/kiosk/src/data/realtime/cache-port.test.ts` replace:
```ts
  getSession: vi.fn(),
  getState
```
   with:
```ts
  getSession: vi.fn(),
  login: vi.fn(),
  lock: vi.fn(),
  getState
```

**Verify:** `pnpm --filter @eduscope/kiosk exec vitest run src/data/adapters/http/http-client.test.ts` → 20 passed. `pnpm verify` → exit 0.

**Commit:** `git commit -m "feat(kiosk): login and lock in the api client"`

### T4 — `formatCountdown` (H17 `0:58`)
- [ ] done

**Files:** `apps/kiosk/src/lib/format.ts`, `apps/kiosk/src/lib/format.test.ts`

**Context:** SPEC H17 / S4.E3 "Too many tries · wait 0:58". `m:ss`, whole seconds rounded **up** (so the keypad re-enables exactly when it shows `0:00`).

**Do:**
1. Append to the end of `apps/kiosk/src/lib/format.ts`:
```ts

/** H17 countdown `m:ss`, e.g. `0:58`, `1:00`; negative → `0:00`. */
export function formatCountdown(seconds: number): string {
  const whole = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(whole / 60)}:${pad2(whole % 60)}`;
}
```
2. In `apps/kiosk/src/lib/format.test.ts` replace:
```ts
  formatActivity, formatAgo, formatAttribution, formatCelsius, formatDate, formatPercent,
  formatTime, formatWatts,
```
   with:
```ts
  formatActivity, formatAgo, formatAttribution, formatCelsius, formatCountdown, formatDate, formatPercent,
  formatTime, formatWatts,
```
3. Append to the end of `apps/kiosk/src/lib/format.test.ts`:
```ts

describe("countdown", () => {
  it.each([
    [60, "1:00"],
    [59, "0:59"],
    [58.2, "0:59"],
    [9, "0:09"],
    [0, "0:00"],
    [-3, "0:00"],
    [125, "2:05"],
  ])("%s s → %s", (seconds, expected) => {
    expect(formatCountdown(seconds)).toBe(expected);
  });
});
```

**Verify:** `pnpm --filter @eduscope/kiosk exec vitest run src/lib/format.test.ts` → 26 passed. `pnpm verify` → exit 0.

**Commit:** `git commit -m "feat(kiosk): lockout countdown formatter"`

### T5 — `decideAccess`: the `useRequireAccess` decision table
- [ ] done

**Files:** `apps/kiosk/src/data/access/decide-access.ts`, `apps/kiosk/src/data/access/decide-access.test.ts`

**Context:** ARCHITECTURE §4.7 (`useRequireAccess(level)` → `ensure()`), SPEC §2.3 / R14 (view < control < technician; the kiosk is always ≥ control because the **server** says so). AC9 asks for the decision table in Vitest. While the session is still loading the answer is `wait` (no prompt). See executor note D1 for why this lives in `data/access/`.

**Do:**
1. Create `apps/kiosk/src/data/access/decide-access.ts`:
```ts
import type { AccessLevel } from "@eduscope/contracts";

// useRequireAccess's decision table (ARCHITECTURE §4.7, SPEC §2.3/R14). UX only: core-api
// enforces every permission (CLAUDE.md). M08 swaps the mock session for /api/session, not this.

/** The levels a PIN can grant; `view` needs no PIN. */
export type RequiredAccess = Exclude<AccessLevel, "view">;
/** `granted` = go on; `prompt` = open S4 for this level; `wait` = the session is still loading. */
export type AccessDecision = "granted" | "prompt" | "wait";

const RANK: Record<AccessLevel, number> = { view: 0, control: 1, technician: 2 };

export function decideAccess(required: RequiredAccess, access: AccessLevel | undefined): AccessDecision {
  if (access === undefined) return "wait";
  return RANK[access] >= RANK[required] ? "granted" : "prompt";
}
```
2. Create `apps/kiosk/src/data/access/decide-access.test.ts`:
```ts
import type { AccessLevel } from "@eduscope/contracts";
import { describe, expect, it } from "vitest";
import { decideAccess, type AccessDecision, type RequiredAccess } from "./decide-access";

describe("decideAccess (useRequireAccess decision table)", () => {
  it.each<[RequiredAccess, AccessLevel | undefined, AccessDecision]>([
    ["control", "view", "prompt"],
    ["control", "control", "granted"],
    ["control", "technician", "granted"],
    ["technician", "view", "prompt"],
    ["technician", "control", "prompt"],
    ["technician", "technician", "granted"],
    ["control", undefined, "wait"],
    ["technician", undefined, "wait"],
  ])("needs %s, has %s → %s", (required, access, expected) => {
    expect(decideAccess(required, access)).toBe(expected);
  });
});
```

**Verify:** `pnpm --filter @eduscope/kiosk exec vitest run src/data/access/decide-access.test.ts` → 8 passed. `pnpm verify` → exit 0.

**Commit:** `git commit -m "feat(kiosk): access decision table"`

### T6 — PIN request store (the one open S4)
- [ ] done

**Files:** `apps/kiosk/src/data/access/pin-requests.ts`, `apps/kiosk/src/data/access/pin-requests.test.ts`

**Context:** ARCHITECTURE §4.7: `ensure()` opens the overlay and resolves after unlock; the tapped action is **not** replayed (SPEC S1 view-only presentation). One request at a time: a second tap for the same level joins it; a different level replaces it (the first resolves `false`). `PinOverlay` (T15) renders `current` and calls `finish`.

**Do:**
1. Create `apps/kiosk/src/data/access/pin-requests.ts`:
```ts
import { createStore, type Store } from "@/lib/store";
import type { RequiredAccess } from "./decide-access";

// The one open S4 request (ARCHITECTURE §4.7). `ensure()` asks here; PinOverlay renders the
// current request and finishes it. The tapped action is never replayed: callers only learn
// whether access was granted.

export interface PinRequest {
  /** Changes for every new request, so the overlay starts empty each time. */
  id: number;
  level: RequiredAccess;
}

export interface PinRequests {
  current: Store<PinRequest | null>;
  /** Opens S4 for `level`. Resolves `true` after a successful PIN, `false` on cancel. */
  request(level: RequiredAccess): Promise<boolean>;
  /** Closes S4 and resolves the open request. No-op when none is open. */
  finish(granted: boolean): void;
}

export function createPinRequests(): PinRequests {
  const current = createStore<PinRequest | null>(null);
  let open: { promise: Promise<boolean>; resolve: (granted: boolean) => void } | null = null;
  let seq = 0;

  const finish = (granted: boolean): void => {
    const pending = open;
    open = null;
    current.set(null);
    pending?.resolve(granted);
  };

  return {
    current,
    request(level) {
      const shown = current.get();
      // A second tap while S4 is open for the same level joins the open request.
      if (open !== null && shown !== null && shown.level === level) return open.promise;
      if (open !== null) finish(false);
      let resolve: (granted: boolean) => void = () => undefined;
      const promise = new Promise<boolean>((r) => {
        resolve = r;
      });
      open = { promise, resolve };
      current.set({ id: ++seq, level });
      return promise;
    },
    finish,
  };
}

/** The page's PIN requests. */
export const pinRequests = createPinRequests();
```
2. Create `apps/kiosk/src/data/access/pin-requests.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { createPinRequests } from "./pin-requests";

describe("pin requests", () => {
  it("opens one request and resolves true on success", async () => {
    const requests = createPinRequests();
    const granted = requests.request("control");
    expect(requests.current.get()).toEqual({ id: 1, level: "control" });
    requests.finish(true);
    expect(requests.current.get()).toBeNull();
    await expect(granted).resolves.toBe(true);
  });

  it("resolves false on cancel", async () => {
    const requests = createPinRequests();
    const granted = requests.request("technician");
    requests.finish(false);
    await expect(granted).resolves.toBe(false);
  });

  it("joins an open request for the same level", async () => {
    const requests = createPinRequests();
    const first = requests.request("control");
    const second = requests.request("control");
    expect(second).toBe(first);
    expect(requests.current.get()?.id).toBe(1);
    requests.finish(true);
    await expect(second).resolves.toBe(true);
  });

  it("a different level replaces the open request, which resolves false", async () => {
    const requests = createPinRequests();
    const room = requests.request("control");
    const technician = requests.request("technician");
    await expect(room).resolves.toBe(false);
    expect(requests.current.get()).toEqual({ id: 2, level: "technician" });
    requests.finish(true);
    await expect(technician).resolves.toBe(true);
  });

  it("finish without an open request does nothing", () => {
    const requests = createPinRequests();
    expect(() => requests.finish(true)).not.toThrow();
    expect(requests.current.get()).toBeNull();
  });
});
```

**Verify:** `pnpm --filter @eduscope/kiosk exec vitest run src/data/access/pin-requests.test.ts` → 5 passed. `pnpm verify` → exit 0.

**Commit:** `git commit -m "feat(kiosk): pin request store"`

### T7 — Session actions: login outcome and Lock
- [ ] done

**Files:** `apps/kiosk/src/data/access/session-actions.ts`, `apps/kiosk/src/data/access/session-actions.test.ts`

**Context:** S4 login → outcome the overlay can render (`ok` / `wrong` / `locked` with `retry_after_s` / `error`); S1.E8 Lock. The returned session is server state, so writing it into `["session"]` is allowed (CLAUDE.md forbids *optimistic* writes only). **Own Lock vs expiry:** the real server pushes a `session` event for a Lock too (ARCHITECTURE §5), possibly before the HTTP response, so `lock()` sets a `localLock` flag that the session watcher (T17) consumes to skip the H24 toast.

**Do:**
1. Create `apps/kiosk/src/data/access/session-actions.ts`:
```ts
import type { ClientLabel, ClientSession, LoginResult } from "@eduscope/contracts";
import type { ApiClient } from "@/data/api-client";
import { createStore, type Store } from "@/lib/store";
import type { RequiredAccess } from "./decide-access";

// Login (S4) and Lock (S1.E8). The returned session is server state, so writing it into
// `["session"]` is not optimistic. Every check happens in core-api (M08).

/** Toast when Lock gets no answer. */
export const LOCK_FAILED_MESSAGE = "Couldn't lock · try again";

/** H17 fallback when a locked answer carries no `retry_after_s`. */
export const DEFAULT_LOCKOUT_S = 60;

export type LoginOutcome =
  | { kind: "ok"; session: ClientSession }
  | { kind: "wrong"; attemptsLeft: number | null }
  | { kind: "locked"; retryAfterS: number }
  | { kind: "error" };

export interface SessionActionDeps {
  api: Pick<ApiClient, "login" | "lock">;
  setSession(session: ClientSession): void;
  /** Set while this client's own Lock is in flight, so the drop it causes shows no H24 toast. */
  localLock: Store<boolean>;
}

export async function login(deps: SessionActionDeps, level: RequiredAccess, pin: string, label: ClientLabel): Promise<LoginOutcome> {
  let result: LoginResult;
  try {
    result = await deps.api.login({ level, pin, label });
  } catch {
    return { kind: "error" };
  }
  if ("reason" in result) {
    return result.reason === "locked"
      ? { kind: "locked", retryAfterS: result.retry_after_s ?? DEFAULT_LOCKOUT_S }
      : { kind: "wrong", attemptsLeft: result.attempts_left };
  }
  deps.setSession(result);
  return { kind: "ok", session: result };
}

/** `true` when the server confirmed the lock. */
export async function lock(deps: SessionActionDeps): Promise<boolean> {
  deps.localLock.set(true);
  try {
    deps.setSession(await deps.api.lock());
    return true;
  } catch {
    deps.localLock.set(false);
    return false;
  }
}

/** The page's "own Lock in flight" flag (read and cleared by the session watcher). */
export const localLockStore = createStore(false);

/** `true` once after this client's own Lock; clears the flag. */
export function consumeLocalLock(store: Store<boolean> = localLockStore): boolean {
  const was = store.get();
  store.set(false);
  return was;
}
```
2. Create `apps/kiosk/src/data/access/session-actions.test.ts`:
```ts
import type { ClientSession, LoginResult } from "@eduscope/contracts";
import { describe, expect, it, vi } from "vitest";
import { ApiRequestError } from "@/data/api-client";
import { createStore } from "@/lib/store";
import { consumeLocalLock, DEFAULT_LOCKOUT_S, lock, login, type SessionActionDeps } from "./session-actions";

const session = (access: ClientSession["access"]): ClientSession => ({
  public_id: "me", client_type: "remote", label: "phone", access,
  unlocked_at: null, last_activity: null, expires_at: null,
});

function deps(overrides: Partial<SessionActionDeps["api"]> = {}) {
  const value = {
    api: {
      login: vi.fn(async (): Promise<LoginResult> => session("control")),
      lock: vi.fn(async () => session("view")),
      ...overrides,
    },
    setSession: vi.fn(),
    localLock: createStore(false),
  };
  return value;
}

describe("login", () => {
  it("ok: stores the returned session", async () => {
    const d = deps();
    await expect(login(d, "control", "1234", "phone")).resolves.toEqual({ kind: "ok", session: session("control") });
    expect(d.api.login).toHaveBeenCalledWith({ level: "control", pin: "1234", label: "phone" });
    expect(d.setSession).toHaveBeenCalledWith(session("control"));
  });

  it("wrong: passes attempts_left through and stores nothing", async () => {
    const d = deps({ login: vi.fn(async (): Promise<LoginResult> => ({ reason: "wrong", retry_after_s: null, attempts_left: 3 })) });
    await expect(login(d, "control", "0000", "phone")).resolves.toEqual({ kind: "wrong", attemptsLeft: 3 });
    expect(d.setSession).not.toHaveBeenCalled();
  });

  it("locked: uses retry_after_s, or 60 s when missing", async () => {
    const d = deps({ login: vi.fn(async (): Promise<LoginResult> => ({ reason: "locked", retry_after_s: 42, attempts_left: 0 })) });
    await expect(login(d, "control", "0000", "phone")).resolves.toEqual({ kind: "locked", retryAfterS: 42 });
    const e = deps({ login: vi.fn(async (): Promise<LoginResult> => ({ reason: "locked", retry_after_s: null, attempts_left: null })) });
    await expect(login(e, "control", "0000", "phone")).resolves.toEqual({ kind: "locked", retryAfterS: DEFAULT_LOCKOUT_S });
  });

  it("error: a thrown request becomes { kind: error }", async () => {
    const d = deps({ login: vi.fn(async (): Promise<LoginResult> => { throw new ApiRequestError("network", "down", null); }) });
    await expect(login(d, "technician", "123456", "phone")).resolves.toEqual({ kind: "error" });
  });
});

describe("lock", () => {
  it("stores the downgraded session and leaves the local-lock flag set", async () => {
    const d = deps();
    await expect(lock(d)).resolves.toBe(true);
    expect(d.setSession).toHaveBeenCalledWith(session("view"));
    expect(d.localLock.get()).toBe(true);
  });

  it("clears the flag when the lock fails", async () => {
    const d = deps({ lock: vi.fn(async () => { throw new ApiRequestError("network", "down", null); }) });
    await expect(lock(d)).resolves.toBe(false);
    expect(d.localLock.get()).toBe(false);
  });

  it("consumeLocalLock returns true once", () => {
    const flag = createStore(true);
    expect(consumeLocalLock(flag)).toBe(true);
    expect(consumeLocalLock(flag)).toBe(false);
  });
});
```

**Verify:** `pnpm --filter @eduscope/kiosk exec vitest run src/data/access/session-actions.test.ts` → 7 passed. `pnpm verify` → exit 0.

**Commit:** `git commit -m "feat(kiosk): login and lock session actions"`

### T8 — `gateDisablesControl`: locked controls stay tappable
- [ ] done

**Files:** `apps/kiosk/src/data/gate.ts`, `apps/kiosk/src/data/gate.test.ts`

**Context:** SPEC S1 view-only presentation / H12: locked controls "render with real state at full colour" and a tap opens S4. `CommandButton`/`ToggleRow` with `disabled` get `pointer-events-none`, so a locked control must **not** be disabled. Disabled only for `disconnected` (H1–H3) and `offline` (H8). `computeControlGate` is unchanged.

**Do:**
1. Append to the end of `apps/kiosk/src/data/gate.ts`:
```ts

/**
 * `disabled` for a control: only while disconnected or offline. A `locked` (H12) control stays
 * tappable at full colour so the tap can open S4.
 */
export function gateDisablesControl(gate: ControlGate): boolean {
  return gate.reason === "disconnected" || gate.reason === "offline";
}
```
2. In `apps/kiosk/src/data/gate.test.ts` replace:
```ts
import { computeControlGate, type GateInput } from "./gate";
```
   with:
```ts
import { computeControlGate, gateDisablesControl, type ControlGate, type GateInput } from "./gate";
```
3. Append to the end of `apps/kiosk/src/data/gate.test.ts`:
```ts

describe("gateDisablesControl", () => {
  it.each<[ControlGate, boolean]>([
    [{ enabled: true, reason: null }, false],
    [{ enabled: false, reason: "locked" }, false],
    [{ enabled: false, reason: "disconnected" }, true],
    [{ enabled: false, reason: "offline" }, true],
  ])("%o → %s", (gate, expected) => {
    expect(gateDisablesControl(gate)).toBe(expected);
  });
});
```

**Verify:** `pnpm --filter @eduscope/kiosk exec vitest run src/data/gate.test.ts` → 16 passed. `pnpm verify` → exit 0.

**Commit:** `git commit -m "feat(kiosk): keep locked controls tappable"`

### T9 — Hooks: `useRequireAccess`, `useSessionActions`, `useLock`; `useCommand` opens S4 when locked
- [ ] done

**Files:** `apps/kiosk/src/data/hooks.ts`

**Context:** ARCHITECTURE §4.6 step 1 ("if gate closed → open PIN (view)"), §4.7. The M02 comment in `useCommand` says "M03 opens the PIN overlay for `locked`". `send()` while locked calls `ensure()` and returns — it never sends, now or after the unlock (AC1: "the control did **not** fire, a second tap fires it"). `unlock()` is exposed for sliders (T22). Hooks are thin wrappers over T5–T7, which carry the tests (CLAUDE.md: no tests of pure markup; these hooks hold no logic of their own).

**Do:**
Replace the whole file. Compared with M02 it adds imports, three hooks after `useSession`, and the locked branch + `unlock` in `useCommand`; everything else is identical.

1. Replace the whole file `apps/kiosk/src/data/hooks.ts`:
```ts
import type { ClientLabel, ClientSession, CommandBody, RoomState } from "@eduscope/contracts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { decideAccess, type RequiredAccess } from "./access/decide-access";
import { pinRequests } from "./access/pin-requests";
import { localLockStore, lock, login } from "./access/session-actions";
import { useApiClient } from "./api-context";
import { createCommandSender } from "./commands/command-sender";
import { inlineErrorStore } from "./commands/inline-errors";
import { pendingStore, type ControlKey } from "./commands/pending-store";
import { computeControlGate, type ControlGate } from "./gate";
import { sessionQuery, stateQuery } from "./queries";
import { connectionStore } from "./realtime/connection-store";
import type { ConnectionStatus } from "./realtime/connection";

/** A slice of the room state; `undefined` until the first snapshot (H1 → skeletons). */
export function useRoomState<T>(select: (state: RoomState) => T): T | undefined {
  return useQuery({ ...stateQuery, select }).data;
}

export function useSession() {
  return useQuery(sessionQuery(useApiClient())).data;
}

/**
 * `ensure()` (ARCHITECTURE §4.7): `true` when the session already has `level`; otherwise opens
 * S4 and resolves after the PIN (`true`) or Cancel (`false`). Callers never replay the tap.
 */
export function useRequireAccess(level: RequiredAccess) {
  const access = useSession()?.access;
  const ensure = useCallback(async (): Promise<boolean> => {
    const decision = decideAccess(level, access);
    if (decision === "granted") return true;
    if (decision === "wait") return false;
    return pinRequests.request(level);
  }, [level, access]);
  return { ensure };
}

/** Login (S4) and Lock (S1.E8) against the active adapter; results land in `["session"]`. */
export function useSessionActions() {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMemo(() => {
    const deps = {
      api,
      setSession: (session: ClientSession) => queryClient.setQueryData(sessionQuery(api).queryKey, session),
      localLock: localLockStore,
    };
    return {
      login: (level: RequiredAccess, pin: string, label: ClientLabel) => login(deps, level, pin, label),
      lock: () => lock(deps),
    };
  }, [api, queryClient]);
}

/** Lock (S1.E8 / S3.E3) with a pending flag for the button. Resolves `false` if it failed. */
export function useLock() {
  const { lock } = useSessionActions();
  const [pending, setPending] = useState(false);
  const run = useCallback(async (): Promise<boolean> => {
    setPending(true);
    const ok = await lock();
    setPending(false);
    return ok;
  }, [lock]);
  return { run, pending };
}

export function useConnectionStatus(): ConnectionStatus {
  return useStore(connectionStore, (status) => status);
}

/** Every control asks this hook (connection + access + device online). */
export function useControlGate(deviceId?: string): ControlGate {
  const connection = useConnectionStatus();
  const access = useSession()?.access;
  const deviceOnline = useRoomState((state) =>
    deviceId === undefined ? undefined : state.devices.find((device) => device.id === deviceId)?.online.value,
  );
  return computeControlGate({ connection, access, deviceOnline });
}

export function usePending(key: ControlKey): boolean {
  return useStore(pendingStore.entries, (entries) => entries.has(key));
}

export function useInlineError(key: ControlKey): string | null {
  return useStore(inlineErrorStore.errors, (errors) => errors.get(key) ?? null);
}

/**
 * `send(body)` for one control (ARCHITECTURE §4.6). Locked (H12) → opens S4 with the room PIN
 * and does NOT send, now or after the unlock (SPEC S1). Other closed gates → ignored.
 * Pending → ignored (H5). `unlock()` opens S4 directly (e.g. a press on a locked slider).
 */
export function useCommand(key: ControlKey, deviceId?: string) {
  const api = useApiClient();
  const gate = useControlGate(deviceId);
  const pending = usePending(key);
  const error = useInlineError(key);
  const { ensure } = useRequireAccess("control");
  const sender = useMemo(() => createCommandSender({ api, pending: pendingStore, inlineErrors: inlineErrorStore }), [api]);
  const unlock = useCallback(() => {
    void ensure();
  }, [ensure]);
  const send = useCallback(
    (body: CommandBody) => {
      if (gate.reason === "locked") {
        unlock();
        return;
      }
      if (!gate.enabled) return;
      void sender(key, body);
    },
    [gate.enabled, gate.reason, unlock, sender, key],
  );
  return { send, unlock, pending, error, gate };
}
```

**Verify:** `pnpm verify` → exit 0.

**Commit:** `git commit -m "feat(kiosk): access hooks and locked command taps"`

### T10 — PIN input reducer (auto-submit, backspace, wrong, lockout countdown)
- [ ] done

**Files:** `apps/kiosk/src/features/pin/pin-input.ts`, `apps/kiosk/src/features/pin/pin-input.test.ts`, `apps/kiosk/src/features/pin/.gitkeep`

**Context:** SPEC S4.E3 (dots: empty / filled / error shake + red "Wrong PIN" / locked "Too many tries · wait 0:58"), S4.E4 (auto-submit when complete; keypad disabled while locked), H17. Copy is fixed: `Wrong PIN`, `Couldn't check the PIN · try again` (no answer from the server), `Too many tries · wait m:ss`. The overlay (T15) dispatches; `submitting` tells it to call login. AC9: "PIN input reducer (auto-submit, backspace, lockout countdown)".

**Do:**
1. Delete `apps/kiosk/src/features/pin/.gitkeep` (`git rm`).
2. Create `apps/kiosk/src/features/pin/pin-input.ts`:
```ts
import { formatCountdown } from "@/lib/format";

// S4 PIN entry as a pure reducer (S4.E3/E4, H17). The overlay dispatches key presses and server
// answers; `submitting` tells it to call login with `digits`.

export type PinLength = 4 | 6;
export type PinPhase = "entering" | "submitting" | "wrong" | "error" | "locked";

export interface PinInputState {
  length: PinLength;
  digits: string;
  phase: PinPhase;
  /** Epoch ms when the lockout ends (phase `locked`). */
  lockedUntil: number | null;
  /** Whole seconds left in the lockout, for the countdown. */
  remainingS: number;
  /** Bumped on every wrong answer, so the shake animation replays. */
  wrongCount: number;
}

export type PinInputAction =
  | { type: "digit"; digit: string }
  | { type: "backspace" }
  | { type: "wrong" }
  | { type: "error" }
  | { type: "locked"; retryAfterS: number; now: number }
  | { type: "tick"; now: number };

export function initialPinInput(length: PinLength): PinInputState {
  return { length, digits: "", phase: "entering", lockedUntil: null, remainingS: 0, wrongCount: 0 };
}

/** Keys work while entering, or right after a wrong/failed answer (which starts a new PIN). */
const acceptsKeys = (phase: PinPhase): boolean => phase === "entering" || phase === "wrong" || phase === "error";

export function pinInputReducer(state: PinInputState, action: PinInputAction): PinInputState {
  switch (action.type) {
    case "digit": {
      if (!acceptsKeys(state.phase) || !/^\d$/.test(action.digit)) return state;
      const digits = (state.phase === "entering" ? state.digits : "") + action.digit;
      // Auto-submit when the last digit lands (S4.E4).
      return { ...state, digits, phase: digits.length === state.length ? "submitting" : "entering" };
    }
    case "backspace":
      if (!acceptsKeys(state.phase)) return state;
      return { ...state, digits: state.phase === "entering" ? state.digits.slice(0, -1) : "", phase: "entering" };
    case "wrong":
      if (state.phase !== "submitting") return state;
      return { ...state, digits: "", phase: "wrong", wrongCount: state.wrongCount + 1 };
    case "error":
      if (state.phase !== "submitting") return state;
      return { ...state, digits: "", phase: "error" };
    case "locked":
      return {
        ...state,
        digits: "",
        phase: "locked",
        lockedUntil: action.now + action.retryAfterS * 1000,
        remainingS: Math.max(0, Math.ceil(action.retryAfterS)),
      };
    case "tick": {
      if (state.phase !== "locked" || state.lockedUntil === null) return state;
      const remainingS = Math.max(0, Math.ceil((state.lockedUntil - action.now) / 1000));
      if (remainingS === 0) return { ...state, phase: "entering", lockedUntil: null, remainingS: 0 };
      return remainingS === state.remainingS ? state : { ...state, remainingS };
    }
  }
}

/** The line under the dots (S4.E3, H17); `null` = nothing to say. */
export function pinMessage(state: PinInputState): string | null {
  switch (state.phase) {
    case "wrong":
      return "Wrong PIN";
    case "error":
      return "Couldn't check the PIN · try again";
    case "locked":
      return `Too many tries · wait ${formatCountdown(state.remainingS)}`;
    case "entering":
    case "submitting":
      return null;
  }
}
```
3. Create `apps/kiosk/src/features/pin/pin-input.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { initialPinInput, pinInputReducer, pinMessage, type PinInputAction, type PinInputState } from "./pin-input";

const run = (state: PinInputState, ...actions: PinInputAction[]): PinInputState => actions.reduce(pinInputReducer, state);
const digits = (pin: string): PinInputAction[] => [...pin].map((digit) => ({ type: "digit", digit }));

describe("PIN input reducer", () => {
  it("collects digits and auto-submits at 4 (room PIN)", () => {
    const three = run(initialPinInput(4), ...digits("123"));
    expect(three).toMatchObject({ digits: "123", phase: "entering" });
    expect(run(three, ...digits("4"))).toMatchObject({ digits: "1234", phase: "submitting" });
  });

  it("auto-submits at 6 (technician PIN), not at 4", () => {
    expect(run(initialPinInput(6), ...digits("1234")).phase).toBe("entering");
    expect(run(initialPinInput(6), ...digits("123456"))).toMatchObject({ digits: "123456", phase: "submitting" });
  });

  it("ignores keys while submitting and non-digit input", () => {
    const submitting = run(initialPinInput(4), ...digits("1234"));
    expect(run(submitting, ...digits("5"), { type: "backspace" })).toBe(submitting);
    const empty = initialPinInput(4);
    expect(run(empty, { type: "digit", digit: "x" })).toBe(empty);
  });

  it("backspace removes the last digit and is harmless when empty", () => {
    expect(run(initialPinInput(4), ...digits("12"), { type: "backspace" }).digits).toBe("1");
    expect(run(initialPinInput(4), { type: "backspace" }).digits).toBe("");
  });

  it("wrong clears the digits, shows Wrong PIN and bumps the shake counter", () => {
    const wrong = run(initialPinInput(4), ...digits("0000"), { type: "wrong" });
    expect(wrong).toMatchObject({ digits: "", phase: "wrong", wrongCount: 1 });
    expect(pinMessage(wrong)).toBe("Wrong PIN");
    // The next digit starts a new PIN and hides the message.
    const next = run(wrong, ...digits("1"));
    expect(next).toMatchObject({ digits: "1", phase: "entering" });
    expect(pinMessage(next)).toBeNull();
  });

  it("error (no answer) clears the digits with its own message", () => {
    const error = run(initialPinInput(4), ...digits("1234"), { type: "error" });
    expect(error).toMatchObject({ digits: "", phase: "error" });
    expect(pinMessage(error)).toBe("Couldn't check the PIN · try again");
  });

  it("locked disables keys and counts down from retry_after_s to 0, then re-enables (H17)", () => {
    const t0 = 1_000_000;
    const locked = run(initialPinInput(4), ...digits("0000"), { type: "locked", retryAfterS: 60, now: t0 });
    expect(locked).toMatchObject({ phase: "locked", digits: "", remainingS: 60, lockedUntil: t0 + 60_000 });
    expect(pinMessage(locked)).toBe("Too many tries · wait 1:00");
    expect(run(locked, ...digits("1"), { type: "backspace" })).toBe(locked);

    const later = run(locked, { type: "tick", now: t0 + 1_000 });
    expect(pinMessage(later)).toBe("Too many tries · wait 0:59");
    expect(pinMessage(run(later, { type: "tick", now: t0 + 2_100 }))).toBe("Too many tries · wait 0:58");
    // Same second → same state object (no re-render).
    expect(run(later, { type: "tick", now: t0 + 1_500 })).toBe(later);

    const almost = run(later, { type: "tick", now: t0 + 59_500 });
    expect(pinMessage(almost)).toBe("Too many tries · wait 0:01");
    const open = run(almost, { type: "tick", now: t0 + 60_000 });
    expect(open).toMatchObject({ phase: "entering", lockedUntil: null, remainingS: 0 });
    expect(run(open, ...digits("1")).digits).toBe("1");
  });

  it("ignores ticks and answers that don't apply", () => {
    const entering = run(initialPinInput(4), ...digits("12"));
    expect(run(entering, { type: "tick", now: 5 }, { type: "wrong" }, { type: "error" })).toBe(entering);
  });
});
```

**Verify:** `pnpm --filter @eduscope/kiosk exec vitest run src/features/pin/pin-input.test.ts` → 8 passed. `pnpm verify` → exit 0.

**Commit:** `git commit -m "feat(kiosk): pin input reducer"`

### T11 — Tokens: `sleep` colour and the wrong-PIN shake
- [ ] done

**Files:** `apps/kiosk/src/styles/tokens.css`, `apps/kiosk/src/styles/token-names.ts`, `apps/kiosk/src/styles/token-names.test.ts`

**Context:** SPEC §2.6 / H23 (dim to ~20%, then black) and S4.E3 (shake). `tokens.css` is the only place for colour literals (CLAUDE.md), so black becomes the token `--color-sleep` (`bg-sleep`, `bg-sleep/80`). It is not a SPEC §3.1 colour, so the count test becomes 27 + 1.

**Do:**
1. In `apps/kiosk/src/styles/tokens.css` replace:
```css
  --color-badge-router-text: #4ADE80;
```
   with:
```css
  --color-badge-router-text: #4ADE80;
  /* H23 / SPEC §2.6 kiosk dim (80% of it) and blank screen. Not a SPEC §3.1 colour. */
  --color-sleep: #000000;
```
2. In `apps/kiosk/src/styles/tokens.css` replace:
```css
    50% { border-color: var(--color-text-2); }
  }
```
   with:
```css
    50% { border-color: var(--color-text-2); }
  }

  /* S4.E3 wrong PIN: the dots shake once. */
  --animate-shake: pin-shake 0.4s ease-in-out;
  @keyframes pin-shake {
    0%, 100% { transform: translateX(0); }
    20%, 60% { transform: translateX(-8px); }
    40%, 80% { transform: translateX(8px); }
  }
```
3. In `apps/kiosk/src/styles/token-names.ts` replace:
```ts
  "callout-fill", "callout-border", "badge-router-fill", "badge-router-text",
] as const;
```
   with:
```ts
  "callout-fill", "callout-border", "badge-router-fill", "badge-router-text", "sleep",
] as const;
```
4. In `apps/kiosk/src/styles/token-names.test.ts` replace:
```ts
  it("has all 27 SPEC §3.1 colours", () => {
    expect(COLOR_TOKENS).toHaveLength(27);
```
   with:
```ts
  it("has all 27 SPEC §3.1 colours plus sleep (SPEC §2.6)", () => {
    expect(COLOR_TOKENS).toHaveLength(28);
```

**Verify:** `pnpm --filter @eduscope/kiosk exec vitest run src/styles/token-names.test.ts` → 5 passed. `pnpm verify` → exit 0.

**Commit:** `git commit -m "feat(kiosk): sleep colour and shake animation tokens"`

### T12 — `PinDots` (S4.E3)
- [ ] done

**Files:** `apps/kiosk/src/components/PinDots.tsx`

**Context:** SPEC S4.E3. States: **empty** (ring `border-text-3`), **filled** (`bg-text-1`), **error** (empty rings `border-danger` + `animate-shake` once; `shakeKey` replays it on each wrong answer). Digits are never shown. Same size at every width (16px dots, 16px gaps). In `components/` because M06 reuses it for the PIN-change sheets (executor note D2).

**Do:**
1. Create `apps/kiosk/src/components/PinDots.tsx`:
```tsx
import { cn } from "@/lib/utils";

export interface PinDotsProps {
  /** 4 (room PIN) or 6 (technician PIN). */
  length: number;
  /** Digits entered so far. */
  filled: number;
  /** Wrong PIN: red rings + one shake. */
  error?: boolean;
  /** Change it to replay the shake (e.g. the wrong-answer counter). */
  shakeKey?: number;
}

/** S4.E3 PIN dots: empty ring / filled / error. Digits are never shown. */
export function PinDots({ length, filled, error = false, shakeKey = 0 }: PinDotsProps) {
  return (
    <div
      key={shakeKey}
      role="img"
      aria-label={`${filled} of ${length} digits entered`}
      className={cn("flex h-6 items-center gap-4", error && "animate-shake")}
    >
      {Array.from({ length }, (_, index) => (
        <span
          key={index}
          className={cn(
            "size-4 rounded-full border-2",
            index < filled ? "border-text-1 bg-text-1" : error ? "border-danger" : "border-text-3",
          )}
        />
      ))}
    </div>
  );
}
```

**Verify:** `pnpm verify` → exit 0 (rendered from T15).

**Commit:** `git commit -m "feat(kiosk): pin dots"`

### T13 — `PinPad` (S4.E4, 64×64 keys)
- [ ] done

**Files:** `apps/kiosk/src/components/PinPad.tsx`

**Context:** SPEC S4.E4 + §3.3 (keys 64×64), §2.6 (pressed state on touch-down via `usePressed`). Layout: 3 columns, rows `1 2 3` / `4 5 6` / `7 8 9` / `Cancel 0 ⌫`, `gap-4` (224×304px) at every width. States: **default** (`bg-control`, `border-border-strong`, mono `text-value`), **pressed** (`brightness-125`), **disabled** (digits and ⌫ get `DISABLED_CONTROL_CLASS` while locked or checking; **Cancel is never disabled**). Cancel and ⌫ are text-style keys (`text-text-2`, no fill). `onCancel` is optional so M06 can use the pad inside a sheet.

**Do:**
1. Create `apps/kiosk/src/components/PinPad.tsx`:
```tsx
import { Delete } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { usePressed } from "@/lib/use-pressed";
import { DISABLED_CONTROL_CLASS } from "./state-styles";

const DIGITS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"] as const;

function Key({ label, onPress, disabled = false, variant = "key", children }: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: "key" | "text";
  children: ReactNode;
}) {
  const pressed = usePressed();
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      {...pressed}
      onClick={onPress}
      className={cn(
        "flex size-16 items-center justify-center rounded-btn transition-[filter] active:brightness-125 data-[pressed=true]:brightness-125",
        variant === "key"
          ? "border border-border-strong bg-control font-mono text-value font-semibold text-text-1"
          : "text-button font-semibold text-text-2",
        disabled && DISABLED_CONTROL_CLASS,
      )}
    >
      {children}
    </button>
  );
}

export interface PinPadProps {
  onDigit: (digit: string) => void;
  onBackspace: () => void;
  /** S4.E5; omitted → the bottom-left cell stays empty. Never disabled. */
  onCancel?: () => void;
  /** H17 lockout / while checking: digits and ⌫ are disabled. */
  disabled?: boolean;
}

/** S4.E4 keypad: 1–9, then Cancel · 0 · ⌫. 64×64 keys (SPEC §3.3), 16px gaps. */
export function PinPad({ onDigit, onBackspace, onCancel, disabled = false }: PinPadProps) {
  return (
    <div className="grid grid-cols-3 gap-4">
      {DIGITS.map((digit) => (
        <Key key={digit} label={digit} disabled={disabled} onPress={() => onDigit(digit)}>
          {digit}
        </Key>
      ))}
      {onCancel === undefined ? (
        <span aria-hidden="true" />
      ) : (
        <Key label="Cancel" variant="text" onPress={onCancel}>
          Cancel
        </Key>
      )}
      <Key label="0" disabled={disabled} onPress={() => onDigit("0")}>
        0
      </Key>
      <Key label="Delete digit" variant="text" disabled={disabled} onPress={onBackspace}>
        <Delete aria-hidden="true" className="size-6" />
      </Key>
    </div>
  );
}
```

**Verify:** `pnpm verify` → exit 0 (rendered from T15).

**Commit:** `git commit -m "feat(kiosk): pin keypad"`

### T14 — `LockButton` (S1.E8 / S3.E3)
- [ ] done

**Files:** `apps/kiosk/src/components/LockButton.tsx`

**Context:** SPEC S1.E8 ("Padlock icon + 'Lock'"), §2.2 phone header (lock button icon-only, 48×48). Same look as the header's Devices/Settings buttons (`h-12 min-w-12 rounded-btn border-border-strong bg-control`; label `hidden sm:inline`). States: **default**, **pressed** (`brightness-125`), **pending** (`PENDING_CONTROL_CLASS`, taps ignored while the lock is in flight). Presentational only (components may not import `data/`); used by `features/session` (header) and `features/settings` (S3.E3), hence `components/`.

**Do:**
1. Create `apps/kiosk/src/components/LockButton.tsx`:
```tsx
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePressed } from "@/lib/use-pressed";
import { PENDING_CONTROL_CLASS } from "./state-styles";

/**
 * S1.E8 / S3.E3 "Lock": padlock + label; icon-only (48×48) below `sm` (SPEC §2.2). Looks like
 * the header's Devices/Settings buttons.
 */
export function LockButton({ onPress, pending = false }: { onPress: () => void; pending?: boolean }) {
  const pressed = usePressed();
  return (
    <button
      type="button"
      aria-label="Lock"
      aria-busy={pending}
      {...pressed}
      onClick={() => {
        if (!pending) onPress();
      }}
      className={cn(
        "flex h-12 min-w-12 items-center justify-center gap-2 rounded-btn border border-border-strong bg-control text-button font-semibold text-text-1 active:brightness-125 data-[pressed=true]:brightness-125 sm:px-4",
        pending && PENDING_CONTROL_CLASS,
      )}
    >
      <Lock aria-hidden="true" className="size-5" />
      <span className="hidden sm:inline">Lock</span>
    </button>
  );
}
```

**Verify:** `pnpm verify` → exit 0 (rendered from T18).

**Commit:** `git commit -m "feat(kiosk): lock button"`

### T15 — `PinOverlay` (S4): centred card ≥600px, keypad in the lower half on phones
- [ ] done

**Files:** `apps/kiosk/src/features/pin/PinOverlay.tsx`

**Context:** SPEC S4.E1–E5, §2.2 "S4 PIN: full-screen keypad in the lower half of the screen", H17, AC8. Reuses `PinDots`, `PinPad`, `pinInputReducer`, `pinRequests`, `useSessionActions`. Copy: title "Enter room PIN" (4 dots) / "Technician PIN" (6 dots); room chip `R-101` (S4.E2) from the snapshot, `VITE_ROOM_ID` before it.

Layout (one component tree):
- **Phone (<600px):** `fixed inset-0 bg-bg` (opaque, covers the header). Two `flex-1` halves: the top half holds chip, title, dots and the message line, aligned to its bottom (`justify-end pb-8`); the bottom half holds the keypad aligned to its top. At 390×844 the first key row starts at y = 422 (the middle).
- **≥600px (`sm:`):** backdrop `sm:bg-bg/80`, a centred card `sm:rounded-card sm:border sm:border-border-strong sm:bg-surface sm:px-8 sm:py-6` (≈290×534 at 1280×800).

States: **entering** (no message), **checking** (keys disabled, Cancel live), **wrong** (red `text-danger` "Wrong PIN", dots shake), **error** (red "Couldn't check the PIN · try again"), **locked** (`text-warn` "Too many tries · wait m:ss" ticking every 250 ms, keys disabled, Cancel live), **success** (overlay closes; the original tap is not replayed). Laptop keyboard: digits, Backspace, Escape = Cancel. z-index `z-[100]` (above the mock panel's old `z-50`; below the kiosk sleep overlay, T27).

**Do:**
1. Create `apps/kiosk/src/features/pin/PinOverlay.tsx`:
```tsx
import { useEffect, useReducer } from "react";
import { PinDots } from "@/components/PinDots";
import { PinPad } from "@/components/PinPad";
import { pinRequests } from "@/data/access/pin-requests";
import type { RequiredAccess } from "@/data/access/decide-access";
import { kioskEnv } from "@/data/env";
import { useRoomState, useSession, useSessionActions } from "@/data/hooks";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { initialPinInput, pinInputReducer, pinMessage } from "./pin-input";

const TICK_MS = 250;
const TITLE: Record<RequiredAccess, string> = { control: "Enter room PIN", technician: "Technician PIN" };

function PinDialog({ id, level }: { id: number; level: RequiredAccess }) {
  const [state, dispatch] = useReducer(pinInputReducer, level === "control" ? 4 : 6, initialPinInput);
  const label = useSession()?.label;
  const { login } = useSessionActions();
  const roomId = useRoomState((room) => room.room.id) ?? kioskEnv.VITE_ROOM_ID;
  const { phase, digits } = state;

  // Auto-submit (S4.E4): the reducer moves to `submitting` when the last digit lands.
  useEffect(() => {
    if (phase !== "submitting") return;
    if (label === undefined) {
      dispatch({ type: "error" });
      return;
    }
    void login(level, digits, label).then((outcome) => {
      switch (outcome.kind) {
        case "ok":
          // Only close the request this dialog belongs to (Cancel may have opened another).
          if (pinRequests.current.get()?.id === id) pinRequests.finish(true);
          return;
        case "wrong":
          dispatch({ type: "wrong" });
          return;
        case "locked":
          dispatch({ type: "locked", retryAfterS: outcome.retryAfterS, now: Date.now() });
          return;
        case "error":
          dispatch({ type: "error" });
      }
    });
  }, [phase, digits, label, level, login, id]);

  // H17 countdown.
  useEffect(() => {
    if (phase !== "locked") return;
    const timer = window.setInterval(() => dispatch({ type: "tick", now: Date.now() }), TICK_MS);
    return () => window.clearInterval(timer);
  }, [phase]);

  // Laptop keyboards: digits, Backspace, Escape = Cancel.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (/^\d$/.test(event.key)) dispatch({ type: "digit", digit: event.key });
      else if (event.key === "Backspace") dispatch({ type: "backspace" });
      else if (event.key === "Escape") pinRequests.finish(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const message = pinMessage(state);
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pin-title"
      className="fixed inset-0 z-[100] flex flex-col bg-bg sm:items-center sm:justify-center sm:bg-bg/80"
    >
      <div className="flex flex-1 flex-col px-4 sm:flex-none sm:rounded-card sm:border sm:border-border-strong sm:bg-surface sm:px-8 sm:py-6">
        {/* Phone: the top half holds the title and dots; the keypad sits in the lower half (SPEC §2.2 S4). */}
        <div className="flex flex-1 flex-col items-center justify-end gap-4 pb-8 sm:flex-none sm:pb-6">
          <span className="flex h-10 items-center rounded-chip border border-border-strong bg-control px-3 font-mono text-card-title font-semibold text-text-1">
            {roomId}
          </span>
          <h2 id="pin-title" className="text-title font-bold text-text-1">
            {TITLE[level]}
          </h2>
          <PinDots length={state.length} filled={digits.length} error={phase === "wrong"} shakeKey={state.wrongCount} />
          <p aria-live="polite" className={cn("min-h-4 text-caption", phase === "locked" ? "text-warn" : "text-danger")}>
            {message ?? ""}
          </p>
        </div>
        <div className="flex flex-1 flex-col items-center justify-start pb-8 sm:flex-none sm:pb-0">
          <PinPad
            disabled={phase === "locked" || phase === "submitting"}
            onDigit={(digit) => dispatch({ type: "digit", digit })}
            onBackspace={() => dispatch({ type: "backspace" })}
            onCancel={() => pinRequests.finish(false)}
          />
        </div>
      </div>
    </div>
  );
}

/** S4 (overlay on the current screen), shown while a PIN request is open. */
export function PinOverlay() {
  const request = useStore(pinRequests.current, (current) => current);
  if (request === null) return null;
  return <PinDialog key={request.id} id={request.id} level={request.level} />;
}
```

**Verify:** `pnpm verify` → exit 0 (mounted in T30).

**Commit:** `git commit -m "feat(kiosk): pin overlay"`

### T16 — Session change rule (H24 toast, leave settings)
- [ ] done

**Files:** `apps/kiosk/src/features/session/session-change.ts`, `apps/kiosk/src/features/session/session-change.test.ts`, `apps/kiosk/src/features/session/.gitkeep`

**Context:** SPEC §2.3 ("When a session ends, the client drops to `view` in place … except that S3 returns to S1"), H24 (toast "Locked · enter PIN to control"; on S3 → S1), AC4 (own Lock: no navigation unless on `/settings/*`), AC5. Toast only for a **remote** client dropping to `view` **not** caused by its own Lock. Leaving settings whenever technician is lost (any client, any cause).

**Do:**
1. Delete `apps/kiosk/src/features/session/.gitkeep` (`git rm`).
2. Create `apps/kiosk/src/features/session/session-change.ts`:
```ts
import type { AccessLevel, ClientType } from "@eduscope/contracts";

// What a change of `session.access` does on this client (SPEC §2.3, H24). Pure; the watcher
// hook applies the effects.

export interface SessionChange {
  /** `undefined` before the first session arrived. */
  prev: AccessLevel | undefined;
  next: AccessLevel;
  clientType: ClientType;
  /** The drop came from this client's own Lock tap (no toast for that). */
  ownLock: boolean;
}

export interface SessionChangeEffects {
  /** H24 toast "Locked · enter PIN to control". */
  toast: boolean;
  /** Technician was lost: leave `/settings/*` for `/` (SPEC §2.3, AC4). */
  leaveSettings: boolean;
}

export const SESSION_EXPIRED_TOAST = "Locked · enter PIN to control";

const NONE: SessionChangeEffects = { toast: false, leaveSettings: false };

export function sessionChangeEffects(change: SessionChange): SessionChangeEffects {
  if (change.prev === undefined || change.prev === change.next) return NONE;
  return {
    toast: !change.ownLock && change.clientType === "remote" && change.next === "view",
    leaveSettings: change.prev === "technician",
  };
}
```
3. Create `apps/kiosk/src/features/session/session-change.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { sessionChangeEffects, type SessionChange, type SessionChangeEffects } from "./session-change";

describe("sessionChangeEffects", () => {
  it.each<[SessionChange, SessionChangeEffects]>([
    // first session, no change, upgrades: nothing
    [{ prev: undefined, next: "view", clientType: "remote", ownLock: false }, { toast: false, leaveSettings: false }],
    [{ prev: "control", next: "control", clientType: "remote", ownLock: false }, { toast: false, leaveSettings: false }],
    [{ prev: "view", next: "control", clientType: "remote", ownLock: false }, { toast: false, leaveSettings: false }],
    [{ prev: "control", next: "technician", clientType: "remote", ownLock: false }, { toast: false, leaveSettings: false }],
    // remote expiry (H24)
    [{ prev: "control", next: "view", clientType: "remote", ownLock: false }, { toast: true, leaveSettings: false }],
    [{ prev: "technician", next: "view", clientType: "remote", ownLock: false }, { toast: true, leaveSettings: true }],
    // own Lock: no toast, still leaves settings
    [{ prev: "control", next: "view", clientType: "remote", ownLock: true }, { toast: false, leaveSettings: false }],
    [{ prev: "technician", next: "view", clientType: "remote", ownLock: true }, { toast: false, leaveSettings: true }],
    // technician → control (kiosk drop, or remote technician expiry that keeps control)
    [{ prev: "technician", next: "control", clientType: "kiosk", ownLock: false }, { toast: false, leaveSettings: true }],
    [{ prev: "technician", next: "control", clientType: "remote", ownLock: false }, { toast: false, leaveSettings: true }],
  ])("%o → %o", (change, expected) => {
    expect(sessionChangeEffects(change)).toEqual(expected);
  });
});
```

**Verify:** `pnpm --filter @eduscope/kiosk exec vitest run src/features/session/session-change.test.ts` → 10 passed. `pnpm verify` → exit 0.

**Commit:** `git commit -m "feat(kiosk): session change rule"`

### T17 — `useSessionWatcher`: apply the session change effects
- [ ] done

**Files:** `apps/kiosk/src/features/session/use-session-watcher.ts`

**Context:** Milestone `features/session/`: "`session` WS event handling, expiry toast … leaving `/settings/*` → `/` when technician is lost". `apply-event` already writes `session` frames into `["session"]` (M02); this hook watches that query, so login responses, Lock responses and pushed events all go through one path. `consumeLocalLock()` is only called when access actually changed. Mounted once in `AppShell` (T30).

**Do:**
1. Create `apps/kiosk/src/features/session/use-session-watcher.ts`:
```ts
import type { AccessLevel } from "@eduscope/contracts";
import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router";
import { toast } from "sonner";
import { consumeLocalLock } from "@/data/access/session-actions";
import { useSession } from "@/data/hooks";
import { SESSION_EXPIRED_TOAST, sessionChangeEffects } from "./session-change";

/**
 * Reacts to `session.access` changes from any source (login, Lock, a pushed `session` event):
 * H24 toast on expiry, and `/settings/*` → `/` when technician is lost. Mount once (AppShell).
 */
export function useSessionWatcher(): void {
  const session = useSession();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const prev = useRef<AccessLevel | undefined>(undefined);

  useEffect(() => {
    if (session === undefined) return;
    const before = prev.current;
    prev.current = session.access;
    const changed = before !== undefined && before !== session.access;
    const effects = sessionChangeEffects({
      prev: before,
      next: session.access,
      clientType: session.client_type,
      ownLock: changed && consumeLocalLock(),
    });
    if (effects.toast) toast(SESSION_EXPIRED_TOAST);
    if (effects.leaveSettings && pathname.startsWith("/settings")) void navigate("/", { replace: true });
  }, [session, pathname, navigate]);
}
```

**Verify:** `pnpm verify` → exit 0.

**Commit:** `git commit -m "feat(kiosk): session watcher"`

### T18 — `HeaderLockButton` (S1.E8 visibility)
- [ ] done

**Files:** `apps/kiosk/src/features/session/HeaderLockButton.tsx`

**Context:** SPEC S1.E8: shown only for remote `control`/`technician`; tapping ends the session → `view` in place (no navigation; T17 handles `/settings/*`). Hidden for kiosk (AC6) and for `view`. Lock failure → toast "Couldn't lock · try again" (`LOCK_FAILED_MESSAGE`).

**Do:**
1. Create `apps/kiosk/src/features/session/HeaderLockButton.tsx`:
```tsx
import { toast } from "sonner";
import { LockButton } from "@/components/LockButton";
import { LOCK_FAILED_MESSAGE } from "@/data/access/session-actions";
import { useLock, useSession } from "@/data/hooks";

/** S1.E8: only for remote `control`/`technician` sessions. Drops to `view` in place. */
export function HeaderLockButton() {
  const session = useSession();
  const lock = useLock();
  if (session === undefined || session.client_type !== "remote" || session.access === "view") return null;
  return (
    <LockButton
      pending={lock.pending}
      onPress={() => {
        void lock.run().then((ok) => {
          if (!ok) toast(LOCK_FAILED_MESSAGE);
        });
      }}
    />
  );
}
```

**Verify:** `pnpm verify` → exit 0 (rendered from T19).

**Commit:** `git commit -m "feat(kiosk): header lock button"`

### T19 — Header: guarded Settings button and Lock
- [ ] done

**Files:** `apps/kiosk/src/app/Header.tsx`

**Context:** SPEC S1.E7 (technician → S3; else S4 technician PIN, then S3), S1.E8, §2.2 phone header (icon-only 48×48 Devices / Settings / Lock in one 56px row). Settings becomes a **button** (not a `Link`): it asks first and navigates to `/settings/remote` only after success, so Cancel leaves the URL and history untouched (AC3 "Cancel → stays on `/`"). The shared class string moves into `HEADER_BUTTON_CLASS`; Devices stays a `Link`. Lock sits after Settings. **Phone wordmark:** with Lock present the 390px row has ~80px left for the wordmark, so below `sm` it stacks on two lines ("eduscope" / "CENTRAL", 12px bold, `flex flex-col`) instead of truncating to "eduscope …" (M02 AC2 forbids the ellipsis); from `sm` up it is one line as before (`sm:block sm:truncate sm:text-wordmark`).

**Do:**
1. Replace the whole file `apps/kiosk/src/app/Header.tsx`:
```tsx
import { Settings, Wifi, type LucideIcon } from "lucide-react";
import { Link, useNavigate } from "react-router";
import { kioskEnv } from "@/data/env";
import { useRequireAccess, useRoomState } from "@/data/hooks";
import { HeaderLockButton } from "@/features/session/HeaderLockButton";
import { formatDate, formatTime } from "@/lib/format";
import { useServerNow } from "@/lib/server-time";
import { usePressed } from "@/lib/use-pressed";
import { Skeleton } from "@/ui/skeleton";
import { StatusIndicator } from "./StatusIndicator";

const HEADER_BUTTON_CLASS =
  "flex h-12 min-w-12 items-center justify-center gap-2 rounded-btn border border-border-strong bg-control text-button font-semibold text-text-1 active:brightness-125 data-[pressed=true]:brightness-125 sm:px-4";

function HeaderLink({ to, icon: Icon, label }: { to: string; icon: LucideIcon; label: string }) {
  const pressed = usePressed();
  return (
    <Link to={to} aria-label={label} {...pressed} className={HEADER_BUTTON_CLASS}>
      <Icon aria-hidden="true" className="size-5" />
      <span className="hidden sm:inline">{label}</span>
    </Link>
  );
}

/** S1.E7: technician → S3; otherwise S4 (technician PIN) first. Cancel stays where you are. */
function SettingsButton() {
  const pressed = usePressed();
  const { ensure } = useRequireAccess("technician");
  const navigate = useNavigate();
  return (
    <button
      type="button"
      aria-label="Settings"
      {...pressed}
      onClick={() => {
        void ensure().then((granted) => {
          if (granted) void navigate("/settings/remote");
        });
      }}
      className={HEADER_BUTTON_CLASS}
    >
      <Settings aria-hidden="true" className="size-5" />
      <span className="hidden sm:inline">Settings</span>
    </button>
  );
}

/** S1.E1–E8. Phone (<600): one 56px row (SPEC §2.2). */
export function Header() {
  const roomId = useRoomState((state) => state.room.id) ?? kioskEnv.VITE_ROOM_ID;
  const now = useServerNow();

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border bg-header px-4 sm:h-16 lg:px-6">
      {/* Phone: two short lines so the row fits status, R-101, Devices, Settings and Lock (SPEC §2.2). */}
      <p className="flex min-w-0 flex-1 flex-col text-caption font-bold text-text-1 sm:block sm:truncate sm:text-wordmark">
        eduscope <span className="tracking-wordmark text-brand">CENTRAL</span>
      </p>

      <div className="hidden items-baseline gap-3 lg:flex" aria-label="Controller time">
        {now === null ? (
          <Skeleton className="h-8 w-36" />
        ) : (
          <>
            <time className="font-mono text-clock font-semibold text-text-1">{formatTime(now)}</time>
            <span className="font-mono text-date text-text-2">{formatDate(now)}</span>
          </>
        )}
      </div>

      <div className="flex shrink-0 items-center justify-end gap-1 sm:gap-3 lg:flex-1">
        <StatusIndicator />
        <span className="flex h-10 items-center rounded-chip border border-border-strong bg-control px-2 font-mono text-card-title font-semibold text-text-1 sm:h-12 sm:px-3">
          {roomId}
        </span>
        <HeaderLink to="/devices" icon={Wifi} label="Devices" />
        <SettingsButton />
        <HeaderLockButton />
      </div>
    </header>
  );
}
```

**Verify:** `pnpm verify` → exit 0.

**Commit:** `git commit -m "feat(kiosk): technician gate on the header settings button"`

### T20 — `SettingsGuard` on every `/settings/*` route
- [ ] done

**Files:** `apps/kiosk/src/features/settings/SettingsGuard.tsx`, `apps/kiosk/src/app/router.tsx`

**Context:** SPEC S1.E7, S2.E4 (S2's Settings button, M05, goes through the same routes), ARCHITECTURE §4.3 ("The settings guard calls requireAccess('technician'); cancel → navigate to `/`"), AC3 (a typed `/settings/network` triggers the same gate). The guard asks **once per visit**, as soon as the session is known, then renders `<Outlet />` only while technician. Losing technician later is T17's job, so the guard never re-prompts. The settings routes become children of one guard route (same URLs).

**Do:**
1. Create `apps/kiosk/src/features/settings/SettingsGuard.tsx`:
```tsx
import { useEffect, useRef } from "react";
import { Outlet, useNavigate } from "react-router";
import { useRequireAccess, useSession } from "@/data/hooks";

/**
 * Technician gate on every `/settings/*` route (S1.E7, ARCHITECTURE §4.3), including a URL typed
 * by hand. Asks once per visit, as soon as the session is known; Cancel → `/`. Losing technician
 * later is handled by the session watcher (navigates to `/`), not here.
 */
export function SettingsGuard() {
  const access = useSession()?.access;
  const { ensure } = useRequireAccess("technician");
  const navigate = useNavigate();
  const decided = useRef(false);

  useEffect(() => {
    if (access === undefined || decided.current) return;
    decided.current = true;
    if (access === "technician") return;
    void ensure().then((granted) => {
      if (!granted) void navigate("/", { replace: true });
    });
  }, [access, ensure, navigate]);

  return access === "technician" ? <Outlet /> : null;
}
```
2. Replace the whole file `apps/kiosk/src/app/router.tsx`:
```tsx
import { createBrowserRouter, Navigate, type RouteObject } from "react-router";
import { ControlPage } from "@/features/control/ControlPage";
import { DevicesPage } from "@/features/devices/DevicesPage";
import { SettingsGuard } from "@/features/settings/SettingsGuard";
import { SettingsPage } from "@/features/settings/SettingsPage";
import { AppShell } from "./AppShell";
import { RouteErrorBoundary } from "./ErrorBoundary";

// ARCHITECTURE §4.3. Every /settings/* route sits under SettingsGuard (technician).
const devRoutes: RouteObject[] = import.meta.env.DEV
  ? [
      {
        path: "dev/components",
        lazy: async () => ({ Component: (await import("./dev/ComponentGallery")).ComponentGallery }),
      },
    ]
  : [];

export const routes: RouteObject[] = [
  {
    path: "/",
    element: <AppShell />,
    errorElement: <RouteErrorBoundary />,
    children: [
      { index: true, element: <ControlPage /> },
      { path: "devices", element: <DevicesPage /> },
      {
        path: "settings",
        element: <SettingsGuard />,
        children: [
          { index: true, element: <Navigate to="/settings/remote" replace /> },
          { path: "remote", element: <SettingsPage tab="remote" /> },
          { path: "remote/:deviceId", element: <SettingsPage tab="remote" /> },
          { path: "network", element: <SettingsPage tab="network" /> },
          { path: "schedule", element: <SettingsPage tab="schedule" /> },
          { path: "devices", element: <SettingsPage tab="devices" /> },
          { path: "about", element: <SettingsPage tab="about" /> },
        ],
      },
      ...devRoutes,
      { path: "*", element: <Navigate to="/" replace /> },
    ],
  },
];

export const router = createBrowserRouter(routes);
```

**Verify:** `pnpm verify` → exit 0.

**Commit:** `git commit -m "feat(kiosk): technician guard on settings routes"`

### T21 — S3.E3 "Technician access" + Lock on the Settings placeholder
- [ ] done

**Files:** `apps/kiosk/src/features/settings/TechnicianAccess.tsx`, `apps/kiosk/src/features/settings/SettingsPage.tsx`

**Context:** SPEC S3.E3 ("Technician access", `[INFERRED]` Lock beside it), milestone SPEC refs "S3.E3 (Lock beside)". Screenshot 03, header right: "Technician access" in `text-text-2`, small. M06 moves it into the real S3 header; for now a right-aligned row above the placeholder card. This is the kiosk technician's way to lock (S1.E8 is remote-only).

**Do:**
1. Create `apps/kiosk/src/features/settings/TechnicianAccess.tsx`:
```tsx
import { toast } from "sonner";
import { LockButton } from "@/components/LockButton";
import { LOCK_FAILED_MESSAGE } from "@/data/access/session-actions";
import { useLock } from "@/data/hooks";

/** S3.E3 "Technician access" with Lock beside it (every client, kiosk included). */
export function TechnicianAccess() {
  const lock = useLock();
  return (
    <div className="flex items-center justify-end gap-3">
      <span className="text-caption text-text-2">Technician access</span>
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
2. Replace the whole file `apps/kiosk/src/features/settings/SettingsPage.tsx`:
```tsx
import { PlaceholderPage } from "@/components/PlaceholderPage";
import { TechnicianAccess } from "./TechnicianAccess";

// S3.E5 tab names. SettingsGuard (router) keeps this page technician-only.
const TABS = {
  remote: { title: "Remote configuration", spec: "S3" },
  network: { title: "Network", spec: "S3b" },
  schedule: { title: "Schedule", spec: "S3c" },
  devices: { title: "Devices", spec: "S3d" },
  about: { title: "About", spec: "S3e" },
} as const;
export type SettingsTab = keyof typeof TABS;

/** `/settings/*` — placeholder until M06. */
export function SettingsPage({ tab }: { tab: SettingsTab }) {
  const { title, spec } = TABS[tab];
  return (
    <div className="flex flex-col gap-4">
      <TechnicianAccess />
      <PlaceholderPage title={`Settings › ${title}`} spec={spec} milestone="M06" />
    </div>
  );
}
```

**Verify:** `pnpm verify` → exit 0.

**Commit:** `git commit -m "feat(kiosk): technician access row with lock"`

### T22 — `LevelSlider`: a locked press opens S4 instead of dragging
- [ ] done

**Files:** `apps/kiosk/src/components/LevelSlider.tsx`

**Context:** SPEC S1 view-only: tapping **any** control opens S4. Buttons and toggles get that from `useCommand.send` (T9), but a slider would start a local drag first. New optional prop `onPressLocked`: when set, pointer-down and arrow keys call it and nothing else happens.

**Do:**
1. Replace the whole file `apps/kiosk/src/components/LevelSlider.tsx`:
```tsx
import { useEffect, useReducer, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import {
  clampLevel, createLevelThrottle, levelFromPointer, SETTLE_TIMEOUT_MS, SLIDER_IDLE,
  sliderDisplayLevel, sliderReducer,
} from "@/lib/level-slider";
import { cn } from "@/lib/utils";
import { DISABLED_CONTROL_CLASS, PENDING_CONTROL_CLASS } from "./state-styles";

export interface LevelSliderProps {
  /** Accessible name, e.g. "Lecturer microphone". */
  label: string;
  /** Server level 0–100; `null` = unknown (thumb hidden). */
  value: number | null;
  /** Throttled while dragging (`final:false`), once on release (`final:true`). */
  onChange: (level: number, final: boolean) => void;
  disabled?: boolean;
  pending?: boolean;
  /** H18: track dimmed; the thumb stays at the saved level. */
  muted?: boolean;
  /** H12: set while locked. A press (or arrow key) calls it instead of moving the thumb. */
  onPressLocked?: (() => void) | undefined;
  className?: string;
}

/** SPEC §2.4 / §3.3: track 8px, thumb 30px visual inside a 48px hit area, full width. */
export function LevelSlider({
  label, value, onChange, disabled = false, pending = false, muted = false, onPressLocked, className,
}: LevelSliderProps) {
  const [state, dispatch] = useReducer(sliderReducer, SLIDER_IDLE);
  const trackRef = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);
  const [throttle] = useState(() => createLevelThrottle((level, final) => onChangeRef.current(level, final)));

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);
  useEffect(() => () => throttle.cancel(), [throttle]);
  // Server pushes: ignored while dragging, end the settle phase otherwise (reducer decides).
  useEffect(() => {
    dispatch({ type: "server", value });
  }, [value]);
  useEffect(() => {
    if (state.mode !== "settling") return;
    const id = window.setTimeout(() => dispatch({ type: "settle-timeout" }), SETTLE_TIMEOUT_MS);
    return () => window.clearTimeout(id);
  }, [state]);

  const levelAt = (event: PointerEvent<HTMLDivElement>): number => {
    const rect = trackRef.current?.getBoundingClientRect();
    return rect === undefined ? 0 : levelFromPointer(event.clientX, rect.left, rect.width);
  };
  const onPointerDown = (event: PointerEvent<HTMLDivElement>): void => {
    if (disabled) return;
    if (onPressLocked !== undefined) {
      onPressLocked();
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    const level = levelAt(event);
    dispatch({ type: "down", level });
    throttle.move(level);
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>): void => {
    if (state.mode !== "dragging") return;
    const level = levelAt(event);
    dispatch({ type: "move", level });
    throttle.move(level);
  };
  const onPointerUp = (event: PointerEvent<HTMLDivElement>): void => {
    if (state.mode !== "dragging") return;
    const level = levelAt(event);
    dispatch({ type: "up", level, server: value });
    throttle.release(level);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (disabled || value === null) return;
    const step = event.key === "ArrowRight" || event.key === "ArrowUp" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowDown" ? -1 : 0;
    if (step === 0) return;
    event.preventDefault();
    if (onPressLocked !== undefined) {
      onPressLocked();
      return;
    }
    onChange(clampLevel(value + step), true);
  };

  const shown = sliderDisplayLevel(state, value);
  return (
    <div
      role="slider"
      tabIndex={disabled ? -1 : 0}
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={shown ?? undefined}
      aria-disabled={disabled}
      aria-busy={pending}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onKeyDown={onKeyDown}
      className={cn(
        "relative flex h-12 w-full touch-none select-none items-center rounded-btn border-2 border-transparent px-4",
        pending && PENDING_CONTROL_CLASS,
        disabled && DISABLED_CONTROL_CLASS,
        className,
      )}
    >
      <div ref={trackRef} className={cn("relative h-2 w-full rounded-full bg-border", muted && "opacity-40")}>
        {shown !== null && (
          <span
            aria-hidden="true"
            className="absolute top-1/2 size-7.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-knob shadow"
            style={{ left: `${shown}%` }}
          />
        )}
      </div>
    </div>
  );
}
```

**Verify:** `pnpm --filter @eduscope/kiosk exec vitest run src/lib/level-slider.test.ts` → 15 passed (reducer unchanged). `pnpm verify` → exit 0.

**Commit:** `git commit -m "feat(kiosk): locked press on the level slider"`

### T23 — Live demo: padlocks, locked taps open S4
- [ ] done

**Files:** `apps/kiosk/src/app/dev/LiveDemo.tsx`

**Context:** H12 (padlock on card headers via `LockBadge`), AC1 ("the component demo controls show a padlock; tapping one opens 'Enter room PIN'"). Each demo section header gets the padlock while its gate reason is `locked`; controls use `gateDisablesControl` instead of `!gate.enabled`; the slider passes `onPressLocked`. M04 applies the same pattern to the real S1 cards.

**Do:**
1. Replace the whole file `apps/kiosk/src/app/dev/LiveDemo.tsx`:
```tsx
import { Card } from "@/components/Card";
import { CommandButton } from "@/components/CommandButton";
import { InlineError } from "@/components/InlineError";
import { LevelSlider } from "@/components/LevelSlider";
import { LockBadge } from "@/components/LockBadge";
import { MetricTile } from "@/components/MetricTile";
import { ObservedLine } from "@/components/ObservedLine";
import { SectionLabel } from "@/components/SectionLabel";
import { SensorTile } from "@/components/SensorTile";
import { ToggleRow } from "@/components/ToggleRow";
import { stateTone } from "@/components/state-styles";
import { gateDisablesControl, type ControlGate } from "@/data/gate";
import { useCommand, useRoomState } from "@/data/hooks";
import { formatCelsius, formatWatts } from "@/lib/format";

/** Section header with the H12 padlock while the session is `view`. */
function DemoHeader({ title, gate }: { title: string; gate: ControlGate }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <SectionLabel>{title}</SectionLabel>
      {gate.reason === "locked" && <LockBadge />}
    </div>
  );
}

/** Controls wired to the mock through the real command flow and access gate (M02 AC4–7, M03 AC1). */
export function LiveDemo() {
  const projector = useRoomState((state) => state.display.projector);
  const lights = useRoomState((state) => state.environment.lights);
  const mic = useRoomState((state) => state.audio.channels.mic);
  const temperature = useRoomState((state) => state.environment.sensors.temperature);
  const lightsOnline = useRoomState((state) => state.devices.find((d) => d.id === "lights")?.online.value);

  const powerOn = useCommand("projector.ir:on", "projector");
  const powerOff = useCommand("projector.ir:off", "projector");
  const front = useCommand("lights.front", "lights");
  const rear = useCommand("lights.rear", "lights");
  const micLevel = useCommand("audio.mic", "audio");

  const loading = projector === undefined;
  const running = projector?.state.value === "running" || projector?.state.value === "warming_up";
  const lightsTone = stateTone({ confidence: "confirmed", active: true, offline: lightsOnline === false });

  return (
    <Card className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div className="flex flex-col gap-3">
        <DemoHeader title="Live · projector" gate={powerOn.gate} />
        <ObservedLine
          loading={loading}
          tone={stateTone({ confidence: projector?.state.confidence ?? "unknown", active: running })}
          text={projector?.state.value ?? ""}
        />
        <div className="grid grid-cols-2 gap-3">
          <CommandButton
            label="Power on"
            size="primary"
            active={running ? "confirmed" : null}
            pending={powerOn.pending}
            disabled={gateDisablesControl(powerOn.gate)}
            onPress={() => powerOn.send({ kind: "projector.power", on: true })}
          />
          <CommandButton
            label="Power off"
            size="primary"
            active={!loading && !running ? "neutral" : null}
            pending={powerOff.pending}
            disabled={gateDisablesControl(powerOff.gate)}
            onPress={() => powerOff.send({ kind: "projector.power", on: false })}
          />
        </div>
        <InlineError message={powerOn.error ?? powerOff.error} />
      </div>

      <div className="flex flex-col gap-3">
        <DemoHeader title="Live · lights" gate={front.gate} />
        <ObservedLine
          loading={lights === undefined}
          tone={lightsTone}
          text={lightsOnline === false ? "Switch offline · last known state" : "Confirmed by the switch"}
        />
        <ToggleRow
          label="Front of room"
          on={lights?.front.value ?? null}
          pending={front.pending}
          disabled={gateDisablesControl(front.gate)}
          onToggle={() => front.send({ kind: "lights.set", gang: "front", on: lights?.front.value !== true })}
        />
        <ToggleRow
          label="Rear of room"
          on={lights?.rear.value ?? null}
          pending={rear.pending}
          disabled={gateDisablesControl(rear.gate)}
          onToggle={() => rear.send({ kind: "lights.set", gang: "rear", on: lights?.rear.value !== true })}
        />
        <InlineError message={front.error ?? rear.error} />
      </div>

      <div className="flex flex-col gap-3">
        <DemoHeader title={`Live · microphone ${mic?.value ?? ""}`} gate={micLevel.gate} />
        <LevelSlider
          label="Lecturer microphone"
          value={mic?.value ?? null}
          pending={micLevel.pending}
          disabled={gateDisablesControl(micLevel.gate)}
          onPressLocked={micLevel.gate.reason === "locked" ? micLevel.unlock : undefined}
          onChange={(level, final) => micLevel.send({ kind: "audio.level", channel: "mic", level, final })}
        />
        <InlineError message={micLevel.error} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <SensorTile
          label="Temperature"
          loading={temperature === undefined}
          value={temperature?.kind === "temperature" && temperature.value !== null ? formatCelsius(temperature.value) : null}
          caption="SNZB-02P"
        />
        <MetricTile
          label="Power"
          loading={projector === undefined}
          tone="accent"
          value={projector?.power.value ? formatWatts(projector.power.value.watts) : null}
        />
      </div>
    </Card>
  );
}
```

**Verify:** `pnpm verify` → exit 0.

**Commit:** `git commit -m "feat(kiosk): view-only padlocks in the live demo"`

### T24 — Kiosk idle timer (2 / 5 / 15 min)
- [ ] done

**Files:** `apps/kiosk/src/features/kiosk/idle-timer.ts`, `apps/kiosk/src/features/kiosk/idle-timer.test.ts`, `apps/kiosk/src/features/kiosk/.gitkeep`

**Context:** SPEC §2.3 (kiosk: 2 min idle → S1 and drop technician), §2.6 / H23 (5 min dim, 15 min blank), ARCHITECTURE §4.7. Timings are injectable (milestone notes) and `scaleTimings` serves `?idle-scale=`. Any activity (or a wake) restarts all three timers. AC9: "kiosk idle timer state machine (fake timers)".

**Do:**
1. Delete `apps/kiosk/src/features/kiosk/.gitkeep` (`git rm`).
2. Create `apps/kiosk/src/features/kiosk/idle-timer.ts`:
```ts
import { createStore, type Store } from "@/lib/store";

// Kiosk idle behaviour (SPEC §2.3, §2.6, H23; ARCHITECTURE §4.7): 2 min → back to S1 and drop
// technician; 5 min → dim; 15 min → black. Timings are injectable (`?idle-scale=`, tests).

export type SleepLevel = "awake" | "dim" | "blank";

export interface IdleTimings {
  returnHomeMs: number;
  dimMs: number;
  blankMs: number;
}

export const KIOSK_IDLE_TIMINGS: IdleTimings = { returnHomeMs: 2 * 60_000, dimMs: 5 * 60_000, blankMs: 15 * 60_000 };

export function scaleTimings(timings: IdleTimings, scale: number): IdleTimings {
  return {
    returnHomeMs: Math.round(timings.returnHomeMs * scale),
    dimMs: Math.round(timings.dimMs * scale),
    blankMs: Math.round(timings.blankMs * scale),
  };
}

export interface IdleTimer {
  level: Store<SleepLevel>;
  /** Starts counting from now. */
  start(): void;
  /** Any touch/key while awake, a wake tap, or occupancy: awake again and restart all timers. */
  activity(): void;
  stop(): void;
}

export function createIdleTimer(options: { timings: IdleTimings; onReturnHome: () => void }): IdleTimer {
  const level = createStore<SleepLevel>("awake");
  let timers: ReturnType<typeof setTimeout>[] = [];

  const clear = (): void => {
    for (const timer of timers) clearTimeout(timer);
    timers = [];
  };
  const schedule = (): void => {
    clear();
    const { returnHomeMs, dimMs, blankMs } = options.timings;
    timers = [
      setTimeout(options.onReturnHome, returnHomeMs),
      setTimeout(() => level.set("dim"), dimMs),
      setTimeout(() => level.set("blank"), blankMs),
    ];
  };

  return {
    level,
    start: schedule,
    activity() {
      level.set("awake");
      schedule();
    },
    stop() {
      clear();
      level.set("awake");
    },
  };
}
```
3. Create `apps/kiosk/src/features/kiosk/idle-timer.test.ts`:
```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createIdleTimer, KIOSK_IDLE_TIMINGS, scaleTimings } from "./idle-timer";

const MIN = 60_000;

describe("kiosk idle timer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function started() {
    const onReturnHome = vi.fn();
    const timer = createIdleTimer({ timings: KIOSK_IDLE_TIMINGS, onReturnHome });
    timer.start();
    return { timer, onReturnHome };
  }

  it("2 min → return home once; 5 min → dim; 15 min → blank", () => {
    const { timer, onReturnHome } = started();
    vi.advanceTimersByTime(2 * MIN - 1);
    expect(onReturnHome).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onReturnHome).toHaveBeenCalledTimes(1);
    expect(timer.level.get()).toBe("awake");
    vi.advanceTimersByTime(3 * MIN);
    expect(timer.level.get()).toBe("dim");
    vi.advanceTimersByTime(10 * MIN - 1);
    expect(timer.level.get()).toBe("dim");
    vi.advanceTimersByTime(1);
    expect(timer.level.get()).toBe("blank");
    vi.advanceTimersByTime(60 * MIN);
    expect(onReturnHome).toHaveBeenCalledTimes(1);
  });

  it("activity restarts every timer", () => {
    const { timer, onReturnHome } = started();
    vi.advanceTimersByTime(1.5 * MIN);
    timer.activity();
    vi.advanceTimersByTime(1.5 * MIN);
    expect(onReturnHome).not.toHaveBeenCalled();
    vi.advanceTimersByTime(0.5 * MIN);
    expect(onReturnHome).toHaveBeenCalledTimes(1);
  });

  it("activity while dim or blank wakes and starts a new idle period", () => {
    const { timer, onReturnHome } = started();
    vi.advanceTimersByTime(15 * MIN);
    expect(timer.level.get()).toBe("blank");
    timer.activity();
    expect(timer.level.get()).toBe("awake");
    vi.advanceTimersByTime(5 * MIN);
    expect(timer.level.get()).toBe("dim");
    expect(onReturnHome).toHaveBeenCalledTimes(2);
  });

  it("stop cancels everything", () => {
    const { timer, onReturnHome } = started();
    timer.stop();
    vi.advanceTimersByTime(60 * MIN);
    expect(onReturnHome).not.toHaveBeenCalled();
    expect(timer.level.get()).toBe("awake");
  });

  it("scaleTimings shortens every step (?idle-scale=0.01)", () => {
    expect(scaleTimings(KIOSK_IDLE_TIMINGS, 0.01)).toEqual({ returnHomeMs: 1_200, dimMs: 3_000, blankMs: 9_000 });
  });
});
```

**Verify:** `pnpm --filter @eduscope/kiosk exec vitest run src/features/kiosk/idle-timer.test.ts` → 5 passed. `pnpm verify` → exit 0.

**Commit:** `git commit -m "feat(kiosk): kiosk idle timer"`

### T25 — Wake-tap guard (R15)
- [ ] done

**Files:** `apps/kiosk/src/features/kiosk/wake-guard.ts`, `apps/kiosk/src/features/kiosk/wake-guard.test.ts`

**Context:** SPEC R15 / H23 / §2.6: the first tap while dimmed/blank only wakes; it is never a control press. ARCHITECTURE §4.7: capture-phase `pointerdown`. A tap is pointerdown → pointerup → click and the click would still reach the control under the finger once the overlay is gone, so the guard swallows all three events of the waking tap (and nothing more). AC9: "wake-tap guard swallowing exactly one event" — one tap.

**Do:**
1. Create `apps/kiosk/src/features/kiosk/wake-guard.ts`:
```ts
// R15 / H23: while the kiosk is dimmed or blank, the first tap only wakes the screen. The guard
// sees the capture-phase pointerdown → pointerup → click of that tap and swallows all three, so
// nothing underneath (a control, the PIN pad, a toast) ever receives it.

export type GuardedEventType = "pointerdown" | "pointerup" | "click";
export const GUARDED_EVENTS: readonly GuardedEventType[] = ["pointerdown", "pointerup", "click"];

export interface WakeGuard {
  /** `true` = swallow this event (preventDefault + stopPropagation). */
  handle(type: GuardedEventType): boolean;
}

export function createWakeGuard(options: { isAsleep: () => boolean; wake: () => void }): WakeGuard {
  /** Inside the waking tap: its pointerup and click are swallowed too. */
  let swallowing = false;
  return {
    handle(type) {
      if (type === "pointerdown") {
        if (options.isAsleep()) {
          swallowing = true;
          options.wake();
          return true;
        }
        swallowing = false; // a new tap after the waking one always passes
        return false;
      }
      if (!swallowing) return false;
      if (type === "click") swallowing = false; // the tap is over
      return true;
    },
  };
}
```
2. Create `apps/kiosk/src/features/kiosk/wake-guard.test.ts`:
```ts
import { describe, expect, it, vi } from "vitest";
import { createWakeGuard, type GuardedEventType } from "./wake-guard";

const TAP: GuardedEventType[] = ["pointerdown", "pointerup", "click"];

function guard(asleep: boolean) {
  const state = { asleep };
  const wake = vi.fn(() => {
    state.asleep = false;
  });
  return { state, wake, guard: createWakeGuard({ isAsleep: () => state.asleep, wake }) };
}

describe("wake-tap guard", () => {
  it("passes every event while awake", () => {
    const { guard: g, wake } = guard(false);
    expect(TAP.map((t) => g.handle(t))).toEqual([false, false, false]);
    expect(wake).not.toHaveBeenCalled();
  });

  it("swallows exactly the waking tap, then passes the next one", () => {
    const { guard: g, wake } = guard(true);
    expect(TAP.map((t) => g.handle(t))).toEqual([true, true, true]);
    expect(wake).toHaveBeenCalledTimes(1);
    expect(TAP.map((t) => g.handle(t))).toEqual([false, false, false]);
  });

  it("a tap whose click never comes does not swallow the next tap", () => {
    const { guard: g } = guard(true);
    expect(g.handle("pointerdown")).toBe(true);
    expect(g.handle("pointerup")).toBe(true);
    // No click (finger slid off). The next tap starts fresh.
    expect(TAP.map((t) => g.handle(t))).toEqual([false, false, false]);
  });

  it("swallows again if the screen went back to sleep", () => {
    const { guard: g, state, wake } = guard(true);
    TAP.forEach((t) => g.handle(t));
    state.asleep = true;
    expect(TAP.map((t) => g.handle(t))).toEqual([true, true, true]);
    expect(wake).toHaveBeenCalledTimes(2);
  });
});
```

**Verify:** `pnpm --filter @eduscope/kiosk exec vitest run src/features/kiosk/wake-guard.test.ts` → 4 passed. `pnpm verify` → exit 0.

**Commit:** `git commit -m "feat(kiosk): wake-tap guard"`

### T26 — `?idle-scale` and the occupancy wake rule
- [ ] done

**Files:** `apps/kiosk/src/features/kiosk/kiosk-params.ts`, `apps/kiosk/src/features/kiosk/kiosk-params.test.ts`

**Context:** Milestone notes ("`idle-scale` dev param"), AC7 (`?idle-scale=0.01`), H23 ("occupancy `detected` transition wakes"). The param is honoured in dev builds only, must be in (0, 1]; anything else → 1. The wake rule needs a known previous value that is not `detected`.

**Do:**
1. Create `apps/kiosk/src/features/kiosk/kiosk-params.ts`:
```ts
import type { SensorReading } from "@eduscope/contracts";
import { z } from "zod";

// Dev knobs and small rules for the kiosk behaviour (H23).

const IdleScale = z.coerce.number().positive().max(1);

/** `?idle-scale=0.01` shortens every idle step (dev builds only); anything invalid → 1. */
export function readIdleScale(search: string, dev: boolean): number {
  if (!dev) return 1;
  const raw = new URLSearchParams(search).get("idle-scale");
  if (raw === null) return 1;
  const parsed = IdleScale.safeParse(raw);
  return parsed.success ? parsed.data : 1;
}

type Occupancy = Extract<SensorReading, { kind: "occupancy" }>["value"];

/** Occupancy wakes the kiosk on the transition to `detected` only (H23). */
export function occupancyWakes(prev: Occupancy | undefined, next: Occupancy | undefined): boolean {
  return next === "detected" && prev !== undefined && prev !== "detected";
}
```
2. Create `apps/kiosk/src/features/kiosk/kiosk-params.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { occupancyWakes, readIdleScale } from "./kiosk-params";

describe("readIdleScale", () => {
  it.each([
    ["?idle-scale=0.01", true, 0.01],
    ["?idle-scale=1", true, 1],
    ["", true, 1],
    ["?idle-scale=0", true, 1],
    ["?idle-scale=-1", true, 1],
    ["?idle-scale=5", true, 1],
    ["?idle-scale=abc", true, 1],
    ["?idle-scale=0.01", false, 1],
  ])("%s (dev %s) → %s", (search, dev, expected) => {
    expect(readIdleScale(search, dev)).toBe(expected);
  });
});

describe("occupancyWakes", () => {
  it.each([
    ["clear", "detected", true],
    [null, "detected", true],
    ["detected", "detected", false],
    ["detected", "clear", false],
    [undefined, "detected", false],
    ["clear", undefined, false],
  ] as const)("%s → %s: %s", (prev, next, expected) => {
    expect(occupancyWakes(prev, next)).toBe(expected);
  });
});
```

**Verify:** `pnpm --filter @eduscope/kiosk exec vitest run src/features/kiosk/kiosk-params.test.ts` → 14 passed. `pnpm verify` → exit 0.

**Commit:** `git commit -m "feat(kiosk): idle scale param and occupancy wake rule"`

### T27 — `SleepOverlay` (dim 80% / black)
- [ ] done

**Files:** `apps/kiosk/src/features/kiosk/SleepOverlay.tsx`

**Context:** H23, milestone ("5 min → dim overlay (80% black); 15 min → black"), notes ("The wake overlay must cover everything including the PIN overlay and toasts"). States: **awake** (renders nothing), **dim** (`bg-sleep/80`), **blank** (`bg-sleep`). `fixed inset-0 z-[1000000000]` — above sonner's toaster (z-index 999999999) and the PIN overlay (`z-[100]`). Same at every width. `data-sleep` is for manual checks.

**Do:**
1. Create `apps/kiosk/src/features/kiosk/SleepOverlay.tsx`:
```tsx
import { cn } from "@/lib/utils";
import type { SleepLevel } from "./idle-timer";

/**
 * H23: dim = 80% black (screen at ~20%), blank = black. Sits above everything, PIN overlay and
 * toasts included (sonner uses z-index 999999999). The wake guard swallows the waking tap.
 */
export function SleepOverlay({ level }: { level: SleepLevel }) {
  if (level === "awake") return null;
  return (
    <div
      aria-hidden="true"
      data-sleep={level}
      className={cn("fixed inset-0 z-[1000000000]", level === "dim" ? "bg-sleep/80" : "bg-sleep")}
    />
  );
}
```

**Verify:** `pnpm verify` → exit 0 (rendered from T28).

**Commit:** `git commit -m "feat(kiosk): sleep overlay"`

### T28 — `KioskBehaviour`: timers, guard, occupancy, kiosk CSS hook, no context menu
- [ ] done

**Files:** `apps/kiosk/src/features/kiosk/KioskBehaviour.tsx`

**Context:** ARCHITECTURE §4.7 / milestone `features/kiosk/` (client_type `kiosk` only). On return-home (2 min): close an open S4 request (`finish(false)`), navigate to `/`, and `lock()` if technician (the kiosk drops back to `control`). Window capture listeners: pointerdown/pointerup/click → wake guard, else pointerdown counts as activity; keydown = activity; contextmenu prevented. Adds `html.kiosk` (CSS in T29). Elements under `[data-wake-exempt]` (the dev mock panel, T31) are ignored entirely, so its "Occupancy detected" button can be pressed while dimmed without waking by touch.

**Do:**
1. Create `apps/kiosk/src/features/kiosk/KioskBehaviour.tsx`:
```tsx
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { pinRequests } from "@/data/access/pin-requests";
import { useRoomState, useSession, useSessionActions } from "@/data/hooks";
import { useStore } from "@/lib/store";
import { createIdleTimer, KIOSK_IDLE_TIMINGS, scaleTimings } from "./idle-timer";
import { occupancyWakes, readIdleScale } from "./kiosk-params";
import { SleepOverlay } from "./SleepOverlay";
import { createWakeGuard, GUARDED_EVENTS } from "./wake-guard";

const IDLE_SCALE = readIdleScale(window.location.search, import.meta.env.DEV);
/** Elements marked with this (the dev mock panel) are invisible to the idle timer and wake guard. */
const WAKE_EXEMPT_SELECTOR = "[data-wake-exempt]";

const isExempt = (event: Event): boolean =>
  event.target instanceof Element && event.target.closest(WAKE_EXEMPT_SELECTOR) !== null;

/**
 * Kiosk-only behaviour (`session.client_type === "kiosk"`, ARCHITECTURE §4.7): idle timers,
 * wake-tap guard (R15), occupancy wake (H23), CSS guards (`html.kiosk`) and no context menu.
 */
export function KioskBehaviour() {
  const navigate = useNavigate();
  const access = useSession()?.access;
  const { lock } = useSessionActions();
  const occupancy = useRoomState((state) => {
    const reading = state.environment.sensors.occupancy;
    return reading.kind === "occupancy" ? reading.value : null;
  });

  // The timer outlives renders; its callback reads the latest values through this ref.
  const latest = useRef({ access, navigate, lock });
  useEffect(() => {
    latest.current = { access, navigate, lock };
  });

  const [timer] = useState(() =>
    createIdleTimer({
      timings: scaleTimings(KIOSK_IDLE_TIMINGS, IDLE_SCALE),
      // SPEC §2.3: after 2 min idle the kiosk returns to S1 and drops technician.
      onReturnHome: () => {
        const current = latest.current;
        pinRequests.finish(false);
        void current.navigate("/");
        if (current.access === "technician") void current.lock();
      },
    }),
  );
  const level = useStore(timer.level, (value) => value);

  useEffect(() => {
    const guard = createWakeGuard({ isAsleep: () => timer.level.get() !== "awake", wake: () => timer.activity() });
    const listeners = GUARDED_EVENTS.map((type) => {
      const listener = (event: Event): void => {
        if (isExempt(event)) return;
        if (guard.handle(type)) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        if (type === "pointerdown") timer.activity();
      };
      return { type, listener };
    });
    const onKeyDown = (): void => timer.activity();
    const onContextMenu = (event: Event): void => event.preventDefault();

    for (const { type, listener } of listeners) window.addEventListener(type, listener, { capture: true });
    window.addEventListener("keydown", onKeyDown, { capture: true });
    window.addEventListener("contextmenu", onContextMenu, { capture: true });
    document.documentElement.classList.add("kiosk");
    timer.start();
    return () => {
      for (const { type, listener } of listeners) window.removeEventListener(type, listener, { capture: true });
      window.removeEventListener("keydown", onKeyDown, { capture: true });
      window.removeEventListener("contextmenu", onContextMenu, { capture: true });
      document.documentElement.classList.remove("kiosk");
      timer.stop();
    };
  }, [timer]);

  // H23: the transition to "detected" wakes the screen.
  const previousOccupancy = useRef(occupancy);
  useEffect(() => {
    if (occupancyWakes(previousOccupancy.current, occupancy)) timer.activity();
    previousOccupancy.current = occupancy;
  }, [occupancy, timer]);

  return <SleepOverlay level={level} />;
}
```

**Verify:** `pnpm verify` → exit 0 (mounted in T30).

**Commit:** `git commit -m "feat(kiosk): kiosk idle, wake and occupancy behaviour"`

### T29 — Touch hardening CSS (all clients + kiosk) and hover audit
- [ ] done

**Files:** `apps/kiosk/src/styles/index.css`

**Context:** SPEC §2.6, milestone "Touch hardening": all clients `touch-action: manipulation` (base layer, so `touch-none` on the slider still wins); kiosk only (`html.kiosk`, set by T28): `user-select: none`, `-webkit-touch-callout: none`, `cursor: none` (`!important` so no utility can bring a cursor back). Context menu: T28. Pinch zoom / OS blanking are Chromium flags (M10, out of scope).

**Do:**
1. Replace the whole file `apps/kiosk/src/styles/index.css`:
```css
@import "./tokens.css";
@import "tw-animate-css";

@layer base {
  html,
  body,
  #root {
    min-height: 100dvh;
  }
  body {
    @apply bg-bg font-sans text-text-1 antialiased;
    overflow-x: clip;
  }
  /* SPEC §2.6, all clients: no double-tap zoom / tap delay. Utilities (e.g. touch-none) still win. */
  *,
  ::before,
  ::after {
    touch-action: manipulation;
  }
  /* SPEC §2.6, kiosk only (KioskBehaviour sets html.kiosk): no selection, callout or cursor. */
  html.kiosk,
  html.kiosk * {
    user-select: none;
    -webkit-user-select: none;
    -webkit-touch-callout: none;
    cursor: none !important;
  }
}
```

Do not change `ui/sheet.tsx` in this task (it is backlog item L5).

**Verify:** `pnpm verify` → exit 0. Hover audit: `grep -rn "hover:" apps/kiosk/src` prints exactly one line, `apps/kiosk/src/ui/sheet.tsx:75` (the shadcn close button: visible at 70% without hover, so not a hover-only affordance; unused today, REVIEW-M02 L5). Any other hit → Blocker.

**Commit:** `git commit -m "feat(kiosk): touch hardening css"`

### T30 — Wire `AppShell`: S4 overlay, session watcher, kiosk behaviour
- [ ] done

**Files:** `apps/kiosk/src/app/AppShell.tsx`

**Context:** ARCHITECTURE §4.3 ("S4 PIN is an overlay … rendered by AppShell"), §4.7. `KioskBehaviour` renders only when `session.client_type === "kiosk"` (server-decided; never the user agent).

**Do:**
1. Replace the whole file `apps/kiosk/src/app/AppShell.tsx`:
```tsx
import { Outlet } from "react-router";
import { GREYED_CLASS } from "@/components/state-styles";
import { useConnectionStatus, useSession } from "@/data/hooks";
import { KioskBehaviour } from "@/features/kiosk/KioskBehaviour";
import { PinOverlay } from "@/features/pin/PinOverlay";
import { useSessionWatcher } from "@/features/session/use-session-watcher";
import { cn } from "@/lib/utils";
import { Toaster } from "@/ui/sonner";
import { ConnectionBanner } from "./ConnectionBanner";
import { Header } from "./Header";
import { MockPanel } from "./dev/MockPanel";
import { mockPanelEnabled } from "./mock-panel-flag";

const showMockPanel = mockPanelEnabled();

/** ARCHITECTURE §4.1 frame: header, banner, page; S4 overlay; kiosk behaviour (kiosk only). */
export function AppShell() {
  const status = useConnectionStatus();
  const clientType = useSession()?.client_type;
  useSessionWatcher();
  const greyed = status === "reconnecting" || status === "unreachable";
  return (
    <div className="flex min-h-dvh flex-col overflow-x-clip">
      <Header />
      <ConnectionBanner />
      <main className={cn("flex-1 px-4 py-4 transition-[filter,opacity] lg:px-6 lg:py-6", greyed && GREYED_CLASS)}>
        <Outlet />
      </main>
      <Toaster />
      <PinOverlay />
      {clientType === "kiosk" && <KioskBehaviour />}
      {showMockPanel && <MockPanel />}
    </div>
  );
}
```

**Verify:** `pnpm verify` → exit 0. `pnpm --filter @eduscope/kiosk dev`, open `http://localhost:5173/`, tap Settings → "Technician PIN" overlay with 6 dots; Cancel closes it and the URL is still `/`.

**Commit:** `git commit -m "feat(kiosk): mount pin overlay, session watcher and kiosk behaviour"`

### T31 — Mock panel: expire session, be kiosk / remote, occupancy detected
- [ ] done

**Files:** `apps/kiosk/src/app/dev/MockPanel.tsx`

**Context:** Milestone mock scope, AC5–AC7. The panel gets `data-wake-exempt` and `z-[1000000001]` (above the sleep overlay) so it stays usable while the kiosk is dimmed, plus `max-h-[calc(100dvh-2rem)] overflow-y-auto` because 13 buttons no longer fit at 800px tall. Dev-only.

**Do:**
1. Replace the whole file `apps/kiosk/src/app/dev/MockPanel.tsx`:
```tsx
import { useState } from "react";
import { fakeRoom } from "@/data/adapters/mock/mock-client";
import { cn } from "@/lib/utils";

const ACTIONS: { label: string; run: () => void }[] = [
  { label: "Drop connection", run: () => fakeRoom.dropConnection() },
  { label: "Make unreachable", run: () => fakeRoom.makeUnreachable() },
  { label: "Restore", run: () => fakeRoom.restore() },
  { label: "Change from phone", run: () => fakeRoom.changeFromPhone() },
  { label: "Change by hand", run: () => fakeRoom.changeByHand() },
  { label: "Toggle lights offline", run: () => fakeRoom.toggleDeviceOffline("lights") },
  { label: "Toggle audio offline", run: () => fakeRoom.toggleDeviceOffline("audio") },
  { label: "Fail next command", run: () => fakeRoom.failNextCommand() },
  { label: "Time out next command", run: () => fakeRoom.timeOutNextCommand() },
  { label: "Expire session", run: () => fakeRoom.expireSession() },
  { label: "Be kiosk", run: () => fakeRoom.setClientType("kiosk") },
  { label: "Be remote", run: () => fakeRoom.setClientType("remote") },
  { label: "Occupancy detected", run: () => fakeRoom.occupancyDetected() },
];

/**
 * Dev-only panel (`?mock-panel`) that drives the FakeRoom directly. It sits above the kiosk sleep
 * overlay and is exempt from the wake guard, so "Occupancy detected" can be tested while dimmed.
 */
export function MockPanel() {
  const [open, setOpen] = useState(true);
  return (
    <aside
      data-wake-exempt
      className="fixed right-4 bottom-4 z-[1000000001] max-h-[calc(100dvh-2rem)] w-64 overflow-y-auto rounded-card border border-border-strong bg-surface p-2 shadow-lg"
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-12 w-full items-center justify-between px-2 text-section font-bold uppercase text-text-2"
      >
        Mock panel <span aria-hidden="true">{open ? "−" : "+"}</span>
      </button>
      <div className={cn("flex-col gap-1", open ? "flex" : "hidden")}>
        {ACTIONS.map((action) => (
          <button
            key={action.label}
            type="button"
            onClick={action.run}
            className="h-12 rounded-btn border border-border-strong bg-control px-3 text-left text-caption font-semibold text-text-1 active:brightness-125"
          >
            {action.label}
          </button>
        ))}
      </div>
    </aside>
  );
}
```

**Verify:** `pnpm verify` → exit 0.

**Commit:** `git commit -m "feat(kiosk): mock panel session, kiosk and occupancy actions"`

### T32 — Acceptance walk-through (M03 criteria)
- [ ] done

**Files:** this plan (checkbox only). No code changes; if a check fails, write a Blocker (don't fix it in
this task).

**Context:** M03 "Acceptance criteria" 1–9. Start the app with `pnpm --filter @eduscope/kiosk dev` (mock mode
via `.env.development`) and use Chromium/Chrome with DevTools device mode for widths. **The mock room lives
in the page:** reload the page before each numbered check so PIN lockouts and sessions start fresh. Record
pass/fail + a note for each step in the commit message body.

**Do:**
1. **AC1 view-only.** Open `http://localhost:5173/dev/components?mock-panel` at 1280×800. The three live demo
   sections (projector, lights, microphone) each show a padlock; the header has **no** Lock button. Note the
   Front of room value, tap its row → "Enter room PIN", `R-101` chip, 4 empty dots. Type `1234` on the pad →
   the overlay closes, the padlocks disappear, a Lock button appears, and Front of room still shows the old
   value (wait 2 s: no change, no pending pulse). Tap the row again → it pulses and flips. Repeat once for the
   microphone slider from a fresh reload: pressing the track opens S4 and the thumb does not move.
2. **AC2 lockout.** Reload. Tap any demo control, type `0000` five times. After the 5th: the pad's digits and
   ⌫ are disabled (Cancel still works), the line reads "Too many tries · wait 1:00" and then counts down
   `0:59`, `0:58`, … once per second (D6: the first second shows `1:00`). After 60 s it reads nothing and the
   keys work again. Wrong answers 1–4 each show red "Wrong PIN" and the dots shake.
3. **AC3 technician gate.** Reload `/`. Header **Settings** → "Technician PIN" with 6 dots; **Cancel** → the
   overlay closes, the URL is still `/` and Back does not lead to a settings URL. Settings again → `123456` →
   URL `/settings/remote`, the page shows "Technician access" + Lock above the placeholder. Reload
   `/settings/network` directly (typed URL) → the same "Technician PIN" overlay; Cancel → URL `/`. Repeat the
   Cancel check after unlocking the room PIN first (state `control`): still `/`.
4. **AC4 Lock.** Reload `/dev/components?mock-panel`, unlock with `1234` → the header shows **Lock** (at 390px
   an icon-only 48×48 padlock). Tap it → padlocks return, the URL is unchanged, no toast. Now Settings →
   `123456` → `/settings/remote`; tap the header Lock → the URL becomes `/`.
5. **AC5 expiry.** Reload `/dev/components?mock-panel`, unlock with `1234`, then mock panel **Expire session** →
   toast at the bottom "Locked · enter PIN to control", padlocks return, Lock disappears. Also from
   `/settings/remote` (technician): Expire session → toast and URL `/`.
6. **AC6 kiosk.** Reload `/dev/components?mock-panel`, mock panel **Be kiosk** → no padlocks, no Lock button in
   the header; tapping Rear of room fires immediately (no PIN). Header Settings → "Technician PIN" (6 dots);
   `123456` → `/settings/remote` with "Technician access" + Lock. In the console
   `document.documentElement.classList.contains("kiosk")` → `true`; the mouse cursor is hidden over the page;
   right-click opens no context menu; text cannot be selected by dragging.
7. **AC7 kiosk idle (scaled 0.01: 1.2 s / 3 s / 9 s).** Open `http://localhost:5173/?mock-panel&idle-scale=0.01`,
   **Be kiosk**, Settings → `123456`, then touch nothing:
   - ≈1.2 s: the URL is back to `/` (technician dropped — checked at the end).
   - ≈3 s: the screen dims (80% black over everything, header and toasts included). In the console
     `document.querySelector("[data-sleep]")?.dataset.sleep` → `"dim"`.
   - Tap the header **Devices** button through the dim layer → the screen wakes and the URL stays `/` (the
     control under the finger did not fire). Tap Devices again → `/devices`.
   - Wait ≈9 s untouched → black (`"blank"`). Press mock panel **Occupancy detected** (the panel stays usable
     above the overlay) → about 1 s later the screen is awake.
   - Header Settings → "Technician PIN" appears (technician was dropped at 2 min). Cancel.
   - Note: at real speed `/` is still the M04 placeholder, so the header buttons are the controls to test the
     wake tap with.
8. **AC8 keypad layout.** At 390×844 (touch emulation) open S4 (Settings). In the console:
   ```js
   const keys = [...document.querySelectorAll('[role="dialog"] button')].map((b) => b.getBoundingClientRect());
   console.log(keys.length, keys.every((r) => r.width === 64 && r.height === 64), keys[0].top >= innerHeight / 2,
     document.documentElement.scrollWidth === innerWidth);
   ```
   → `12 true true true`. At 1280×800 the overlay is a card centred on a dimmed page
   (`document.querySelector('[role="dialog"] > div').getBoundingClientRect()` ≈ x 495, width 290). At 390px with
   a `control` session the header still fits on one 56px row with no horizontal scroll (run the M02 header
   snippet: every target ≥48×48, `scrollWidth === innerWidth`).
9. **AC9 tests.** `pnpm verify` → exit 0, and
   `pnpm --filter @eduscope/kiosk exec vitest run --reporter=verbose 2>&1 | grep -E "pin-input|decide-access|idle-timer|wake-guard"`
   shows passing tests in each of the four files (PIN input reducer: auto-submit, backspace, lockout
   countdown; `useRequireAccess` decision table; idle timer with fake timers; wake guard swallowing exactly
   one tap).
10. Hover audit: `grep -rn "hover:" apps/kiosk/src` → only `apps/kiosk/src/ui/sheet.tsx:75` (see T29).
11. Tick this task and commit.

**Verify:** all eleven steps pass.

**Commit:** `git commit -m "chore: M03 acceptance walk-through"`

## Checkpoints

- After T11: "Human: nothing visible yet; skim `data/access/*` and `features/pin/pin-input.ts` against SPEC
  §2.3, S4 and H17 (two minutes)."
- After T30: "Human: run `pnpm --filter @eduscope/kiosk dev`; at 1280×800 and 390×844 open S4 from the header
  Settings button and from a padlocked control on `/dev/components` (keypad in the lower half on the phone,
  centred card on desktop), try `1234`, `123456`, a wrong PIN and Lock."
- After T31: "Human: `/?mock-panel&idle-scale=0.01` → Be kiosk; watch it return to `/`, dim, go black; wake it
  with a tap (nothing fires) and with Occupancy detected."

## Blockers

(executor writes here; leave empty)

## Nice-to-haves (not tasks)

- Keep a PIN lockout visible when S4 is closed and reopened (today the countdown reappears on the next
  submit, when the server answers "locked").
- Focus trap and focus return for the S4 dialog (keyboard and screen-reader users).
- Show "3 tries left" from `attempts_left` under "Wrong PIN".
- Tap the dimmed desktop backdrop to cancel S4.
- A design pass on S4 once a reference image exists (S4 is `[INFERRED]`).
- Header at 600–1023px (pre-existing since M02): the 24px wordmark truncates ("eduscope C…") next to the
  status text and labelled buttons, and Lock makes it shorter. Give that range the phone treatment or hide
  the status text below `lg`.
