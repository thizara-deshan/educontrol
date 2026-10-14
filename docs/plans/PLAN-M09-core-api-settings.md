# PLAN-M09 — core-api: settings & scheduler
Milestone: `docs/milestones/M09-core-api-settings.md` · Start tag: `m09-start` · Verify-all: `pnpm verify`

Inputs read for this plan: M09; SPEC §2.3, §2.4, §3 (tokens: no UI work in this milestone), S3, S3b–S3e, S4, H20–H22,
H24, H25, §6 (IrDevice/IrCommand, Schedule, ClientSession), R4, R5, R8; ARCHITECTURE §1, §3.3, §3.4, §4.4, §5,
§6.1–6.9, §8, §9; decision records D-20, D-21; CLAUDE.md; PLAN-M08 + REVIEW-M08; `packages/contracts` (`api/ir.ts`,
`api/schedule.ts`, `api/devices.ts`, `api/settings.ts`, `api/system.ts`, `domain/{ir,schedule,system,device,zigbee,command}.ts`,
`ws.ts`, `hw/commands.ts`); all of `apps/core-api`; the kiosk's settings data layer and screens
(`apps/kiosk/src/data/adapters/http/http-client.ts`, `data/adapters/mock/{fake-ir,fake-schedule,fake-room}.ts`,
`features/settings/**`) for the exact paths, status codes, error codes and texts the UI expects; `services/hw/app/modules/ir/*`,
`zigbee_status/*`, `app/config.py`. **No screen changes:** S3–S3e were built against the mock in M06 and the http adapter
already calls every route below; this milestone makes them real. `reference/screens/03` was used only to confirm the S3
list order (Air conditioning before Projector).

## Executor notes (read once, apply to every task)

- Paths are relative to the repo root `/home/rust-cohle/edcontrol`. "Run `cmd`" = run it from the repo root.
- Before T1: `git tag m09-start` (on the commit that adds this plan).
- **Every code block and patch in this plan was applied, compiled, linted and tested**, one task per commit, in a fresh
  worktree from `main` (39d5a37): after each task `typecheck`, `lint` and the core-api tests were green with exactly the
  test count quoted in its **Verify**, and `pnpm verify` was green at the end (contracts 136, kiosk 492, core-api 327, hw 134).
  The finished stack (hw fake + core-api, real timers) was then driven with curl and two WebSocket clients: AC1, AC2, AC4,
  AC5, AC6, AC7, AC8, AC9, AC10 and the dev restart behaved as quoted in T27.
- Apply blocks **verbatim**:
  - "Create `X`" / "Replace the whole file `X`" = the block is the full file content (end it with one newline); create
    missing folders.
  - "Patch `X`" = run the shell block from the repo root exactly as given. `git apply` prints nothing on success. If it
    prints `error: patch failed`, the file differs from what the plan expects: **stop**, `git diff` the file against
    the previous task's state, and write a Blocker. Never hand-edit around a failed patch.
- core-api imports use explicit `.ts` extensions; tests live in `apps/core-api/test/**` mirroring `src/`. No `as` casts
  (only `as const`), no `!`, no `any`.
- Tests never open a port: `buildApp({db: ":memory:", hw: fakeHw(), clock: fixedClock(T0), config})` + `fastify.inject` /
  `app.injectWS`. `T0` = Mon 2026-10-05 10:42 and Vitest runs with `TZ=UTC`, so schedule times in tests are UTC.
- If `pnpm verify` fails after a block: diff your file against the plan; do not "fix" by editing tests.
- After each task: run its **Verify**, then `pnpm verify`; tick the task box in this file; commit with the task's message
  (one commit per task, plan file included).

### Decisions this plan makes (do not re-open them)

- **D1 — status codes and texts** (match the kiosk: `features/settings/remote/command-row.ts` shows "Couldn't reach the
  blaster" for `hw_unavailable` and "Command failed" for anything else). Create → 201 + body; learn / cancel / test /
  permit-join / restart → 202, empty; delete / PIN change → 204; unknown id → 404 `not_found`; refused precondition →
  409 `precondition`; hw link down → 503 `hw_unavailable` "Hardware service offline"; ZS06 offline or a refused test
  send → 503 `hw_unavailable` "Couldn't reach the blaster" (as the mock).
- **D2 — one capture per blaster** (= per transport). A second learn, or a test on the same blaster while it listens →
  409 "Another capture is running". Cancel makes the capture end `cancelled` whatever hw answers afterwards; the stored
  code changes only on `captured` (R5: then `untested`).
- **D3 — S3 list order** is by name (screenshot 03, as the mock); commands keep their seeded order.
- **D4 — R8.** Only IR devices change transport, and only between `ir_zs06` and `ir_mcu` (the S3d sheet offers nothing
  else); other changes → 409 "Only IR devices change transport (ZS06 or MCU)". `ir_mcu` devices learn and test while the
  ZS06 is offline.
- **D5 — seed on first boot only** (T4). Devices and IR commands are inserted only into an empty registry, so S3d removals
  and S3 command deletions survive a restart. Existing dev databases are unaffected.
- **D6 — activity** (ARCHITECTURE §5): every 2xx to a guarded non-GET route resets the idle timer (T14).
- **D7 — PIN change** ends every OTHER session of that level (room PIN → remote control sessions; technician PIN → every
  technician session); the technician who changed it stays unlocked.
- **D8 — class-block end** downgrades every remote `control` session (D-21 path: row kept, `session` pushed → H24 toast).
  Technician sessions are not ended by a block. The kiosk is untouched (always control).
- **D9 — scheduler window.** A tick runs what fell in (last tick, now], so each action runs once per minute; 00:00 is the
  new day; catch-up after a gap is capped at 5 min. Times are the Pi's local time. The existing 15 s session sweep stays
  (ARCHITECTURE §5); the scheduler does not duplicate it.
- **D10 — refused schedule steps** are logged (`event_log`, actor `schedule`, `refused: <message>`) and the remaining
  steps still run. The schedule may run technician kinds.
- **D11 — Network tab.** Hostname = `<os hostname>.local` `[ASSUMED]` (avahi); address = first external IPv4, wired
  before Wi-Fi; Wi-Fi SSID/signal from `nmcli` only when the primary interface is wireless; unknown SSID → "unknown
  network". Pi model "unknown" off a Pi. About URL from `ROOM_HOSTNAME`.
- **D12 — restart.** `RESTART_COMMAND` split on spaces, spawned without a shell, detached. Unset → close and exit 0.
  **Dev sets `RESTART_COMMAND='touch src/main.ts'`** because `tsx watch` does not restart a process that exits
  (verified); touching the entry file does (verified: back in ~1 s).
- **D13 — hw fake "nothing received"** (T1): `POST /v1/_fake/ir/nothing_received {on}` makes every learn time out until
  switched off. Fake-only route: no contract, pydantic schema or fixture change.
- **D14 — no new tables or columns.** Every M09 table exists since M08; no migration is generated.
- **D15 — no `invalidate` for PIN changes or permit joining:** no query holds PIN data, and the mesh countdown arrives in
  `state`. Every other settings write invalidates (IR `[["ir","devices"]]`, registry `[["devices"],["ir","devices"]]`,
  schedule `[["schedule"]]`).

## File map

| File | Create/Modify | Responsibility |
|---|---|---|
| `services/hw/app/modules/ir/driver_fake.py`, `services/hw/tests/test_ir.py`, `tests/test_registry.py` | Modify | fake "nothing received" switch (T1) |
| `apps/core-api/src/config.ts`, `test/config.test.ts` | Modify | `TIMEOUT_IR_LEARN_MS`, `RESTART_COMMAND` (T2) |
| `apps/core-api/src/hw/client.ts`, `test/hw/client.test.ts`, `test/helpers.ts` | Modify | `irLearn`, `irLearnCancel`, `permitJoin`; fake hw (T3) |
| `apps/core-api/src/db/seed.ts`, `test/db/seed.test.ts` | Modify | registry seeded on first boot only (T4) |
| `apps/core-api/src/db/devices.ts`, `test/db/devices.test.ts` | Create | registry reads/writes; `loadRegistry` moves here (T5) |
| `apps/core-api/src/domain/ir.ts`, `test/domain/ir.test.ts` | Create | capture window, R5, H22, R4 uniqueness (T6) |
| `apps/core-api/src/db/ir.ts`, `test/db/ir.test.ts` | Create | IR rows ↔ `IrDevice`/`IrCommand` (T7) |
| `apps/core-api/src/domain/{ac,devices}.ts` + tests | Modify | R4 range rebuild, R8 transport rule (T8) |
| `apps/core-api/src/registry-sync.ts`, `test/registry-sync.test.ts` | Create | DB → store after writes (T9) |
| `apps/core-api/src/ir/service.ts`, `test/ir/service.test.ts` | Create | IR CRUD, learn, cancel, test (T10) |
| `apps/core-api/src/auth/sessions.ts` + test | Modify | `endAccess` (T11) |
| `apps/core-api/src/plugins/realtime.ts` + test | Modify | `hub.updateSession` (T12) |
| `apps/core-api/src/routes/ir.ts`, `test/routes/{ir,access}.test.ts`, `test/routes/app-helpers.ts` | Create / Modify | IR routes; access table; PUT/PATCH/DELETE helper (T13) |
| `apps/core-api/src/plugins/auth.ts`, `test/routes/session.test.ts` | Modify | activity on authorised mutations (T14) |
| `apps/core-api/src/db/schedule.ts`, `test/db/schedule.test.ts` | Create | schedule rows (T15) |
| `apps/core-api/src/routes/schedule.ts`, `test/routes/schedule.test.ts` | Create | S3c routes (T16) |
| `apps/core-api/src/routes/devices.ts`, `test/routes/devices.test.ts` | Create | S3d registry + permit join (T17) |
| `apps/core-api/src/routes/settings.ts`, `test/routes/settings.test.ts` | Create | PIN changes (T18) |
| `apps/core-api/src/domain/network.ts`, `test/domain/network.test.ts` | Create | S3b pure rules (T19) |
| `apps/core-api/src/system/info.ts`, `src/paths.ts`, `test/system/info.test.ts` | Create / Modify | OS probe (T20) |
| `apps/core-api/src/system/restart.ts`, `src/routes/system.ts` + tests | Create | restart runner; network/about/restart routes (T21) |
| `apps/core-api/src/main.ts`, `apps/core-api/package.json` | Modify | restart wiring; dev `RESTART_COMMAND` (T22) |
| `apps/core-api/src/domain/schedule.ts`, `test/domain/schedule.test.ts` | Create | due-calculation (T23) |
| `apps/core-api/src/domain/energy.ts`, `src/db/event-log.ts` + tests | Modify | midnight baseline, pruning (T24) |
| `apps/core-api/src/commands/dispatcher.ts`, `test/commands/dispatcher.test.ts` | Modify | `SCHEDULE_ISSUER` (T25) |
| `apps/core-api/src/scheduler/scheduler.ts`, `test/scheduler/scheduler.test.ts` | Create | the 30 s tick (T26) |
| `apps/core-api/src/app.ts` | Modify | wiring (T5, T12, T13, T16, T17, T18, T21, T26) |
| this plan | Modify | ticks, Blockers |

Order: hw fake → config/hw client → data (seed, registry, IR, schedule records) → domain rules → services → routes →
system → scheduler → acceptance. There are no shared kiosk components or screens in this milestone.

## Tasks

### T1 — hw fake: "nothing received" switch for IR learn
- [x] done

**Files:** `services/hw/app/modules/ir/driver_fake.py`, `services/hw/tests/test_ir.py`, `services/hw/tests/test_registry.py`

**Context:** AC2 needs a learn that hears nothing. Today the fake IR driver always captures (or times out only while the blaster is offline, which core-api refuses up front, H25). Add a sticky fake-only switch `POST /v1/_fake/ir/nothing_received {on: bool = true}`: while on, every learn waits out its `timeout_s` and answers `{status: "timeout"}`. Fake routes are not part of the hw contract (ARCHITECTURE §3.4 `/v1/_fake/<module>/<event>`), so no zod, pydantic schema or fixture changes. Pattern to copy: `blaster_offline` in the same file.

**Do:**

1. Patch `services/hw/app/modules/ir/driver_fake.py` (137 lines, so only the change is shown). Run from the repo root; it must print nothing:
```sh
git apply --whitespace=nowarn <<'PATCH'
diff --git a/services/hw/app/modules/ir/driver_fake.py b/services/hw/app/modules/ir/driver_fake.py
index 0c40cca..bf8e31a 100644
--- a/services/hw/app/modules/ir/driver_fake.py
+++ b/services/hw/app/modules/ir/driver_fake.py
@@ -1,5 +1,6 @@
 """Fake IR blaster. Sent codes go to listeners (the fake projector); learning "captures" a
-random opaque code after LEARN_CAPTURE_S (scaled), seeded by HW_FAKE_SEED."""
+random opaque code after LEARN_CAPTURE_S (scaled), seeded by HW_FAKE_SEED, unless
+`/v1/_fake/ir/nothing_received` is on (then every learn waits out its timeout, H21)."""
 
 import asyncio
 import base64
@@ -39,6 +40,7 @@ class FakeIrDriver:
         self._settings = settings
         self._rng = random.Random(settings.fake_seed)
         self._online = True
+        self._nothing_received = False
         self._listeners: list[CodeListener] = []
         self._learn_cancel: asyncio.Event | None = None
         self._emit: IrEmit | None = None
@@ -63,14 +65,15 @@ class FakeIrDriver:
         return ACK_OK
 
     async def learn(self, request: HwIrLearnRequest) -> HwIrLearnResult:
-        """One capture at a time: a new learn cancels the one in progress. Offline or a timeout
-        shorter than LEARN_CAPTURE_S ends in `timeout`."""
+        """One capture at a time: a new learn cancels the one in progress. Offline, "nothing
+        received" or a timeout shorter than LEARN_CAPTURE_S ends in `timeout`."""
         if self._learn_cancel is not None:
             self._learn_cancel.set()
         cancel = asyncio.Event()
         self._learn_cancel = cancel
         self._report_learn("listening")
-        captures = self._online and LEARN_CAPTURE_S <= request.timeout_s
+        hears = self._online and not self._nothing_received
+        captures = hears and LEARN_CAPTURE_S <= request.timeout_s
         wait_s = LEARN_CAPTURE_S if captures else request.timeout_s
         result: HwIrLearnResult
         try:
@@ -97,6 +100,9 @@ class FakeIrDriver:
         self._online = online
         self._report_blaster()
 
+    def set_nothing_received(self, on: bool) -> None:
+        self._nothing_received = on
+
     def _report_blaster(self) -> None:
         if self._emit is not None:
             lqi = BLASTER_LQI if self._online else None
@@ -111,6 +117,10 @@ class FakeOnlineRequest(HwModel):
     online: bool = False
 
 
+class FakeNothingReceivedRequest(HwModel):
+    on: bool = True
+
+
 def build_fake_router(driver: FakeIrDriver) -> APIRouter:
     router = APIRouter(prefix="/v1/_fake/ir", tags=["fake"])
 
@@ -119,4 +129,9 @@ def build_fake_router(driver: FakeIrDriver) -> APIRouter:
         driver.set_online((body or FakeOnlineRequest()).online)
         return ACK_OK
 
+    @router.post("/nothing_received")
+    async def nothing_received(body: FakeNothingReceivedRequest | None = None) -> HwAckOk:
+        driver.set_nothing_received((body or FakeNothingReceivedRequest()).on)
+        return ACK_OK
+
     return router
PATCH
```

2. Patch `services/hw/tests/test_ir.py` (131 lines, so only the change is shown). Run from the repo root; it must print nothing:
```sh
git apply --whitespace=nowarn <<'PATCH'
diff --git a/services/hw/tests/test_ir.py b/services/hw/tests/test_ir.py
index 842befa..2c8b9b7 100644
--- a/services/hw/tests/test_ir.py
+++ b/services/hw/tests/test_ir.py
@@ -79,6 +79,15 @@ async def test_learn_times_out_while_the_blaster_is_offline() -> None:
     assert await service.learn(LEARN) == HwIrLearnTimeout(status="timeout")
 
 
+async def test_nothing_received_times_out_until_switched_off() -> None:
+    service, driver, sub = await start_fake()
+    driver.set_nothing_received(True)
+    assert await service.learn(LEARN) == HwIrLearnTimeout(status="timeout")
+    assert await learn_statuses(sub, 2) == ["listening", "timeout"]
+    driver.set_nothing_received(False)
+    assert isinstance(await service.learn(LEARN), HwIrLearnCaptured)
+
+
 async def test_cancel_ends_a_learn_in_progress() -> None:
     service, _, sub = await start_fake(time_scale=1.0)  # capture would take 3 real seconds
     learning = asyncio.create_task(service.learn(LEARN))
@@ -111,5 +120,12 @@ async def test_routes() -> None:
         assert (await http.post("/v1/ir/learn/cancel")).json() == {"ok": True}
         bad = await http.post("/v1/ir/learn", json={"transport": "ir_zs06", "timeout_s": 61})
         assert bad.status_code == 422
+        assert (await http.post("/v1/_fake/ir/nothing_received")).json() == {"ok": True}
+        nothing = await http.post("/v1/ir/learn", json={"transport": "ir_zs06", "timeout_s": 20})
+        assert nothing.json() == {"status": "timeout"}
+        off = await http.post("/v1/_fake/ir/nothing_received", json={"on": False})
+        assert off.json() == {"ok": True}
+        again = await http.post("/v1/ir/learn", json={"transport": "ir_zs06", "timeout_s": 20})
+        assert again.json()["status"] == "captured"
         assert (await http.post("/v1/_fake/ir/blaster_offline")).json() == {"ok": True}
     assert service.snapshot().blaster == HwIrBlasterData(online=False, lqi=None)
PATCH
```

3. Replace the whole file `services/hw/tests/test_registry.py`:
```py
import pytest
from fastapi.routing import APIRoute

from app.events import EventBus
from app.modules.ir.schemas import HwIrSendRequest
from app.modules.projector_power.schemas import HwProjectorPowerReadingEvent
from app.registry import MODULES, build_registry, driver_kinds, parse_driver_overrides
from tests.helpers import drain, make_settings, next_event

ON_SEND = HwIrSendRequest(transport="ir_zs06", code_format="tuya", code="C/8hRgHrBkYBgAMH")


def test_modules_match_the_contract() -> None:
    assert MODULES == (
        "lights",
        "projector_power",
        "ir",
        "hdmi",
        "projection_screen",
        "audio",
        "sensors",
        "zigbee_status",
    )


def test_parse_driver_overrides() -> None:
    assert parse_driver_overrides("") == {}
    assert parse_driver_overrides("lights=real, ir=fake ,") == {"lights": "real", "ir": "fake"}


@pytest.mark.parametrize("raw", ["lights", "lights=on", "door=real", "lights=real,=fake"])
def test_parse_driver_overrides_rejects_typos(raw: str) -> None:
    with pytest.raises(ValueError, match="HW_DRIVERS"):
        parse_driver_overrides(raw)


def test_driver_kinds_apply_mode_then_overrides() -> None:
    kinds = driver_kinds(make_settings(mode="real", drivers="lights=fake"))
    assert kinds["lights"] == "fake"
    assert [kinds[m] for m in MODULES if m != "lights"] == ["real"] * 7


def fake_paths(mode: str, drivers: str = "") -> list[str]:
    registry = build_registry(make_settings(mode=mode, drivers=drivers), EventBus(8))
    routes = [route for router in registry.routers() for route in router.routes]
    paths = [route.path for route in routes if isinstance(route, APIRoute)]
    return sorted(path for path in paths if path.startswith("/v1/_fake/"))


def test_fake_mode_mounts_simulation_routes() -> None:
    assert fake_paths("fake") == [
        "/v1/_fake/ir/blaster_offline",
        "/v1/_fake/ir/nothing_received",
        "/v1/_fake/lights/by_hand",
        "/v1/_fake/projector_power/meter_offline",
        "/v1/_fake/sensors/value",
        "/v1/_fake/zigbee_status/coordinator_offline",
        "/v1/_fake/zigbee_status/node_offline",
    ]


def test_real_mode_has_no_simulation_routes() -> None:
    assert fake_paths("real") == []
    assert fake_paths("real", "lights=fake") == ["/v1/_fake/lights/by_hand"]


def test_health_reports_each_module_driver() -> None:
    registry = build_registry(make_settings(drivers="lights=real"), EventBus(8))
    health = registry.health()
    assert health.mode == "fake"
    assert health.modules.lights == "real"
    assert health.modules.ir == "fake"


async def test_fake_ir_send_drives_the_fake_projector() -> None:
    bus = EventBus(256)
    sub = bus.subscribe()
    registry = build_registry(make_settings(), bus)
    await registry.start()
    drain(sub)
    await registry.ir.send(ON_SEND)
    first = await next_event(sub, HwProjectorPowerReadingEvent)
    assert first.data.watts == 12.0
    await registry.stop()


async def test_real_projector_ignores_fake_ir() -> None:
    bus = EventBus(256)
    registry = build_registry(make_settings(drivers="projector_power=real"), bus)
    await registry.start()
    assert (await registry.ir.send(ON_SEND)).ok is True
    assert registry.snapshot().projector_power.reading is None
    await registry.stop()
```

**Test:** `services/hw/tests/test_ir.py` — `test_nothing_received_times_out_until_switched_off` (driver) and the extra route calls in `test_routes`; `tests/test_registry.py` lists the new route in fake mode.

**Verify:** `pnpm hw:check` → ruff clean, `134 passed`. Then `pnpm verify` green.

**Commit:** `git add -A && git commit -m "test(hw): fake IR 'nothing received' switch"` (with the ticked box in this plan)


### T2 — Config: IR learn HTTP timeout and `RESTART_COMMAND`
- [x] done

**Files:** `apps/core-api/src/config.ts`, `apps/core-api/test/config.test.ts`

**Context:** ARCHITECTURE §6.3 (IR learn 25 s), M09 scope "restart (runs the configured `RESTART_COMMAND`)", notes "`RESTART_COMMAND` is config; never shell out with user input". Default unset (M10 sets it on the Pi).

**Do:**

1. Replace the whole file `apps/core-api/src/config.ts`:
```ts
import { z } from "zod";

// zod at the env boundary (CLAUDE.md, ARCHITECTURE §6.1). Every knob core-api reads lives here.

const Bool = z.enum(["true", "false"]).transform((value) => value === "true");
const Ms = z.coerce.number().int().positive();

export const Config = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  HOST: z.string().min(1).default("0.0.0.0"),
  DB_PATH: z.string().min(1),
  HW_URL: z.url().default("http://127.0.0.1:8081"),
  /** Signs the `ec_sid` cookie. */
  COOKIE_SECRET: z.string().min(32, "COOKIE_SECRET must be at least 32 characters"),
  ROOM_ID: z.string().min(1).default("R-101"),
  ROOM_HOSTNAME: z.string().min(1).default("r-101.local"),
  /** D-09: a loopback socket address is the kiosk. Off unless set (dev's Vite proxy makes everyone local). */
  LOCALHOST_IS_KIOSK: Bool.default(false),
  /** Seeded into `settings` on first boot only (ARCHITECTURE §5). */
  INITIAL_ROOM_PIN: z.string().regex(/^\d{4}$/, "INITIAL_ROOM_PIN must be 4 digits").optional(),
  INITIAL_TECH_PIN: z.string().regex(/^\d{6}$/, "INITIAL_TECH_PIN must be 6 digits").optional(),
  /** Built SPA (apps/kiosk/dist). Unset in dev: Vite serves the SPA. */
  KIOSK_DIST: z.string().min(1).optional(),
  /** Dev only: give the seeded IR commands the codes the fake hw-service reacts to. */
  SEED_FAKE_IR_CODES: Bool.default(false),
  // Per-transport command timeouts (ARCHITECTURE §6.3, Q12 [ASSUMED]).
  TIMEOUT_ZIGBEE_MS: Ms.default(5000),
  TIMEOUT_IR_SEND_MS: Ms.default(3000),
  TIMEOUT_HDMI_MS: Ms.default(5000),
  TIMEOUT_MIXER_MS: Ms.default(2000),
  TIMEOUT_SCREEN_MS: Ms.default(5000),
  /** §6.3/§6.9: hw-service blocks a learn up to the 20 s window; the HTTP call may take this long. */
  TIMEOUT_IR_LEARN_MS: Ms.default(25_000),
  /** S3e "Restart controller": split on spaces and run without a shell (M10 sets it). Unset: core-api exits. */
  RESTART_COMMAND: z.string().trim().min(1).optional(),
  /** §6.7: hw down this long ⇒ every hw-backed device offline. */
  HW_DOWN_GRACE_MS: Ms.default(10_000),
  /** §6.3: no SSE frame this long ⇒ the stream is dead and reconnects. */
  HW_STREAM_DEAD_MS: Ms.default(15_000),
  // R13 expected report intervals [ASSUMED] (Q12); stale after 2×.
  CLIMATE_REPORT_INTERVAL_S: z.coerce.number().int().positive().default(300),
  POWER_REPORT_INTERVAL_S: z.coerce.number().int().positive().default(60),
});

export type Config = z.infer<typeof Config>;

/** Parses `process.env`; prints every problem and exits on a bad environment. */
export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
  const parsed = Config.safeParse(env);
  if (parsed.success) return parsed.data;
  const lines = parsed.error.issues.map((issue) => `  ${issue.path.join(".")}: ${issue.message}`);
  throw new Error(`Invalid core-api environment:\n${lines.join("\n")}`);
}
```

2. Replace the whole file `apps/core-api/test/config.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.ts";

const BASE = { DB_PATH: "/tmp/x.db", COOKIE_SECRET: "x".repeat(32) };

describe("config", () => {
  it("applies defaults", () => {
    const config = loadConfig(BASE);
    expect(config).toMatchObject({ PORT: 3000, HOST: "0.0.0.0", HW_URL: "http://127.0.0.1:8081", ROOM_ID: "R-101", ROOM_HOSTNAME: "r-101.local" });
    expect(config).toMatchObject({ LOCALHOST_IS_KIOSK: false, SEED_FAKE_IR_CODES: false, TIMEOUT_IR_SEND_MS: 3000, HW_DOWN_GRACE_MS: 10_000 });
    expect(config).toMatchObject({ TIMEOUT_IR_LEARN_MS: 25_000 });
    expect(config.RESTART_COMMAND).toBeUndefined();
  });
  it("keeps RESTART_COMMAND as one trimmed string", () => {
    expect(loadConfig({ ...BASE, RESTART_COMMAND: " sudo systemctl restart eduscope.target " }).RESTART_COMMAND).toBe(
      "sudo systemctl restart eduscope.target",
    );
  });
  it("parses booleans and numbers from strings", () => {
    expect(loadConfig({ ...BASE, LOCALHOST_IS_KIOSK: "true", PORT: "80" })).toMatchObject({ LOCALHOST_IS_KIOSK: true, PORT: 80 });
  });
  it("lists every problem", () => {
    expect(() => loadConfig({ DB_PATH: "", COOKIE_SECRET: "short", INITIAL_ROOM_PIN: "12345", LOCALHOST_IS_KIOSK: "yes" })).toThrow(
      /DB_PATH[\s\S]*COOKIE_SECRET must be at least 32 characters[\s\S]*LOCALHOST_IS_KIOSK[\s\S]*INITIAL_ROOM_PIN must be 4 digits/,
    );
  });
});
```

**Test:** `apps/core-api/test/config.test.ts` — defaults include `TIMEOUT_IR_LEARN_MS: 25000` and no `RESTART_COMMAND`; a padded command is trimmed.

**Verify:** `pnpm --filter @eduscope/core-api test` → `206 passed`. `pnpm verify` green.

**Commit:** `git add -A && git commit -m "feat(core-api): config for IR learn timeout and restart command"` (with the ticked box in this plan)


### T3 — hw client: learn, cancel, permit join
- [x] done

**Files:** `apps/core-api/src/app.ts`, `apps/core-api/src/hw/client.ts`, `apps/core-api/test/commands/policies.test.ts`, `apps/core-api/test/commands/setup.ts`, `apps/core-api/test/helpers.ts`, `apps/core-api/test/hw/client.test.ts`

**Context:** ARCHITECTURE §3.4 rows `POST /v1/ir/learn` (blocks ≤ `timeout_s`, answers `HwIrLearnResult`), `/v1/ir/learn/cancel`, `/v1/zigbee_status/permit_join`. Same failure model as M08 D3: nothing throws; a learn that could not reach hw answers `{status: "failed", message}` (new type `IrLearnOutcome`). `HwTimeouts` gains `irLearnMs`, so the three test constants that build `HwTimeouts` get the field. The test `fakeHw()` gets `irLearn` (answer queue `nextLearns`, default captured `"Q0FQVFVSRUQ="`; a test can push a Promise to hold a capture open), `irLearnCancel`, `permitJoin`.

**Do:**

1. Patch `apps/core-api/src/app.ts` (171 lines, so only the change is shown). Run from the repo root; it must print nothing:
```sh
git apply --whitespace=nowarn <<'PATCH'
diff --git a/apps/core-api/src/app.ts b/apps/core-api/src/app.ts
index 79325ff..e12c251 100644
--- a/apps/core-api/src/app.ts
+++ b/apps/core-api/src/app.ts
@@ -67,6 +67,7 @@ export function hwTimeouts(config: Config): HwTimeouts {
   return {
     zigbeeMs: config.TIMEOUT_ZIGBEE_MS,
     irSendMs: config.TIMEOUT_IR_SEND_MS,
+    irLearnMs: config.TIMEOUT_IR_LEARN_MS,
     hdmiMs: config.TIMEOUT_HDMI_MS,
     mixerMs: config.TIMEOUT_MIXER_MS,
     screenMs: config.TIMEOUT_SCREEN_MS,
PATCH
```

2. Replace the whole file `apps/core-api/src/hw/client.ts`:
```ts
import {
  HwAck, HwIrLearnResult, type HwAudioLevelRequest, type HwAudioMuteRequest, type HwHdmiSelectRequest,
  type HwIrLearnRequest, type HwIrSendRequest, type HwLightsSetRequest, type HwProjectionScreenMoveRequest,
  type HwProjectorPowerRelayRequest, type HwZigbeeStatusPermitJoinRequest,
} from "@eduscope/contracts";
import type { z } from "zod";

// ARCHITECTURE §3.4 / §6.3: core-api → hw-service commands. Every outcome is an HwAck: an
// unreachable service, a timeout or a bad answer become `{ok:false}` so the dispatcher has one path.
// A learn answers HwIrLearnResult instead, or `failed` when hw-service could not be asked (§6.9).

/** `/v1/ir/learn` outcome: hw's answer, or `failed` (unreachable, HTTP timeout, bad answer). */
export type IrLearnOutcome = HwIrLearnResult | { status: "failed"; message: string };

export interface HwClient {
  lightsSet(body: HwLightsSetRequest): Promise<HwAck>;
  projectorRelay(body: HwProjectorPowerRelayRequest): Promise<HwAck>;
  irSend(body: HwIrSendRequest): Promise<HwAck>;
  /** Blocks until hw captures, times out or is cancelled (≤ timeout_s). */
  irLearn(body: HwIrLearnRequest): Promise<IrLearnOutcome>;
  irLearnCancel(): Promise<HwAck>;
  hdmiSelect(body: HwHdmiSelectRequest): Promise<HwAck>;
  screenMove(body: HwProjectionScreenMoveRequest): Promise<HwAck>;
  audioLevel(body: HwAudioLevelRequest): Promise<HwAck>;
  audioMute(body: HwAudioMuteRequest): Promise<HwAck>;
  permitJoin(body: HwZigbeeStatusPermitJoinRequest): Promise<HwAck>;
}

export interface HwTimeouts {
  zigbeeMs: number;
  irSendMs: number;
  irLearnMs: number;
  hdmiMs: number;
  mixerMs: number;
  screenMs: number;
}

type Failure = { code: "timeout" | "transport"; message: string };

export function createHwClient(options: { baseUrl: string; timeouts: HwTimeouts; fetch?: typeof fetch }): HwClient {
  const doFetch = options.fetch ?? globalThis.fetch.bind(globalThis);
  const { timeouts } = options;

  async function postParsed<S extends z.ZodType>(path: string, body: unknown, timeoutMs: number, schema: S): Promise<z.infer<S> | Failure> {
    let response: Response;
    try {
      response = await doFetch(`${options.baseUrl}${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      const timedOut = error instanceof DOMException && error.name === "TimeoutError";
      return timedOut ? { code: "timeout", message: `${path}: no answer in ${timeoutMs} ms` } : { code: "transport", message: "hw-service unreachable" };
    }
    const raw: unknown = await response.json().catch(() => null);
    const parsed = schema.safeParse(raw);
    if (parsed.success) return parsed.data;
    return { code: "transport", message: `${path}: unexpected answer (HTTP ${response.status})` };
  }

  const isFailure = (value: object): value is Failure => "code" in value && "message" in value && !("ok" in value);

  async function post(path: string, body: unknown, timeoutMs: number): Promise<HwAck> {
    const result = await postParsed(path, body, timeoutMs, HwAck);
    return isFailure(result) ? { ok: false, error: result } : result;
  }

  return {
    lightsSet: (body) => post("/v1/lights/set", body, timeouts.zigbeeMs),
    projectorRelay: (body) => post("/v1/projector_power/relay", body, timeouts.zigbeeMs),
    irSend: (body) => post("/v1/ir/send", body, timeouts.irSendMs),
    async irLearn(body) {
      const result = await postParsed("/v1/ir/learn", body, timeouts.irLearnMs, HwIrLearnResult);
      return isFailure(result) ? { status: "failed", message: result.message } : result;
    },
    irLearnCancel: () => post("/v1/ir/learn/cancel", {}, timeouts.irSendMs),
    hdmiSelect: (body) => post("/v1/hdmi/select", body, timeouts.hdmiMs),
    screenMove: (body) => post("/v1/projection_screen/move", body, timeouts.screenMs),
    audioLevel: (body) => post("/v1/audio/level", body, timeouts.mixerMs),
    audioMute: (body) => post("/v1/audio/mute", body, timeouts.mixerMs),
    permitJoin: (body) => post("/v1/zigbee_status/permit_join", body, timeouts.zigbeeMs),
  };
}
```

3. Replace the whole file `apps/core-api/test/commands/policies.test.ts`:
```ts
import type { CommandBody, HwEvent } from "@eduscope/contracts";
import { describe, expect, it } from "vitest";
import type { IrCodeLookup } from "../../src/commands/ir-codes.ts";
import { FAILURE_TEXT, planCommand, requiredAccess } from "../../src/commands/policies.ts";
import { derive } from "../../src/domain/derive.ts";
import { applyHwDown, applyHwEvent } from "../../src/domain/hw-events.ts";
import type { RoomModel } from "../../src/domain/model.ts";
import { bootModel, hwEvent, must, RULES, snapshotEvent, T0 } from "../helpers.ts";

const TIMEOUTS = { zigbeeMs: 5000, irSendMs: 3000, irLearnMs: 25_000, hdmiMs: 5000, mixerMs: 2000, screenMs: 5000 };

const ir = (codes: Record<string, string>): IrCodeLookup => ({
  find(deviceId, match) {
    const key = "role" in match ? `${deviceId}.${match.role}` : `${deviceId}.setpoint_${match.setpoint_c}`;
    const code = codes[key];
    return code === undefined ? { ok: false, message: `${key} has no captured IR code` } : { ok: true, code, transport: "ir_zs06" };
  },
});
const CODES = ir({ "projector.power_on": "ON", "ac.power_off": "AC-OFF", "ac.setpoint_24": "AC-24", "ac.setpoint_26": "AC-26" });

/** R-101 live (snapshot applied, derived), plus any extra hw events. */
function live(...events: HwEvent[]): RoomModel {
  let model = applyHwEvent(bootModel({ acSetpoints: [24, 26] }), snapshotEvent());
  for (const event of events) model = applyHwEvent(model, event);
  return derive(model, new Date(T0), RULES);
}

const refusal = (body: CommandBody, model: RoomModel = live(), codes: IrCodeLookup = CODES) => {
  const result = planCommand(body, model, codes, TIMEOUTS);
  return result.ok ? null : { status: result.status, code: result.code, message: result.message };
};

describe("command policies (§6.5)", () => {
  it("R14: projector mains needs technician, everything else control", () => {
    expect(requiredAccess({ kind: "projector.mains", on: false })).toBe("technician");
    expect(requiredAccess({ kind: "lights.set", gang: "rear", on: true })).toBe("control");
  });

  it("hw down → 503 hw_unavailable for every kind", () => {
    const down = derive(applyHwDown(live(), T0), new Date(T0), RULES);
    expect(refusal({ kind: "lights.set", gang: "rear", on: true }, down)).toEqual({ status: 503, code: "hw_unavailable", message: "Hardware service offline" });
  });

  it.each([
    [{ kind: "projector.mains", on: false }, "Projector still draws 287 W · mains stays on until it cools"], // R11
    [{ kind: "ac.step", direction: "up" }, "Turn the air conditioning on first"], // Q5
    [{ kind: "projector.power", on: false }, "projector.power_off has no captured IR code"], // ir_code_missing
  ] as const)("%j → 409 %s", (body, message) => {
    expect(refusal(body)).toEqual({ status: 409, code: "precondition", message });
  });

  it("H8/H25: device offline and blaster offline", () => {
    const lights = must(live().state.zigbee.nodes.find((n) => n.friendly_name === "r101_lights"));
    expect(refusal({ kind: "lights.set", gang: "rear", on: true }, live(hwEvent("zigbee.node", { ...lights, online: false })))?.message).toBe("Lighting switch offline");
    expect(refusal({ kind: "ac.power", on: false }, live(hwEvent("ir.blaster", { online: false, lqi: null })))?.message).toBe("IR blaster offline");
  });

  it("AC power on without any captured setpoint frame", () => {
    const model = derive(applyHwEvent(bootModel({ acSetpoints: [] }), snapshotEvent()), new Date(T0), RULES);
    expect(refusal({ kind: "ac.power", on: true }, model)?.message).toBe("Air conditioning has no captured setpoint frame");
  });

  it("plans carry the output key, the transport timeout and the H6a text", () => {
    const lights = planCommand({ kind: "lights.set", gang: "front", on: false }, live(), CODES, TIMEOUTS);
    expect(lights.ok && { key: lights.plan.key, timeoutMs: lights.plan.timeoutMs, failureText: lights.plan.failureText, ir: lights.plan.ir })
      .toEqual({ key: "lights.front", timeoutMs: 5000, failureText: FAILURE_TEXT.zigbee, ir: false });
    const ac = planCommand({ kind: "ac.power", on: true }, live(), CODES, TIMEOUTS);
    expect(ac.ok && { key: ac.plan.key, timeoutMs: ac.plan.timeoutMs, failureText: ac.plan.failureText, ir: ac.plan.ir })
      .toEqual({ key: "ac", timeoutMs: 3000, failureText: "Couldn't reach the blaster", ir: true });
    const unmute = planCommand({ kind: "audio.mute_all", muted: false }, live(), CODES, TIMEOUTS);
    expect(unmute.ok && unmute.plan.calls.length).toBe(2); // nothing saved yet: no level restore
  });
});
```

4. Replace the whole file `apps/core-api/test/commands/setup.ts`:
```ts
import type { Command, CommandBody, HwEvent, ServerEvent } from "@eduscope/contracts";
import { fixedClock } from "../../src/clock.ts";
import { createDispatcher, type Issuer } from "../../src/commands/dispatcher.ts";
import type { IrCodeLookup } from "../../src/commands/ir-codes.ts";
import type { LogEntry } from "../../src/db/event-log.ts";
import { applyHwEvent } from "../../src/domain/hw-events.ts";
import type { KwhBaseline } from "../../src/domain/model.ts";
import { createStateStore } from "../../src/domain/state-store.ts";
import { createIngest } from "../../src/hw/ingest.ts";
import { bootModel, fakeHw, RULES, snapshotEvent, T0 } from "../helpers.ts";

/** Short deadlines so timeout tests run on real timers. */
export const TEST_TIMEOUTS = { zigbeeMs: 60, irSendMs: 60, irLearnMs: 60, hdmiMs: 60, mixerMs: 60, screenMs: 60 };

export const PHONE: Issuer = { public_id: "pub-phone", label: "phone", access: "control" };
export const LAPTOP: Issuer = { public_id: "pub-laptop", label: "laptop", access: "control" };
export const TECH: Issuer = { public_id: "pub-tech", label: "laptop", access: "technician" };

/** Captured codes by "<device>.<role>" / "<device>.setpoint_<t>"; anything else is missing. */
export function irStub(codes: Record<string, string>): IrCodeLookup {
  return {
    find(deviceId, match) {
      const key = "role" in match ? `${deviceId}.${match.role}` : `${deviceId}.setpoint_${match.setpoint_c}`;
      const code = codes[key];
      return code === undefined ? { ok: false, message: `${key} has no captured IR code` } : { ok: true, code, transport: "ir_zs06" };
    },
  };
}

const ALL_CODES = {
  "projector.power_on": "ON", "projector.power_off": "OFF", "ac.power_off": "AC-OFF",
  ...Object.fromEntries([18, 20, 22, 24, 26, 28, 30].map((t) => [`ac.setpoint_${t}`, `AC-${t}`])),
};

/** A live room (fixture snapshot applied, hw up) with dispatcher + ingest wired like app.ts. */
export function room(options: { codes?: Record<string, string> } = {}) {
  const clock = fixedClock(T0);
  const hw = fakeHw();
  const events: ServerEvent[] = [];
  const logs: LogEntry[] = [];
  const baselines: KwhBaseline[] = [];
  const ticks: number[] = [];
  const store = createStateStore({
    initial: applyHwEvent(bootModel({ acSetpoints: [18, 20, 22, 24, 26, 28, 30] }), snapshotEvent()),
    clock, rules: RULES, coalesceMs: 0,
  });
  store.subscribe((state) => events.push({ type: "state", state }));
  const emit = (event: ServerEvent): void => {
    events.push(event);
  };
  const log = (entry: LogEntry): void => {
    logs.push(entry);
  };
  const dispatcher = createDispatcher({ store, hw, ir: irStub(options.codes ?? ALL_CODES), timeouts: TEST_TIMEOUTS, clock, emit, log });
  const ingest = createIngest({
    store, dispatcher, emit, log, hwDownGraceMs: 10_000,
    persistBaseline: (baseline) => baselines.push(baseline),
    scheduleTick: (ms) => ticks.push(ms),
  });
  let seq = 0;
  const send = (body: CommandBody, issuer: Issuer = PHONE): Command =>
    dispatcher.dispatch({ client_cmd_id: `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`, body }, issuer);
  const statuses = (command: Command): string[] =>
    events.flatMap((e) => (e.type === "command" && e.command.id === command.id ? [e.command.status] : []));
  const activities = (): string[] => events.flatMap((e) => (e.type === "activity" ? [`${e.text} · ${e.by}`] : []));
  /** A hw report, through ingest (attribution, correlation). */
  const report = (event: HwEvent): void => ingest.handle(event);
  /** Makes the fake hw answer every command with the matching report, like the real fake service. */
  const echo = (toEvent: (method: string, body: unknown) => HwEvent | null): void => {
    hw.onCall = (method, body) => {
      const event = toEvent(method, body);
      if (event !== null) ingest.handle(event);
    };
  };
  return { clock, hw, events, logs, baselines, ticks, store, dispatcher, ingest, send, statuses, activities, report, echo };
}
```

5. Replace the whole file `apps/core-api/test/helpers.ts`:
```ts
import { readdirSync, readFileSync } from "node:fs";
import { DeviceKind, HwEvent, Transport, type HwAck } from "@eduscope/contracts";
import { vi } from "vitest";
import { Config } from "../src/config.ts";
import type { HwClient, IrLearnOutcome } from "../src/hw/client.ts";
import { initialModel } from "../src/domain/initial.ts";
import type { DeviceInfo, RoomModel, RuleConfig } from "../src/domain/model.ts";
import { SEED_DEVICES } from "../src/db/seed.ts";

/** Screenshot clock (Mon 5 Oct 10:42 UTC); every test that needs "now" starts here. */
export const T0 = "2026-10-05T10:42:00.000Z";

/** A complete, valid config for tests; override any key. */
export function testConfig(overrides: Partial<Record<keyof Config, string>> = {}): Config {
  return Config.parse({
    DB_PATH: ":memory:",
    COOKIE_SECRET: "test-cookie-secret-test-cookie-secret",
    INITIAL_ROOM_PIN: "1234",
    INITIAL_TECH_PIN: "123456",
    ...overrides,
  });
}

export const RULES: RuleConfig = { climateIntervalS: 300, powerIntervalS: 60, hwDownGraceMs: 10_000 };

/** The seeded R-101 registry as domain DeviceInfo. */
export const REGISTRY: DeviceInfo[] = SEED_DEVICES.map((row) => ({
  id: row.id, name: row.name, kind: DeviceKind.parse(row.kind), transport: Transport.parse(row.transport),
  brand: row.brand ?? null, model: row.model ?? null, hw_ref: row.hw_ref ?? null,
}));

export function bootModel(overrides: Partial<Parameters<typeof initialModel>[0]> = {}): RoomModel {
  return initialModel({
    room: { id: "R-101", hostname: "r-101.local" },
    registry: REGISTRY,
    acSetpoints: [18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30],
    interlockBypassed: false,
    kwhBaseline: null,
    now: T0,
    ...overrides,
  });
}

const FIXTURES = new URL("../../../packages/contracts/fixtures/hw/", import.meta.url);

/** A parsed fixtures/hw file. */
export function hwFixture(name: string): unknown {
  return JSON.parse(readFileSync(new URL(name, FIXTURES), "utf8"));
}

/** Every `event.*.json` in fixtures/hw, parsed as HwEvent. */
export function hwEventFixtures(): { name: string; event: HwEvent }[] {
  return readdirSync(FIXTURES)
    .filter((name) => name.startsWith("event.") && name.endsWith(".json"))
    .sort()
    .map((name) => ({ name, event: HwEvent.parse(hwFixture(name)) }));
}

/** The fixture snapshot event (screenshot 01 state), with its time moved to `at`. */
export function snapshotEvent(at: string = T0): HwEvent {
  const event = HwEvent.parse(hwFixture("event.snapshot.json"));
  return { ...event, at };
}

export function hwEvent<T extends HwEvent["type"]>(type: T, data: Extract<HwEvent, { type: T }>["data"], at: string = T0): HwEvent {
  return HwEvent.parse({ type, at, data });
}

export interface FakeHw extends HwClient {
  calls: { method: keyof HwClient; body: unknown }[];
  /** Answer of the next calls (default `{ok:true}`). */
  nextAcks: HwAck[];
  /** Answer of the next `irLearn` calls (default captured "Q0FQVFVSRUQ="); a promise lets a test hold the learn open. */
  nextLearns: (IrLearnOutcome | Promise<IrLearnOutcome>)[];
  /** Runs after each call is recorded (e.g. to feed the echo event into ingest). */
  onCall?: (method: keyof HwClient, body: unknown) => void;
}

export function fakeHw(): FakeHw {
  const hw: FakeHw = {
    calls: [],
    nextAcks: [],
    nextLearns: [],
    lightsSet: vi.fn(async (body) => record("lightsSet", body)),
    projectorRelay: vi.fn(async (body) => record("projectorRelay", body)),
    irSend: vi.fn(async (body) => record("irSend", body)),
    hdmiSelect: vi.fn(async (body) => record("hdmiSelect", body)),
    screenMove: vi.fn(async (body) => record("screenMove", body)),
    audioLevel: vi.fn(async (body) => record("audioLevel", body)),
    audioMute: vi.fn(async (body) => record("audioMute", body)),
    irLearnCancel: vi.fn(async () => record("irLearnCancel", {})),
    permitJoin: vi.fn(async (body) => record("permitJoin", body)),
    irLearn: vi.fn(async (body): Promise<IrLearnOutcome> => {
      hw.calls.push({ method: "irLearn", body });
      hw.onCall?.("irLearn", body);
      return hw.nextLearns.shift() ?? { status: "captured", code_format: "tuya", code: "Q0FQVFVSRUQ=" };
    }),
  };
  function record(method: keyof HwClient, body: unknown): HwAck {
    hw.calls.push({ method, body });
    hw.onCall?.(method, body);
    return hw.nextAcks.shift() ?? { ok: true };
  }
  return hw;
}

/** Unwraps a value a test knows is there (no `!` allowed by lint). */
export function must<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) throw new Error("expected a value");
  return value;
}
```

6. Replace the whole file `apps/core-api/test/hw/client.test.ts`:
```ts
import { describe, expect, it, vi } from "vitest";
import { createHwClient } from "../../src/hw/client.ts";
import { must } from "../helpers.ts";

const TIMEOUTS = { zigbeeMs: 5000, irSendMs: 3000, irLearnMs: 25_000, hdmiMs: 5000, mixerMs: 2000, screenMs: 5000 };

describe("hw client", () => {
  it("POSTs JSON to the §3.4 path and returns the parsed ack", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => Response.json({ ok: true }));
    const hw = createHwClient({ baseUrl: "http://127.0.0.1:8081", timeouts: TIMEOUTS, fetch });
    expect(await hw.lightsSet({ gang: "rear", on: true })).toEqual({ ok: true });
    const [url, init] = must(fetch.mock.calls[0]);
    expect(url).toBe("http://127.0.0.1:8081/v1/lights/set");
    expect(init?.method).toBe("POST");
    expect(init?.body).toBe('{"gang":"rear","on":true}');
  });

  it("passes a hw error ack through", async () => {
    const ack = { ok: false, error: { code: "device_offline", message: "r101_ir is offline" } };
    const hw = createHwClient({ baseUrl: "", timeouts: TIMEOUTS, fetch: vi.fn(async () => Response.json(ack)) });
    expect(await hw.irSend({ transport: "ir_zs06", code_format: "tuya", code: "x" })).toEqual(ack);
  });

  it.each([
    ["unreachable", async () => Promise.reject(new TypeError("fetch failed")), "transport"],
    ["timeout", async () => Promise.reject(new DOMException("timed out", "TimeoutError")), "timeout"],
    ["bad answer", async () => Response.json({ nope: 1 }, { status: 500 }), "transport"],
  ] as const)("%s → ok:false %s", async (_name, impl, code) => {
    const hw = createHwClient({ baseUrl: "", timeouts: TIMEOUTS, fetch: vi.fn(impl) });
    expect(await hw.audioLevel({ channel: "mic", level: 10 })).toMatchObject({ ok: false, error: { code } });
  });

  it("learn returns hw's result, cancel and permit join POST to their paths", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async (url) =>
      Response.json(String(url).endsWith("/v1/ir/learn") ? { status: "captured", code_format: "tuya", code: "QUJD" } : { ok: true }),
    );
    const hw = createHwClient({ baseUrl: "", timeouts: TIMEOUTS, fetch });
    expect(await hw.irLearn({ transport: "ir_zs06", timeout_s: 20 })).toEqual({ status: "captured", code_format: "tuya", code: "QUJD" });
    expect(await hw.irLearnCancel()).toEqual({ ok: true });
    expect(await hw.permitJoin({ seconds: 240 })).toEqual({ ok: true });
    expect(fetch.mock.calls.map(([url]) => url)).toEqual(["/v1/ir/learn", "/v1/ir/learn/cancel", "/v1/zigbee_status/permit_join"]);
    expect(must(fetch.mock.calls[0])[1]?.body).toBe('{"transport":"ir_zs06","timeout_s":20}');
  });

  it.each([
    ["unreachable", async () => Promise.reject(new TypeError("fetch failed"))],
    ["timeout", async () => Promise.reject(new DOMException("timed out", "TimeoutError"))],
    ["bad answer", async () => Response.json({ ok: true })],
  ] as const)("learn %s → failed", async (_name, impl) => {
    const hw = createHwClient({ baseUrl: "", timeouts: TIMEOUTS, fetch: vi.fn(impl) });
    expect(await hw.irLearn({ transport: "ir_zs06", timeout_s: 20 })).toMatchObject({ status: "failed" });
  });
});
```

**Test:** `apps/core-api/test/hw/client.test.ts` — learn returns hw's result; cancel/permit-join paths; learn unreachable / timeout / bad answer → `failed`.

**Verify:** `pnpm --filter @eduscope/core-api typecheck` clean; `pnpm --filter @eduscope/core-api test` → `210 passed`. `pnpm verify` green.

**Commit:** `git add -A && git commit -m "feat(core-api): hw client learn, cancel and permit join"` (with the ticked box in this plan)


### T4 — Seed: registry rows on first boot only
- [x] done

**Files:** `apps/core-api/src/db/seed.ts`, `apps/core-api/test/db/seed.test.ts`

**Context:** S3d "remove" and S3 command deletion must survive a restart. M08's seed re-inserts every missing seeded device/IR command (`onConflictDoNothing`), so a removed device would come back. Now devices + IR commands are inserted only when `devices` is empty; settings stay "insert if missing"; `SEED_FAKE_IR_CODES` still fills only missing codes.

**Do:**

1. Replace the whole file `apps/core-api/src/db/seed.ts`:
```ts
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { hashPin } from "../auth/pin-hash.ts";
import type { Config } from "../config.ts";
import type { Db } from "./client.ts";
import { readSetting, writeSetting } from "./settings.ts";
import { devices, irCommands } from "./schema.ts";

// Idempotent first-boot data for R-101 (ARCHITECTURE §6.2). Devices and IR commands are inserted
// only into an empty registry (a device or command removed in S3/S3d stays removed); settings are
// "insert if missing". A restart never duplicates rows and never overwrites a PIN, a rename or a code.

type DeviceRow = typeof devices.$inferInsert;
type IrCommandRow = typeof irCommands.$inferInsert;

/** Ids equal fixtures/state/room-normal.json: the kiosk looks devices up by these ids. */
export const SEED_DEVICES: readonly DeviceRow[] = [
  { id: "projector", name: "Projector", kind: "projector", transport: "ir_zs06", brand: "Epson", model: null, hw_ref: null, sort: 1 },
  { id: "hdmi_switch", name: "HDMI switch", kind: "hdmi_switch", transport: "local", brand: null, model: null, hw_ref: null, sort: 2 },
  { id: "projection_screen", name: "Projection screen", kind: "projection_screen", transport: "local", brand: null, model: null, hw_ref: null, sort: 3 },
  { id: "lights", name: "Lighting switch", kind: "lights", transport: "zigbee", brand: null, model: "ZBM5-2C-86W", hw_ref: "r101_lights", sort: 4 },
  { id: "ac", name: "Air conditioning", kind: "ac", transport: "ir_zs06", brand: "Panasonic", model: null, hw_ref: null, sort: 5 },
  { id: "audio", name: "Audio mixer", kind: "audio", transport: "local", brand: null, model: null, hw_ref: null, sort: 6 },
  { id: "projector_socket", name: "Projector socket", kind: "power_socket", transport: "zigbee", brand: null, model: "S60ZBTPG", hw_ref: "r101_proj_plug", sort: 7 },
  { id: "room_climate", name: "Room climate", kind: "sensor", transport: "zigbee", brand: null, model: "SNZB-02P", hw_ref: "r101_temp", sort: 8 },
  { id: "motion", name: "Motion", kind: "sensor", transport: "zigbee", brand: null, model: "SNZB-03P", hw_ref: "r101_motion", sort: 9 },
  { id: "door", name: "Door", kind: "sensor", transport: "zigbee", brand: null, model: "SNZB-04PR2", hw_ref: "r101_door", sort: 10 },
  { id: "ir_blaster", name: "ZS06", kind: "ir_blaster", transport: "zigbee", brand: null, model: "ZS06", hw_ref: "r101_ir", sort: 11 },
  { id: "coordinator", name: "Coordinator", kind: "coordinator", transport: "local", brand: null, model: "ZG-808Z", hw_ref: "zigbee-coord", sort: 12 },
];

/** AC setpoint frames 18–30 °C, cool, auto fan (Q23 [ASSUMED]). */
export const SEED_AC_SETPOINTS = [18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30] as const;

function irCommand(id: string, deviceId: string, name: string, role: string, sort: number, tempC: number | null = null): IrCommandRow {
  return {
    id, device_id: deviceId, name, role, sort, code_format: "tuya", code: null, captured_at: null, test: "untested", tested_at: null,
    setpoint_temp_c: tempC, setpoint_mode: tempC === null ? null : "cool", setpoint_fan: tempC === null ? null : "auto",
  };
}

/** Projector 2 + AC 14 (power off + 13 setpoints), all without a code until M09 learns them. */
export const SEED_IR_COMMANDS: readonly IrCommandRow[] = [
  irCommand("projector.power_on", "projector", "Power on", "power_on", 1),
  irCommand("projector.power_off", "projector", "Power off", "power_off", 2),
  irCommand("ac.power_off", "ac", "Power off", "power_off", 1),
  ...SEED_AC_SETPOINTS.map((temp, i) => irCommand(`ac.setpoint_${temp}`, "ac", `${temp}°`, "setpoint", i + 2, temp)),
];

/** Equal to hw-service's HW_FAKE_PROJECTOR_ON/OFF_CODE defaults (services/hw/app/config.py). */
export const FAKE_PROJECTOR_CODES: Readonly<Record<string, string>> = {
  "projector.power_on": "C/8hRgHrBkYBgAMH",
  "projector.power_off": "C/8hRgHrBkYBgAMP",
};

const fakeCode = (id: string): string => FAKE_PROJECTOR_CODES[id] ?? Buffer.from(`fake:${id}`).toString("base64");

export async function seed(db: Db, config: Pick<Config, "INITIAL_ROOM_PIN" | "INITIAL_TECH_PIN" | "SEED_FAKE_IR_CODES">, now: string): Promise<void> {
  if (db.select({ id: devices.id }).from(devices).limit(1).all().length === 0) {
    db.insert(devices).values([...SEED_DEVICES]).run();
    db.insert(irCommands).values([...SEED_IR_COMMANDS]).run();
  }

  if (config.SEED_FAKE_IR_CODES) {
    for (const command of SEED_IR_COMMANDS) {
      db.update(irCommands)
        .set({ code: fakeCode(command.id), captured_at: now })
        .where(and(eq(irCommands.id, command.id), isNull(irCommands.code)))
        .run();
    }
  }

  if (readSetting(db, "room_pin_hash", z.string()) === null) {
    if (config.INITIAL_ROOM_PIN === undefined) throw new Error("INITIAL_ROOM_PIN is required on first boot");
    writeSetting(db, "room_pin_hash", await hashPin(config.INITIAL_ROOM_PIN), now);
  }
  if (readSetting(db, "technician_pin_hash", z.string()) === null) {
    if (config.INITIAL_TECH_PIN === undefined) throw new Error("INITIAL_TECH_PIN is required on first boot");
    writeSetting(db, "technician_pin_hash", await hashPin(config.INITIAL_TECH_PIN), now);
  }
  if (readSetting(db, "interlock_bypass", z.boolean()) === null) writeSetting(db, "interlock_bypass", false, now);
}
```

2. Replace the whole file `apps/core-api/test/db/seed.test.ts`:
```ts
import { eq } from "drizzle-orm";
import { z } from "zod";
import { describe, expect, it } from "vitest";
import { verifyPin } from "../../src/auth/pin-hash.ts";
import { openDb } from "../../src/db/client.ts";
import { devices, irCommands } from "../../src/db/schema.ts";
import { FAKE_PROJECTOR_CODES, seed } from "../../src/db/seed.ts";
import { readSetting } from "../../src/db/settings.ts";
import { testConfig } from "../helpers.ts";

const NOW = "2026-10-05T10:42:00.000Z";

describe("seed", () => {
  it("creates the R-101 devices, 16 IR commands without codes and both PIN hashes", async () => {
    const { db } = openDb(":memory:");
    await seed(db, testConfig(), NOW);
    expect(db.select().from(devices).all().map((d) => d.id)).toHaveLength(12);
    const commands = db.select().from(irCommands).all();
    expect(commands.filter((c) => c.device_id === "projector")).toHaveLength(2);
    expect(commands.filter((c) => c.device_id === "ac")).toHaveLength(14);
    expect(commands.every((c) => c.code === null)).toBe(true);
    const roomHash = readSetting(db, "room_pin_hash", z.string());
    expect(roomHash).toMatch(/^scrypt\$16384\$8\$1\$/);
    expect(await verifyPin("1234", roomHash ?? "")).toBe(true);
    expect(await verifyPin("123456", readSetting(db, "technician_pin_hash", z.string()) ?? "")).toBe(true);
    expect(readSetting(db, "interlock_bypass", z.boolean())).toBe(false);
  });

  it("is idempotent and never overwrites a PIN hash", async () => {
    const { db } = openDb(":memory:");
    await seed(db, testConfig(), NOW);
    const hash = readSetting(db, "room_pin_hash", z.string());
    await seed(db, testConfig({ INITIAL_ROOM_PIN: "9999" }), NOW);
    expect(db.select().from(devices).all()).toHaveLength(12);
    expect(db.select().from(irCommands).all()).toHaveLength(16);
    expect(readSetting(db, "room_pin_hash", z.string())).toBe(hash);
  });

  it("a removed device or IR command is not seeded again", async () => {
    const { db } = openDb(":memory:");
    await seed(db, testConfig(), NOW);
    db.delete(devices).where(eq(devices.id, "door")).run();
    db.delete(irCommands).where(eq(irCommands.id, "ac.setpoint_30")).run();
    await seed(db, testConfig(), NOW);
    expect(db.select().from(devices).all().map((d) => d.id)).not.toContain("door");
    expect(db.select().from(irCommands).all().map((c) => c.id)).not.toContain("ac.setpoint_30");
  });

  it("SEED_FAKE_IR_CODES fills only missing codes, with the fake projector codes", async () => {
    const { db } = openDb(":memory:");
    await seed(db, testConfig(), NOW);
    db.update(irCommands).set({ code: "learned" }).where(eq(irCommands.id, "ac.setpoint_24")).run();
    await seed(db, testConfig({ SEED_FAKE_IR_CODES: "true" }), NOW);
    const byId = new Map(db.select().from(irCommands).all().map((c) => [c.id, c]));
    expect(byId.get("projector.power_on")?.code).toBe(FAKE_PROJECTOR_CODES["projector.power_on"]);
    expect(byId.get("ac.setpoint_24")?.code).toBe("learned");
    expect(byId.get("ac.setpoint_18")?.captured_at).toBe(NOW);
  });

  it("fails on first boot without the initial PINs", async () => {
    const { db } = openDb(":memory:");
    const config = { ...testConfig(), INITIAL_ROOM_PIN: undefined };
    await expect(seed(db, config, NOW)).rejects.toThrow("INITIAL_ROOM_PIN is required on first boot");
  });
});
```

**Test:** `apps/core-api/test/db/seed.test.ts` — new case "a removed device or IR command is not seeded again".

**Verify:** `pnpm --filter @eduscope/core-api test` → `211 passed`. `pnpm verify` green.

**Commit:** `git add -A && git commit -m "fix(core-api): seed the registry on first boot only"` (with the ticked box in this plan)


### T5 — `db/devices.ts`: registry reads and writes
- [x] done

**Files:** `apps/core-api/src/app.ts`, `apps/core-api/src/db/devices.ts`, `apps/core-api/test/db/devices.test.ts`

**Context:** S3d edit/remove and the IR device list all read the `devices` table. `loadRegistry` moves here from `app.ts` (unchanged behaviour) next to `findDevice`, `nextDeviceSort`, `updateDevice` (only patched fields), `deleteDevice` (IR commands cascade, ARCHITECTURE §6.2).

**Do:**

1. Patch `apps/core-api/src/app.ts` (158 lines, so only the change is shown). Run from the repo root; it must print nothing:
```sh
git apply --whitespace=nowarn <<'PATCH'
diff --git a/apps/core-api/src/app.ts b/apps/core-api/src/app.ts
index e12c251..12e05a3 100644
--- a/apps/core-api/src/app.ts
+++ b/apps/core-api/src/app.ts
@@ -1,4 +1,3 @@
-import { DeviceKind, Transport } from "@eduscope/contracts";
 import cookie from "@fastify/cookie";
 import Fastify, { type FastifyInstance, type FastifyServerOptions } from "fastify";
 import { serializerCompiler, validatorCompiler } from "fastify-type-provider-zod";
@@ -10,12 +9,12 @@ import { createDispatcher, type Dispatcher } from "./commands/dispatcher.ts";
 import { capturedSetpoints, createIrCodeLookup } from "./commands/ir-codes.ts";
 import type { Config } from "./config.ts";
 import { openDb, type Db } from "./db/client.ts";
+import { loadRegistry } from "./db/devices.ts";
 import { createEventLogger } from "./db/event-log.ts";
-import { devices } from "./db/schema.ts";
 import { seed } from "./db/seed.ts";
 import { readSetting, writeSetting } from "./db/settings.ts";
 import { initialModel } from "./domain/initial.ts";
-import type { DeviceInfo, KwhBaseline } from "./domain/model.ts";
+import type { KwhBaseline } from "./domain/model.ts";
 import { createStateStore, type StateStore } from "./domain/state-store.ts";
 import type { HwClient, HwTimeouts } from "./hw/client.ts";
 import { createIngest, type Ingest } from "./hw/ingest.ts";
@@ -76,18 +75,6 @@ export function hwTimeouts(config: Config): HwTimeouts {
 
 const KwhBaselineSchema = z.object({ date: z.string(), kwh_total: z.number() });
 
-function loadRegistry(db: Db): DeviceInfo[] {
-  return db
-    .select()
-    .from(devices)
-    .orderBy(devices.sort)
-    .all()
-    .map((row) => ({
-      id: row.id, name: row.name, kind: DeviceKind.parse(row.kind), transport: Transport.parse(row.transport),
-      brand: row.brand, model: row.model, hw_ref: row.hw_ref,
-    }));
-}
-
 export async function buildApp(deps: AppDeps): Promise<FastifyInstance> {
   const { config, clock } = deps;
   const { db, close: closeDb } = openDb(deps.db);
PATCH
```

2. Create `apps/core-api/src/db/devices.ts`:
```ts
import { DeviceKind, Transport, type DevicePatch } from "@eduscope/contracts";
import { eq, max } from "drizzle-orm";
import type { DeviceInfo } from "../domain/model.ts";
import type { Db } from "./client.ts";
import { devices } from "./schema.ts";

// The `devices` registry (ARCHITECTURE §6.2, S3d). The store keeps a copy (`RoomModel.registry`);
// every write here is followed by `syncRegistry` (registry-sync.ts).

export type DeviceRow = typeof devices.$inferSelect;

export function toDeviceInfo(row: DeviceRow): DeviceInfo {
  return {
    id: row.id, name: row.name, kind: DeviceKind.parse(row.kind), transport: Transport.parse(row.transport),
    brand: row.brand, model: row.model, hw_ref: row.hw_ref,
  };
}

/** Every device in sort order. */
export function loadRegistry(db: Db): DeviceInfo[] {
  return db.select().from(devices).orderBy(devices.sort).all().map(toDeviceInfo);
}

export function findDevice(db: Db, id: string): DeviceInfo | null {
  const row = db.select().from(devices).where(eq(devices.id, id)).get();
  return row === undefined ? null : toDeviceInfo(row);
}

/** The sort value for a device added now (after every existing one). */
export function nextDeviceSort(db: Db): number {
  return (db.select({ value: max(devices.sort) }).from(devices).get()?.value ?? 0) + 1;
}

/** S3d edit sheet: only the fields present in the patch change. Returns null when the id is unknown. */
export function updateDevice(db: Db, id: string, patch: DevicePatch): DeviceInfo | null {
  const set: Partial<DeviceRow> = {
    ...(patch.name === undefined ? {} : { name: patch.name }),
    ...(patch.transport === undefined ? {} : { transport: patch.transport }),
    ...(patch.hw_ref === undefined ? {} : { hw_ref: patch.hw_ref }),
  };
  if (Object.keys(set).length > 0) db.update(devices).set(set).where(eq(devices.id, id)).run();
  return findDevice(db, id);
}

/** S3d remove; its IR commands go with it (FK cascade). False when the id is unknown. */
export function deleteDevice(db: Db, id: string): boolean {
  return db.delete(devices).where(eq(devices.id, id)).run().changes > 0;
}
```

3. Create `apps/core-api/test/db/devices.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { openDb } from "../../src/db/client.ts";
import { deleteDevice, findDevice, loadRegistry, nextDeviceSort, updateDevice } from "../../src/db/devices.ts";
import { irCommands } from "../../src/db/schema.ts";
import { seed } from "../../src/db/seed.ts";
import { T0, testConfig } from "../helpers.ts";

async function seeded() {
  const { db } = openDb(":memory:");
  await seed(db, testConfig(), T0);
  return db;
}

describe("devices registry", () => {
  it("loads the seeded registry in sort order", async () => {
    const db = await seeded();
    const registry = loadRegistry(db);
    expect(registry.map((d) => d.id).slice(0, 3)).toEqual(["projector", "hdmi_switch", "projection_screen"]);
    expect(registry.find((d) => d.id === "lights")).toEqual({
      id: "lights", name: "Lighting switch", kind: "lights", transport: "zigbee", brand: null, model: "ZBM5-2C-86W", hw_ref: "r101_lights",
    });
    expect(nextDeviceSort(db)).toBe(13);
  });

  it("updates only the patched fields", async () => {
    const db = await seeded();
    expect(updateDevice(db, "projector", { transport: "ir_mcu" })).toMatchObject({ name: "Projector", transport: "ir_mcu", brand: "Epson" });
    expect(updateDevice(db, "lights", { name: "Lights", hw_ref: null })).toMatchObject({ name: "Lights", transport: "zigbee", hw_ref: null });
    expect(updateDevice(db, "lights", {})).toMatchObject({ name: "Lights" });
    expect(updateDevice(db, "nope", { name: "x" })).toBeNull();
  });

  it("deletes a device with its IR commands", async () => {
    const db = await seeded();
    expect(deleteDevice(db, "ac")).toBe(true);
    expect(findDevice(db, "ac")).toBeNull();
    expect(db.select().from(irCommands).all().filter((c) => c.device_id === "ac")).toHaveLength(0);
    expect(deleteDevice(db, "ac")).toBe(false);
  });
});
```

**Test:** `apps/core-api/test/db/devices.test.ts` — sort order + `nextDeviceSort` 13; patch only touches given fields; unknown id null; delete cascades IR commands.

**Verify:** `pnpm --filter @eduscope/core-api test` → `214 passed`. `pnpm verify` green.

**Commit:** `git add -A && git commit -m "feat(core-api): device registry access in db/devices.ts"` (with the ticked box in this plan)


### T6 — IR domain rules (capture window, R5, H22, R4 uniqueness)
- [ ] done

**Files:** `apps/core-api/src/domain/ir.ts`, `apps/core-api/test/domain/ir.test.ts`

**Context:** SPEC H21 (20 s window), R5 (a new code is untested), H22 (reacted / no_reaction), R4 (one frame per setpoint, so one command per temperature per device), S3.E7 (IR device = ir_* transport), screenshot 03 order (by name). Pure, no DB.

**Do:**

1. Create `apps/core-api/src/domain/ir.ts`:
```ts
import type { DeviceKind, IrCommand, IrDevice, IrDeviceKind, IrTestStatus, IrTransport, Transport } from "@eduscope/contracts";

// S3 Remote configuration rules (ARCHITECTURE §6.9, H20–H22, R4, R5). Pure.

/** H21: how long the blaster listens; also the `timeout_s` sent to hw-service. */
export const IR_CAPTURE_WINDOW_S = 20;

/** An IR device is a registry device whose transport is ir_* (S3.E7). */
export function isIrTransport(transport: Transport): transport is IrTransport {
  return transport === "ir_zs06" || transport === "ir_mcu";
}

/** S3.E9 kinds: projector, AC, anything else is "other". */
export function irKind(kind: DeviceKind): IrDeviceKind {
  return kind === "projector" || kind === "ac" ? kind : "other";
}

/** S3 list order: by name (screenshot 03: Air conditioning, Projector). */
export function sortIrDevices(devices: readonly IrDevice[]): IrDevice[] {
  return [...devices].sort((a, b) => a.name.localeCompare(b.name));
}

/** Columns a successful capture writes. R5: a new code is untested. A failed capture writes nothing (H21). */
export function captureFields(code: string, at: string): { code: string; captured_at: string; test: IrTestStatus; tested_at: null } {
  return { code, captured_at: at, test: "untested", tested_at: null };
}

/** Columns the technician's answer writes (H22). */
export function testResultFields(reacted: boolean, at: string): { test: IrTestStatus; tested_at: string } {
  return { test: reacted ? "reacted" : "no_reaction", tested_at: at };
}

/** R4: each setpoint is one frame, so two commands may not claim the same temperature on one device. */
export function duplicateSetpoint(existing: readonly IrCommand[], tempC: number): string | null {
  return existing.some((command) => command.setpoint?.temp_c === tempC) ? `A ${tempC}° setpoint already exists` : null;
}
```

2. Create `apps/core-api/test/domain/ir.test.ts`:
```ts
import type { IrCommand, IrDevice } from "@eduscope/contracts";
import { describe, expect, it } from "vitest";
import { captureFields, duplicateSetpoint, irKind, isIrTransport, sortIrDevices, testResultFields } from "../../src/domain/ir.ts";

const command = (temp: number | null): IrCommand => ({
  id: `c${temp ?? "x"}`, device_id: "ac", name: temp === null ? "Power off" : `${temp}°`, role: temp === null ? "power_off" : "setpoint",
  setpoint: temp === null ? null : { temp_c: temp, mode: "cool", fan: "auto" },
  code_format: "tuya", captured: true, captured_at: null, test: "reacted", tested_at: null,
});
const device = (name: string): IrDevice => ({ device_id: name, name, brand: "", kind: "other", transport: "ir_zs06", commands: [] });

describe("IR rules", () => {
  it("only ir_* transports are IR devices", () => {
    expect(isIrTransport("ir_zs06")).toBe(true);
    expect(isIrTransport("ir_mcu")).toBe(true);
    expect(isIrTransport("zigbee")).toBe(false);
    expect(isIrTransport("local")).toBe(false);
  });

  it("maps device kinds to IR kinds", () => {
    expect(irKind("projector")).toBe("projector");
    expect(irKind("ac")).toBe("ac");
    expect(irKind("other")).toBe("other");
    expect(irKind("lights")).toBe("other");
  });

  it("lists devices by name", () => {
    expect(sortIrDevices([device("Projector"), device("Air conditioning")]).map((d) => d.name)).toEqual(["Air conditioning", "Projector"]);
  });

  it("a capture stores the code untested (R5); an answer records reacted / no reaction (H22)", () => {
    expect(captureFields("QUJD", "2026-10-05T10:42:00.000Z")).toEqual({
      code: "QUJD", captured_at: "2026-10-05T10:42:00.000Z", test: "untested", tested_at: null,
    });
    expect(testResultFields(true, "2026-10-05T10:43:00.000Z")).toEqual({ test: "reacted", tested_at: "2026-10-05T10:43:00.000Z" });
    expect(testResultFields(false, "2026-10-05T10:43:00.000Z")).toEqual({ test: "no_reaction", tested_at: "2026-10-05T10:43:00.000Z" });
  });

  it("refuses a second command for the same setpoint (R4)", () => {
    expect(duplicateSetpoint([command(null), command(24)], 24)).toBe("A 24° setpoint already exists");
    expect(duplicateSetpoint([command(null), command(24)], 31)).toBeNull();
  });
});
```

**Test:** `apps/core-api/test/domain/ir.test.ts` — five cases listed in the file.

**Verify:** `pnpm --filter @eduscope/core-api test` → `219 passed`. `pnpm verify` green.

**Commit:** `git add -A && git commit -m "feat(core-api): IR domain rules (capture, test result, setpoint uniqueness)"` (with the ticked box in this plan)


### T7 — `db/ir.ts`: IR devices and commands as contract objects
- [ ] done

**Files:** `apps/core-api/src/db/ir.ts`, `apps/core-api/test/db/ir.test.ts`

**Context:** ARCHITECTURE §3.3 `api/ir.ts` and §6.9. Rows map to `IrCommand` (`captured` instead of the code — the code never leaves core-api except to hw) and `IrDevice` (registry devices with an ir_* transport, by name). Writes: create device/command, patch IR device, delete command, store a capture (R5 untested), store a test answer.

**Do:**

1. Create `apps/core-api/src/db/ir.ts`:
```ts
import { IrCommand, type IrCommandCreate, type IrDevice, type IrDeviceCreate, type IrDeviceUpdate } from "@eduscope/contracts";
import { asc, eq, max } from "drizzle-orm";
import { captureFields, irKind, isIrTransport, sortIrDevices, testResultFields } from "../domain/ir.ts";
import type { DeviceInfo } from "../domain/model.ts";
import type { Db } from "./client.ts";
import { findDevice, loadRegistry, nextDeviceSort } from "./devices.ts";
import { devices, irCommands } from "./schema.ts";

// IR devices and commands (ARCHITECTURE §6.2, §6.9). IR devices ARE the registry devices with an
// ir_* transport. The opaque `code` never leaves this module except through `commandCode`.

export type IrCommandRow = typeof irCommands.$inferSelect;

/** The contract view of a row: `captured` instead of the code. */
export function toIrCommand(row: IrCommandRow): IrCommand {
  const setpoint =
    row.role === "setpoint" && row.setpoint_temp_c !== null
      ? { temp_c: row.setpoint_temp_c, mode: row.setpoint_mode ?? "", fan: row.setpoint_fan ?? "" }
      : null;
  return IrCommand.parse({
    id: row.id, device_id: row.device_id, name: row.name, role: row.role, setpoint, code_format: row.code_format,
    captured: row.code !== null, captured_at: row.captured_at, test: row.test, tested_at: row.tested_at,
  });
}

function commandsOf(db: Db, deviceId: string): IrCommand[] {
  return db.select().from(irCommands).where(eq(irCommands.device_id, deviceId)).orderBy(asc(irCommands.sort)).all().map(toIrCommand);
}

function toIrDevice(db: Db, info: DeviceInfo): IrDevice | null {
  if (!isIrTransport(info.transport)) return null;
  return {
    device_id: info.id, name: info.name, brand: info.brand ?? "", kind: irKind(info.kind), transport: info.transport,
    commands: commandsOf(db, info.id),
  };
}

/** GET /api/ir/devices: every IR device with its commands, by name. */
export function listIrDevices(db: Db): IrDevice[] {
  return sortIrDevices(loadRegistry(db).flatMap((info) => toIrDevice(db, info) ?? []));
}

/** One IR device, or null when the id is unknown or not an IR device. */
export function findIrDevice(db: Db, id: string): IrDevice | null {
  const info = findDevice(db, id);
  return info === null ? null : toIrDevice(db, info);
}

export function findIrCommand(db: Db, id: string): IrCommandRow | null {
  return db.select().from(irCommands).where(eq(irCommands.id, id)).get() ?? null;
}

/** S3.E9 "+ Add device": a new registry row with an IR transport. */
export function createIrDevice(db: Db, id: string, input: IrDeviceCreate): IrDevice {
  db.insert(devices)
    .values({ id, name: input.name, kind: input.kind, transport: input.transport, brand: input.brand, model: null, hw_ref: null, sort: nextDeviceSort(db) })
    .run();
  const created = findIrDevice(db, id);
  if (created === null) throw new Error("IR device vanished");
  return created;
}

/** PATCH /api/ir/devices/:id. Null when the id is unknown or not an IR device. */
export function updateIrDevice(db: Db, id: string, patch: IrDeviceUpdate): IrDevice | null {
  if (findIrDevice(db, id) === null) return null;
  const set = {
    ...(patch.name === undefined ? {} : { name: patch.name }),
    ...(patch.brand === undefined ? {} : { brand: patch.brand }),
    ...(patch.kind === undefined ? {} : { kind: patch.kind }),
    ...(patch.transport === undefined ? {} : { transport: patch.transport }),
  };
  if (Object.keys(set).length > 0) db.update(devices).set(set).where(eq(devices.id, id)).run();
  return findIrDevice(db, id);
}

/** S3.E16 "+ Add a command": not captured, untested, after the device's other commands. */
export function createIrCommand(db: Db, id: string, deviceId: string, input: IrCommandCreate): IrCommand {
  const sort = (db.select({ value: max(irCommands.sort) }).from(irCommands).where(eq(irCommands.device_id, deviceId)).get()?.value ?? 0) + 1;
  db.insert(irCommands)
    .values({
      id, device_id: deviceId, name: input.name, role: input.role, sort, code_format: "tuya", code: null, captured_at: null,
      test: "untested", tested_at: null, setpoint_temp_c: input.setpoint?.temp_c ?? null, setpoint_mode: input.setpoint?.mode ?? null,
      setpoint_fan: input.setpoint?.fan ?? null,
    })
    .run();
  const row = findIrCommand(db, id);
  if (row === null) throw new Error("IR command vanished");
  return toIrCommand(row);
}

export function deleteIrCommand(db: Db, id: string): boolean {
  return db.delete(irCommands).where(eq(irCommands.id, id)).run().changes > 0;
}

/** A capture succeeded: the new code replaces the old one, untested (R5). Null if the command is gone. */
export function storeCapture(db: Db, id: string, code: string, at: string): IrCommand | null {
  db.update(irCommands).set(captureFields(code, at)).where(eq(irCommands.id, id)).run();
  const row = findIrCommand(db, id);
  return row === null ? null : toIrCommand(row);
}

/** H22 answer. Null if the command is gone. */
export function storeTestResult(db: Db, id: string, reacted: boolean, at: string): IrCommand | null {
  db.update(irCommands).set(testResultFields(reacted, at)).where(eq(irCommands.id, id)).run();
  const row = findIrCommand(db, id);
  return row === null ? null : toIrCommand(row);
}
```

2. Create `apps/core-api/test/db/ir.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { openDb } from "../../src/db/client.ts";
import {
  createIrCommand, createIrDevice, deleteIrCommand, findIrCommand, findIrDevice, listIrDevices, storeCapture, storeTestResult,
  updateIrDevice,
} from "../../src/db/ir.ts";
import { seed } from "../../src/db/seed.ts";
import { must, T0, testConfig } from "../helpers.ts";

async function seeded(fakeCodes = false) {
  const { db } = openDb(":memory:");
  await seed(db, testConfig(fakeCodes ? { SEED_FAKE_IR_CODES: "true" } : {}), T0);
  return db;
}

describe("IR records", () => {
  it("lists AC (14) and Projector (2) by name, without codes", async () => {
    const db = await seeded(true);
    const list = listIrDevices(db);
    expect(list.map((d) => [d.name, d.brand, d.kind, d.transport, d.commands.length])).toEqual([
      ["Air conditioning", "Panasonic", "ac", "ir_zs06", 14],
      ["Projector", "Epson", "projector", "ir_zs06", 2],
    ]);
    const on = must(list[1]?.commands[0]);
    expect(on).toEqual({
      id: "projector.power_on", device_id: "projector", name: "Power on", role: "power_on", setpoint: null, code_format: "tuya",
      captured: true, captured_at: T0, test: "untested", tested_at: null,
    });
    expect(JSON.stringify(list)).not.toContain("C/8hRgHrBkYBgAMH");
    expect(list[0]?.commands[1]?.setpoint).toEqual({ temp_c: 18, mode: "cool", fan: "auto" });
  });

  it("a non-IR device is not an IR device", async () => {
    const db = await seeded();
    expect(findIrDevice(db, "lights")).toBeNull();
    expect(updateIrDevice(db, "lights", { name: "x" })).toBeNull();
  });

  it("creates a device and a command after the existing ones", async () => {
    const db = await seeded();
    const fan = createIrDevice(db, "dev-1", { name: "Fan", brand: "Acme", kind: "other", transport: "ir_mcu" });
    expect(fan).toEqual({ device_id: "dev-1", name: "Fan", brand: "Acme", kind: "other", transport: "ir_mcu", commands: [] });
    const cmd = createIrCommand(db, "cmd-1", "ac", { name: "31°", role: "setpoint", setpoint: { temp_c: 31, mode: "cool", fan: "auto" } });
    expect(cmd).toMatchObject({ captured: false, test: "untested", setpoint: { temp_c: 31 } });
    expect(must(findIrDevice(db, "ac")).commands.at(-1)?.id).toBe("cmd-1");
  });

  it("updates an IR device's transport (R8)", async () => {
    const db = await seeded();
    expect(updateIrDevice(db, "projector", { transport: "ir_mcu" })).toMatchObject({ transport: "ir_mcu", brand: "Epson" });
  });

  it("capture stores the code untested; a test answer records the result", async () => {
    const db = await seeded();
    expect(storeCapture(db, "projector.power_on", "QUJD", T0)).toMatchObject({ captured: true, captured_at: T0, test: "untested" });
    expect(findIrCommand(db, "projector.power_on")?.code).toBe("QUJD");
    expect(storeTestResult(db, "projector.power_on", true, T0)).toMatchObject({ test: "reacted", tested_at: T0 });
    expect(storeTestResult(db, "nope", true, T0)).toBeNull();
  });

  it("deletes a command", async () => {
    const db = await seeded();
    expect(deleteIrCommand(db, "ac.setpoint_30")).toBe(true);
    expect(deleteIrCommand(db, "ac.setpoint_30")).toBe(false);
    expect(must(findIrDevice(db, "ac")).commands).toHaveLength(13);
  });
});
```

**Test:** `apps/core-api/test/db/ir.test.ts` — AC (14) / Projector (2) by name without codes; non-IR device → null; create; R8 patch; capture/test; delete.

**Verify:** `pnpm --filter @eduscope/core-api test` → `225 passed`. `pnpm verify` green.

**Commit:** `git add -A && git commit -m "feat(core-api): IR device and command records"` (with the ticked box in this plan)


### T8 — R4 setpoint-list rebuild and R8 transport rule (pure)
- [ ] done

**Files:** `apps/core-api/src/domain/ac.ts`, `apps/core-api/src/domain/devices.ts`, `apps/core-api/test/domain/ac.test.ts`, `apps/core-api/test/domain/devices.test.ts`

**Context:** R4: S1's −/+ range (`environment.ac.available_setpoints`) must follow the captured setpoint frames. R8: a device switches between `ir_zs06` and `ir_mcu` (S3d sheet offers only these for IR devices: `apps/kiosk/src/features/settings/devices/devices.view.ts` `transportChoices`); any other transport change is refused (409, copy below).

**Do:**

1. Replace the whole file `apps/core-api/src/domain/ac.ts`:
```ts
import type { AcState, ChangedBy } from "@eduscope/contracts";
import type { RoomModel } from "./model.ts";
import { assumed } from "./observed.ts";

// R3 (always assumed, Unknown after start), R4 (−/+ step through captured frames only), Q5, H19.

/** Power on with no setpoint sent since start sends this frame when captured [ASSUMED]. */
export const DEFAULT_SETPOINT_C = 24;

/** The frame AC Power on sends (S1.E35): the current setpoint, else 24°, else the middle captured one. */
export function powerOnSetpoint(ac: AcState): number | null {
  const current = ac.setpoint_c.value;
  if (current !== null && ac.available_setpoints.includes(current)) return current;
  if (ac.available_setpoints.includes(DEFAULT_SETPOINT_C)) return DEFAULT_SETPOINT_C;
  return ac.available_setpoints[Math.floor(ac.available_setpoints.length / 2)] ?? null;
}

export type StepResult = { ok: true; temp_c: number } | { ok: false; reason: string };

/** R4 next lower/higher captured setpoint; Q5 rejects −/+ unless the AC is assumed on; H19 at the ends. */
export function stepTarget(ac: AcState, direction: "down" | "up"): StepResult {
  if (ac.power.value !== "on") return { ok: false, reason: "Turn the air conditioning on first" };
  const current = ac.setpoint_c.value;
  if (current === null) return { ok: false, reason: "Air conditioning setpoint is unknown" };
  const candidates = ac.available_setpoints.filter((t) => (direction === "up" ? t > current : t < current));
  if (candidates.length === 0) {
    return { ok: false, reason: direction === "up" ? "Already at the highest setpoint" : "Already at the lowest setpoint" };
  }
  return { ok: true, temp_c: direction === "up" ? Math.min(...candidates) : Math.max(...candidates) };
}

/** After the blaster accepted a frame: power and/or setpoint become assumed values (R3). */
export function acSent(ac: AcState, change: { power?: "on" | "off"; setpoint_c?: number }, at: string, by: ChangedBy | null): AcState {
  return {
    ...ac,
    power: change.power === undefined ? ac.power : assumed(change.power, at, by),
    setpoint_c: change.setpoint_c === undefined ? ac.setpoint_c : assumed(change.setpoint_c, at, by),
  };
}

/** R4: S1's −/+ range after S3 captured or removed a setpoint frame (captured temperatures, ascending). */
export function withAvailableSetpoints(model: RoomModel, setpoints: readonly number[]): RoomModel {
  const { environment } = model.state;
  return { ...model, state: { ...model.state, environment: { ...environment, ac: { ...environment.ac, available_setpoints: [...setpoints] } } } };
}
```

2. Replace the whole file `apps/core-api/src/domain/devices.ts`:
```ts
import type { Device, Observed, RoomState, Source, Transport } from "@eduscope/contracts";
import { isIrTransport } from "./ir.ts";
import type { DeviceInfo } from "./model.ts";
import { OUTPUTS } from "./model.ts";

// H8/H9: each device's `online` from the facts that prove it [ASSUMED until intake].
//   zigbee devices → their node; ir_* devices → the ZS06 (ir_mcu → the hw link); the blaster and
//   the coordinator → their own reports; local devices → the hw link. hw down past the grace ⇒ all offline.

function sourceFor(info: DeviceInfo): Source {
  switch (info.kind) {
    case "lights":
    case "projection_screen":
      return "switch";
    case "power_socket":
      return "power_meter";
    case "sensor":
      return "sensor";
    case "hdmi_switch":
      return "hdmi_switch";
    case "audio":
      return "mixer";
    case "projector":
    case "ac":
    case "ir_blaster":
      return "ir";
    case "coordinator":
    case "other":
      return "none";
  }
}

function factOnline(info: DeviceInfo, state: RoomState): boolean | null {
  if (info.kind === "ir_blaster") return state.ir_blaster.online.value;
  if (info.kind === "coordinator") {
    const status = state.zigbee.coordinator.status;
    return status === "starting" ? null : status === "online";
  }
  if (info.transport === "ir_zs06") return state.ir_blaster.online.value;
  if (info.transport === "zigbee") {
    return state.zigbee.nodes.find((node) => node.friendly_name === info.hw_ref)?.online ?? null;
  }
  return true; // local and ir_mcu: reachable while hw-service is
}

function onlineValue(prev: Observed<boolean> | undefined, info: DeviceInfo, value: boolean | null, stale: boolean, now: string): Observed<boolean> {
  const confidence = value === null ? "unknown" : info.kind === "ac" ? "assumed" : "confirmed";
  if (prev !== undefined && prev.value === value && prev.confidence === confidence && prev.stale === stale) return prev;
  const changed = prev === undefined || prev.value !== value;
  return {
    value,
    confidence,
    source: sourceFor(info),
    updated_at: changed ? (value === null ? null : now) : (prev?.updated_at ?? null),
    stale,
    changed_by: null,
  };
}

/**
 * The `devices` array. `hwDown`: link down (keep last values); `hwOffline`: down past the grace
 * (every device offline, last values greyed, §6.7).
 */
export function deriveDevices(
  infos: readonly DeviceInfo[],
  state: RoomState,
  link: { hwDown: boolean; hwOffline: boolean },
  now: string,
): Device[] {
  return infos.map((info) => {
    const prev = state.devices.find((device) => device.id === info.id)?.online;
    const value = link.hwOffline ? false : link.hwDown ? (prev?.value ?? null) : factOnline(info, state);
    return { ...info, online: onlineValue(prev, info, value, link.hwOffline, now), outputs: [...(OUTPUTS[info.id] ?? [])] };
  });
}

/** S3d/R8: only IR devices switch transport, and only between ZS06 and MCU. Null = allowed. */
export function transportChangeError(current: Transport, next: Transport | undefined): string | null {
  if (next === undefined || next === current) return null;
  if (isIrTransport(current) && isIrTransport(next)) return null;
  return "Only IR devices change transport (ZS06 or MCU)";
}
```

3. Replace the whole file `apps/core-api/test/domain/ac.test.ts`:
```ts
import type { AcState } from "@eduscope/contracts";
import { describe, expect, it } from "vitest";
import { acSent, powerOnSetpoint, stepTarget, withAvailableSetpoints } from "../../src/domain/ac.ts";
import { unknown } from "../../src/domain/observed.ts";
import { bootModel, T0 } from "../helpers.ts";

function ac(power: "on" | "off" | null, setpoint: number | null, available: number[]): AcState {
  const obs = <T>(value: T | null) => ({ ...unknown<T>("ir"), value, confidence: value === null ? ("unknown" as const) : ("assumed" as const) });
  return { power: obs(power), setpoint_c: obs(setpoint), available_setpoints: available };
}

describe("R4 AC setpoints", () => {
  it.each([
    [ac(null, null, [18, 24, 30]), 24],
    [ac("off", 20, [18, 20, 24]), 20],
    [ac(null, null, [18, 19, 20]), 19], // no 24 captured: the middle one
    [ac(null, 22, [18, 30]), 30], // 22 not captured any more: the middle of [18, 30] (index 1)
    [ac(null, null, []), null],
  ])("power on frame for %j → %s", (state, expected) => {
    expect(powerOnSetpoint(state)).toBe(expected);
  });

  it.each([
    [ac("on", 24, [18, 22, 24, 26]), "up", { ok: true, temp_c: 26 }],
    [ac("on", 24, [18, 22, 24, 26]), "down", { ok: true, temp_c: 22 }], // 23 never captured: skipped
    [ac("on", 26, [18, 22, 24, 26]), "up", { ok: false, reason: "Already at the highest setpoint" }], // H19
    [ac("on", 18, [18, 22]), "down", { ok: false, reason: "Already at the lowest setpoint" }],
    [ac("off", 24, [18, 24, 30]), "up", { ok: false, reason: "Turn the air conditioning on first" }], // Q5
    [ac(null, null, [18, 24]), "up", { ok: false, reason: "Turn the air conditioning on first" }], // R3 Unknown
    [ac("on", null, [18, 24]), "up", { ok: false, reason: "Air conditioning setpoint is unknown" }],
  ] as const)("step %j %s → %j", (state, direction, expected) => {
    expect(stepTarget(state, direction)).toEqual(expected);
  });

  it("R3: a sent frame is assumed, from IR, attributed", () => {
    const next = acSent(ac(null, null, [24]), { power: "on", setpoint_c: 24 }, T0, "phone");
    expect(next.power).toEqual({ value: "on", confidence: "assumed", source: "ir", updated_at: T0, stale: false, changed_by: "phone" });
    expect(next.setpoint_c.value).toBe(24);
    expect(acSent(next, { power: "off" }, T0, "laptop").setpoint_c).toBe(next.setpoint_c);
  });
});

describe("R4 setpoint list rebuild", () => {
  it("replaces S1's −/+ range and keeps the rest of the AC state", () => {
    const model = bootModel({ acSetpoints: [18, 24] });
    const next = withAvailableSetpoints(model, [18, 24, 31]);
    expect(next.state.environment.ac.available_setpoints).toEqual([18, 24, 31]);
    expect(next.state.environment.ac.power).toBe(model.state.environment.ac.power);
    expect(model.state.environment.ac.available_setpoints).toEqual([18, 24]);
  });
});
```

4. Replace the whole file `apps/core-api/test/domain/devices.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { derive } from "../../src/domain/derive.ts";
import { transportChangeError } from "../../src/domain/devices.ts";
import { applyHwDown, applyHwEvent } from "../../src/domain/hw-events.ts";
import { bootModel, hwEvent, RULES, snapshotEvent, T0 } from "../helpers.ts";

const at = (ms: number) => new Date(Date.parse(T0) + ms);
const online = (model: ReturnType<typeof bootModel>, id: string) => model.state.devices.find((d) => d.id === id)?.online;

describe("H8 device online", () => {
  it("before hw reports anything: unknown; after the snapshot every device is online", () => {
    const boot = derive(bootModel(), new Date(T0), RULES);
    expect(online(boot, "lights")?.value).toBeNull();
    const up = derive(applyHwEvent(bootModel(), snapshotEvent()), new Date(T0), RULES);
    expect(up.state.devices.every((d) => d.online.value === true)).toBe(true);
    expect(online(up, "ac")?.confidence).toBe("assumed");
    expect(up.state.devices.find((d) => d.id === "lights")?.outputs.map((o) => o.id)).toEqual(["lights.front", "lights.rear"]);
  });
  it.each([
    [hwEvent("zigbee.node", { ieee: "0xa4c1380f2b9e0001", friendly_name: "r101_lights", model: "ZBM5-2C-86W", role: "router", power_source: "mains", lqi: null, battery_pct: null, last_seen: T0, online: false }), ["lights"]],
    [hwEvent("ir.blaster", { online: false, lqi: null }), ["ir_blaster", "projector", "ac"]],
  ] as const)("%j takes %j offline", (event, ids) => {
    const model = derive(applyHwEvent(applyHwEvent(bootModel(), snapshotEvent()), event), new Date(T0), RULES);
    expect(model.state.devices.filter((d) => d.online.value === false).map((d) => d.id).sort()).toEqual([...ids].sort());
  });
  it("§6.7: hw down keeps values for the grace, then every device is offline and every value stale", () => {
    const up = derive(applyHwEvent(bootModel(), snapshotEvent()), new Date(T0), RULES); // the store always holds a derived model
    const down = applyHwDown(up, T0);
    const early = derive(down, at(9_999), RULES);
    expect(early.state.devices.every((d) => d.online.value === true)).toBe(true);
    expect(early.state.room.status.text).toBe("Hardware service offline");
    const late = derive(down, at(10_000), RULES);
    expect(late.state.devices.every((d) => d.online.value === false && d.online.stale)).toBe(true);
    expect(late.state.environment.lights.front).toMatchObject({ value: true, stale: true });
    expect(late.state.display.projector.power.value?.watts).toBe(287); // last value kept
    expect(late.state.zigbee.coordinator.status).toBe("offline");
    const back = derive(applyHwEvent(late, snapshotEvent(at(20_000).toISOString())), at(20_000), RULES);
    expect(back.state.connection.hw).toBe("up");
    expect(back.state.devices.every((d) => d.online.value === true && !d.online.stale)).toBe(true);
    expect(back.state.environment.lights.front.stale).toBe(false);
  });
});

describe("R8 transport change", () => {
  it.each([
    ["ir_zs06", "ir_mcu", null],
    ["ir_mcu", "ir_zs06", null],
    ["zigbee", "zigbee", null],
    ["zigbee", undefined, null],
    ["ir_zs06", "zigbee", "Only IR devices change transport (ZS06 or MCU)"],
    ["zigbee", "ir_mcu", "Only IR devices change transport (ZS06 or MCU)"],
    ["local", "zigbee", "Only IR devices change transport (ZS06 or MCU)"],
  ] as const)("%s → %s: %s", (current, next, expected) => {
    expect(transportChangeError(current, next)).toBe(expected);
  });
});
```

**Test:** `test/domain/ac.test.ts` "R4 setpoint list rebuild"; `test/domain/devices.test.ts` "R8 transport change" (7 rows).

**Verify:** `pnpm --filter @eduscope/core-api test` → `233 passed`. `pnpm verify` green.

**Commit:** `git add -A && git commit -m "feat(core-api): R4 setpoint rebuild and R8 transport rules"` (with the ticked box in this plan)


### T9 — Registry sync into the state store
- [ ] done

**Files:** `apps/core-api/src/registry-sync.ts`, `apps/core-api/test/registry-sync.test.ts`

**Context:** After a settings write the in-memory model must match the DB so every client gets it in the next `state` push: `registry()` reloads `RoomModel.registry` (renames, R8 transport, removals → `devices[]`); `acSetpoints()` rebuilds S1's range from `capturedSetpoints(db, "ac")` (existing, `commands/ir-codes.ts`).

**Do:**

1. Create `apps/core-api/src/registry-sync.ts`:
```ts
import { capturedSetpoints } from "./commands/ir-codes.ts";
import type { Db } from "./db/client.ts";
import { loadRegistry } from "./db/devices.ts";
import { withAvailableSetpoints } from "./domain/ac.ts";
import type { StateStore } from "./domain/state-store.ts";

// After a settings write the in-memory model must match the DB: the device registry (S3d renames,
// R8 transport, removals → `devices[]` in RoomState) and S1's AC range (R4). Each call is one store
// update, so every client gets the change in the next `state` push.

export interface RegistrySync {
  /** Reloads `RoomModel.registry` from the `devices` table. */
  registry(): void;
  /** Rebuilds `environment.ac.available_setpoints` from the captured setpoint frames of the "ac" device. */
  acSetpoints(): void;
}

export function createRegistrySync(db: Db, store: StateStore): RegistrySync {
  return {
    registry: () => {
      store.update((model) => ({ ...model, registry: loadRegistry(db) }));
    },
    acSetpoints: () => {
      store.update((model) => withAvailableSetpoints(model, capturedSetpoints(db, "ac")));
    },
  };
}
```

2. Create `apps/core-api/test/registry-sync.test.ts`:
```ts
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { fixedClock } from "../src/clock.ts";
import { openDb } from "../src/db/client.ts";
import { updateDevice } from "../src/db/devices.ts";
import { irCommands } from "../src/db/schema.ts";
import { seed } from "../src/db/seed.ts";
import { createStateStore } from "../src/domain/state-store.ts";
import { createRegistrySync } from "../src/registry-sync.ts";
import { bootModel, RULES, T0, testConfig } from "./helpers.ts";

async function setup() {
  const { db } = openDb(":memory:");
  await seed(db, testConfig(), T0);
  const store = createStateStore({ initial: bootModel({ acSetpoints: [] }), clock: fixedClock(T0), rules: RULES, coalesceMs: 0 });
  return { db, store, sync: createRegistrySync(db, store) };
}

describe("registry sync", () => {
  it("R8: a transport change reaches devices[] in the next state", async () => {
    const { db, store, sync } = await setup();
    updateDevice(db, "projector", { transport: "ir_mcu", name: "Beamer" });
    const rev = store.get().rev;
    sync.registry();
    expect(store.get().devices.find((d) => d.id === "projector")).toMatchObject({ name: "Beamer", transport: "ir_mcu" });
    expect(store.get().rev).toBe(rev + 1);
  });

  it("R4: S1's range is rebuilt from captured setpoint frames", async () => {
    const { db, store, sync } = await setup();
    db.update(irCommands).set({ code: "QUJD" }).where(eq(irCommands.id, "ac.setpoint_22")).run();
    db.update(irCommands).set({ code: "QUJE" }).where(eq(irCommands.id, "ac.setpoint_18")).run();
    sync.acSetpoints();
    expect(store.get().environment.ac.available_setpoints).toEqual([18, 22]);
  });
});
```

**Test:** `apps/core-api/test/registry-sync.test.ts` — R8 reaches `devices[]` with one `rev` bump; R4 range rebuilt.

**Verify:** `pnpm --filter @eduscope/core-api test` → `235 passed`. `pnpm verify` green.

**Commit:** `git add -A && git commit -m "feat(core-api): sync registry and AC setpoints into the store"` (with the ticked box in this plan)


### T10 — IR service: CRUD, learn (H21), cancel, test (R5/H22)
- [ ] done

**Files:** `apps/core-api/src/ir/service.ts`, `apps/core-api/test/ir/service.test.ts`

**Context:** ARCHITECTURE §6.9; milestone notes "learn returns 202 immediately; the hw call runs in the background, one learn at a time per blaster (second request → 409 precondition)". States pushed as `ir_capture`: `listening` (deadline now+20 s) → `captured` | `timeout` | `cancelled` | `failed`; the old code is replaced only on `captured` (R5: untested). Errors (kiosk maps `hw_unavailable` → "Couldn't reach the blaster", everything else → "Command failed", `features/settings/remote/command-row.ts` `irErrorMessage`): 404 `not_found` "Command not found" / "Device not found"; 503 `hw_unavailable` "Hardware service offline" (hw link down) or "Couldn't reach the blaster" (ZS06 offline, H25, or hw refused the test send); 409 `precondition` "Another capture is running", "Nothing captured yet", "A {t}° setpoint already exists", "Cancel the capture first". `ir_mcu` devices do not need the ZS06 (R8). Cancel marks the capture cancelled (its end state is `cancelled` whatever hw answers) and asks hw to stop. Invalidations: IR list `[["ir","devices"]]`; device create/update also `["devices"]`. Learn and test are written to `event_log` (`subject` `ir.learn` / `ir.test`).

**Do:**

1. Create `apps/core-api/src/ir/service.ts`:
```ts
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
```

2. Create `apps/core-api/test/ir/service.test.ts`:
```ts
import type { ServerEvent } from "@eduscope/contracts";
import { describe, expect, it } from "vitest";
import { fixedClock } from "../../src/clock.ts";
import { openDb } from "../../src/db/client.ts";
import type { LogEntry } from "../../src/db/event-log.ts";
import { findIrCommand } from "../../src/db/ir.ts";
import { seed } from "../../src/db/seed.ts";
import { applyHwEvent } from "../../src/domain/hw-events.ts";
import { createStateStore } from "../../src/domain/state-store.ts";
import type { IrLearnOutcome } from "../../src/hw/client.ts";
import { createIrService } from "../../src/ir/service.ts";
import { createRegistrySync } from "../../src/registry-sync.ts";
import { bootModel, fakeHw, hwEvent, must, RULES, snapshotEvent, T0, testConfig } from "../helpers.ts";

const TECH = { public_id: "pub-tech", label: "laptop" } as const;
const OLD_CODE = "C/8hRgHrBkYBgAMH"; // SEED_FAKE_IR_CODES: projector power on

async function setup() {
  const { db } = openDb(":memory:");
  await seed(db, testConfig({ SEED_FAKE_IR_CODES: "true" }), T0);
  const clock = fixedClock(T0);
  const store = createStateStore({ initial: bootModel(), clock, rules: RULES, coalesceMs: 0 });
  store.update((model) => applyHwEvent(model, snapshotEvent())); // hw up, blaster online
  const hw = fakeHw();
  const events: ServerEvent[] = [];
  const logs: LogEntry[] = [];
  let seq = 0;
  const ir = createIrService({
    db, store, hw, clock, emit: (event) => events.push(event), log: (entry) => logs.push(entry),
    sync: createRegistrySync(db, store), newId: () => `id-${++seq}`,
  });
  return { db, store, hw, events, logs, ir };
}

/** A learn answer the test releases later. */
function held(): { promise: Promise<IrLearnOutcome>; release: (outcome: IrLearnOutcome) => void } {
  let release: (outcome: IrLearnOutcome) => void = () => undefined;
  const promise = new Promise<IrLearnOutcome>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

const captureEvents = (events: ServerEvent[]) => events.flatMap((e) => (e.type === "ir_capture" ? [[e.command_id, e.status, e.deadline]] : []));

describe("IR learn (H21)", () => {
  it("listening with a 20 s deadline → captured: new code stored untested, list invalidated", async () => {
    const { db, hw, events, logs, ir } = await setup();
    ir.learn("projector.power_on", TECH);
    await ir.idle();
    expect(hw.calls).toEqual([{ method: "irLearn", body: { transport: "ir_zs06", timeout_s: 20 } }]);
    expect(captureEvents(events)).toEqual([
      ["projector.power_on", "listening", "2026-10-05T10:42:20.000Z"],
      ["projector.power_on", "captured", null],
    ]);
    expect(events.at(-1)).toEqual({ type: "invalidate", keys: [["ir", "devices"]] });
    expect(findIrCommand(db, "projector.power_on")).toMatchObject({ code: "Q0FQVFVSRUQ=", test: "untested", captured_at: T0 });
    expect(logs.at(-1)).toMatchObject({ type: "command", actor: "laptop", subject: "ir.learn", result: "captured" });
  });

  it.each([
    [{ status: "timeout" }, "timeout"],
    [{ status: "cancelled" }, "cancelled"],
    [{ status: "failed", message: "hw-service unreachable" }, "failed"],
  ] as const)("hw answers %j → %s, the old code is kept", async (outcome, status) => {
    const { db, hw, events, ir } = await setup();
    hw.nextLearns.push(outcome);
    ir.learn("projector.power_on", TECH);
    await ir.idle();
    expect(captureEvents(events).at(-1)).toEqual(["projector.power_on", status, null]);
    expect(events.some((e) => e.type === "invalidate")).toBe(false);
    expect(findIrCommand(db, "projector.power_on")?.code).toBe(OLD_CODE);
  });

  it("one capture per blaster: a second learn → 409 until the first ends", async () => {
    const { hw, ir } = await setup();
    const first = held();
    hw.nextLearns.push(first.promise);
    ir.learn("projector.power_on", TECH);
    expect(() => ir.learn("ac.setpoint_24", TECH)).toThrow(expect.objectContaining({ status: 409, code: "precondition", message: "Another capture is running" }));
    first.release({ status: "timeout" });
    await ir.idle();
    expect(() => ir.learn("ac.setpoint_24", TECH)).not.toThrow();
    await ir.idle();
  });

  it("cancel asks hw to stop and ends as cancelled even if hw still captured", async () => {
    const { db, hw, events, ir } = await setup();
    const pending = held();
    hw.nextLearns.push(pending.promise);
    ir.learn("projector.power_on", TECH);
    await ir.cancelLearn("projector.power_on");
    expect(hw.calls.map((c) => c.method)).toEqual(["irLearn", "irLearnCancel"]);
    pending.release({ status: "captured", code_format: "tuya", code: "TEFURQ==" });
    await ir.idle();
    expect(captureEvents(events).at(-1)).toEqual(["projector.power_on", "cancelled", null]);
    expect(findIrCommand(db, "projector.power_on")?.code).toBe(OLD_CODE);
    await ir.cancelLearn("projector.power_on"); // nothing running: no-op
    expect(hw.calls).toHaveLength(2);
  });

  it("refuses with hw down or the ZS06 offline (503), unknown command (404)", async () => {
    const { store, ir } = await setup();
    expect(() => ir.learn("nope", TECH)).toThrow(expect.objectContaining({ status: 404, code: "not_found" }));
    store.update((model) => applyHwEvent(model, hwEvent("ir.blaster", { online: false, lqi: null })));
    expect(() => ir.learn("projector.power_on", TECH)).toThrow(expect.objectContaining({ status: 503, message: "Couldn't reach the blaster" }));
    store.update((model) => ({ ...model, state: { ...model.state, connection: { hw: "down" } } }));
    expect(() => ir.learn("projector.power_on", TECH)).toThrow(expect.objectContaining({ status: 503, message: "Hardware service offline" }));
  });

  it("an ir_mcu device learns while the ZS06 is offline (R8)", async () => {
    const { store, hw, ir } = await setup();
    ir.updateDevice("projector", { transport: "ir_mcu" });
    store.update((model) => applyHwEvent(model, hwEvent("ir.blaster", { online: false, lqi: null })));
    ir.learn("projector.power_on", TECH);
    await ir.idle();
    expect(hw.calls).toEqual([{ method: "irLearn", body: { transport: "ir_mcu", timeout_s: 20 } }]);
  });

  it("R4: capturing a new 31° setpoint extends S1's range", async () => {
    const { store, ir } = await setup();
    const command = ir.createCommand("ac", { name: "31°", role: "setpoint", setpoint: { temp_c: 31, mode: "cool", fan: "auto" } });
    expect(store.get().environment.ac.available_setpoints.at(-1)).toBe(30);
    ir.learn(command.id, TECH);
    await ir.idle();
    expect(store.get().environment.ac.available_setpoints.at(-1)).toBe(31);
  });
});

describe("IR test (R5, H22)", () => {
  it("sends the stored code once, then records the answer", async () => {
    const { db, hw, events, ir } = await setup();
    await ir.test("projector.power_on", TECH);
    expect(hw.calls).toEqual([{ method: "irSend", body: { transport: "ir_zs06", code_format: "tuya", code: OLD_CODE } }]);
    expect(ir.recordTest("projector.power_on", true)).toMatchObject({ test: "reacted", tested_at: T0 });
    expect(ir.recordTest("projector.power_on", false)).toMatchObject({ test: "no_reaction" });
    expect(findIrCommand(db, "projector.power_on")?.test).toBe("no_reaction");
    expect(events.at(-1)).toEqual({ type: "invalidate", keys: [["ir", "devices"]] });
  });

  it("refuses a command without a code (409) and reports a refused send (503)", async () => {
    const { hw, ir } = await setup();
    const command = ir.createCommand("projector", { name: "Freeze", role: "other", setpoint: null });
    await expect(ir.test(command.id, TECH)).rejects.toMatchObject({ status: 409, message: "Nothing captured yet" });
    expect(() => ir.recordTest(command.id, true)).toThrow(expect.objectContaining({ status: 409 }));
    hw.nextAcks.push({ ok: false, error: { code: "device_offline", message: "r101_ir is offline" } });
    await expect(ir.test("projector.power_on", TECH)).rejects.toMatchObject({ status: 503, message: "Couldn't reach the blaster" });
  });
});

describe("IR devices and commands", () => {
  it("a new device joins the registry and both lists are invalidated", async () => {
    const { store, events, ir } = await setup();
    const device = ir.createDevice({ name: "Fan", brand: "Acme", kind: "other", transport: "ir_mcu" });
    expect(device.device_id).toBe("id-1");
    expect(store.get().devices.find((d) => d.id === "id-1")).toMatchObject({ name: "Fan", transport: "ir_mcu", kind: "other" });
    expect(events.at(-1)).toEqual({ type: "invalidate", keys: [["ir", "devices"], ["devices"]] });
    expect(ir.list().map((d) => d.name)).toEqual(["Air conditioning", "Fan", "Projector"]);
  });

  it("refuses a duplicate setpoint, an unknown device and removing a command that is capturing", async () => {
    const { hw, ir } = await setup();
    expect(() => ir.createCommand("ac", { name: "24 again", role: "setpoint", setpoint: { temp_c: 24, mode: "cool", fan: "auto" } })).toThrow(
      expect.objectContaining({ status: 409, message: "A 24° setpoint already exists" }),
    );
    expect(() => ir.createCommand("lights", { name: "x", role: "other", setpoint: null })).toThrow(expect.objectContaining({ status: 404 }));
    const pending = held();
    hw.nextLearns.push(pending.promise);
    ir.learn("projector.power_off", TECH);
    expect(() => ir.deleteCommand("projector.power_off")).toThrow(expect.objectContaining({ status: 409, message: "Cancel the capture first" }));
    pending.release({ status: "timeout" });
    await ir.idle();
  });

  it("R4: removing a captured setpoint shrinks S1's range", async () => {
    const { store, ir } = await setup();
    ir.deleteCommand("ac.setpoint_30");
    expect(store.get().environment.ac.available_setpoints.at(-1)).toBe(29);
    expect(must(ir.list()[0]).commands).toHaveLength(13);
  });
});
```

**Test:** `apps/core-api/test/ir/service.test.ts` — the learn/test state transitions: captured, timeout/cancelled/failed keep the old code, 409 second learn, cancel wins over a late capture, 503/404 refusals, ir_mcu without blaster, R4 31° extends the range, test send + answers, 409/503 test refusals, device create syncs registry, duplicate setpoint / unknown device / delete while capturing, delete shrinks range.

**Verify:** `pnpm --filter @eduscope/core-api test` → `249 passed`. `pnpm verify` green.

**Commit:** `git add -A && git commit -m "feat(core-api): IR service with learn, cancel and test flows"` (with the ticked box in this plan)


### T11 — Sessions: end every other session of a level
- [ ] done

**Files:** `apps/core-api/src/auth/sessions.ts`, `apps/core-api/test/auth/sessions.test.ts`

**Context:** M09 scope "PIN change … end all other sessions of that level" and §2.3 "class block ends" (control only). Uses the existing D-21 downgrade path (row kept, `session` pushed, `event_log` entry with the reason). `control` = remote control rows only (the kiosk is always control); `technician` = every technician row (a kiosk row drops to control).

**Do:**

1. Patch `apps/core-api/src/auth/sessions.ts` (167 lines, so only the change is shown). Run from the repo root; it must print nothing:
```sh
git apply --whitespace=nowarn <<'PATCH'
diff --git a/apps/core-api/src/auth/sessions.ts b/apps/core-api/src/auth/sessions.ts
index 89d6b8a..ac25011 100644
--- a/apps/core-api/src/auth/sessions.ts
+++ b/apps/core-api/src/auth/sessions.ts
@@ -36,6 +36,12 @@ export interface SessionService {
   setLabel(publicId: string, label: Label): void;
   /** Ends idle sessions (pushes `session`) and drops old view rows. */
   sweep(): void;
+  /**
+   * Ends every unlocked session at `level` except `exceptPublicId` (pushes `session` to each): a PIN
+   * change (S3d) or the end of a class block (§2.3, control only). Remote control rows only for
+   * "control" (the kiosk is always control). Returns how many ended.
+   */
+  endAccess(level: "control" | "technician", exceptPublicId: string | null, reason: string): number;
   toClientSession(client: ResolvedClient & { row: SessionRow }): ClientSession;
 }
 
@@ -146,6 +152,16 @@ export function createSessionService(deps: {
       const cutoff = new Date(clock.now().getTime() - VIEW_ROW_TTL_MS).toISOString();
       db.delete(sessions).where(and(eq(sessions.access, "view"), lt(sessions.created_at, cutoff))).run();
     },
+    endAccess(level, exceptPublicId, reason) {
+      const rows = db
+        .select()
+        .from(sessions)
+        .where(and(eq(sessions.access, level), level === "control" ? eq(sessions.client_type, "remote") : undefined))
+        .all()
+        .filter((row) => row.public_id !== exceptPublicId);
+      for (const row of rows) deps.onChange(toClientSession(downgrade(row, reason)));
+      return rows.length;
+    },
     toClientSession: (client) => toClientSession(client.row),
   };
 }
PATCH
```

2. Replace the whole file `apps/core-api/test/auth/sessions.test.ts`:
```ts
import type { ClientSession } from "@eduscope/contracts";
import { describe, expect, it } from "vitest";
import { createSessionService } from "../../src/auth/sessions.ts";
import { fixedClock } from "../../src/clock.ts";
import { openDb } from "../../src/db/client.ts";
import type { LogEntry } from "../../src/db/event-log.ts";
import { sessions as sessionsTable } from "../../src/db/schema.ts";
import { T0 } from "../helpers.ts";

function service() {
  const { db } = openDb(":memory:");
  const clock = fixedClock(T0);
  const pushed: ClientSession[] = [];
  const logs: LogEntry[] = [];
  const sessions = createSessionService({ db, clock, log: (entry) => logs.push(entry), onChange: (s) => pushed.push(s) });
  return { db, clock, pushed, logs, sessions };
}

const PHONE_IP = "192.168.1.50";

describe("session service", () => {
  it("no cookie: remote → view, kiosk → control (no row yet)", () => {
    const { sessions } = service();
    expect(sessions.resolve(null, PHONE_IP, false)).toEqual({ row: null, ip: PHONE_IP, clientType: "remote", access: "view", label: "laptop" });
    expect(sessions.resolve(null, "127.0.0.1", true)).toMatchObject({ row: null, clientType: "kiosk", access: "control", label: "room screen" });
  });

  it("ensure creates one row and a cookie id; the cookie resolves back to it", () => {
    const { sessions, db } = service();
    const { client, newCookieId } = sessions.ensure(sessions.resolve(null, PHONE_IP, false));
    expect(newCookieId).toMatch(/^[\w-]{43}$/);
    expect(client.row.public_id).not.toBe(newCookieId);
    expect(sessions.ensure(client).newCookieId).toBeNull();
    expect(sessions.resolve(newCookieId, PHONE_IP, false).row?.id).toBe(newCookieId);
    expect(db.select().from(sessionsTable).all()).toHaveLength(1);
  });

  it("login sets access, label, unlock time and the idle expiry, and pushes it", () => {
    const { sessions, pushed, logs } = service();
    const { client } = sessions.ensure(sessions.resolve(null, PHONE_IP, false));
    const session = sessions.login(client, "control", "phone");
    expect(session).toMatchObject({ client_type: "remote", label: "phone", access: "control", unlocked_at: T0, last_activity: T0, expires_at: "2026-10-05T12:42:00.000Z" });
    expect(pushed).toEqual([session]);
    expect(logs).toEqual([expect.objectContaining({ type: "session", subject: "login", result: "control" })]);
  });

  it("a room PIN never lowers a technician session; the kiosk keeps its label", () => {
    const { sessions } = service();
    const remote = sessions.ensure(sessions.resolve(null, PHONE_IP, false)).client;
    sessions.login(remote, "technician", "laptop");
    const again = sessions.resolve(remote.row.id, PHONE_IP, false);
    expect(sessions.login({ ...again, row: remote.row }, "control", "laptop").access).toBe("technician");
    const kiosk = sessions.ensure(sessions.resolve(null, "127.0.0.1", true)).client;
    expect(sessions.login(kiosk, "technician", "phone")).toMatchObject({ label: "room screen", expires_at: "2026-10-05T10:44:00.000Z" });
  });

  it("an expired session is downgraded on the next request and pushed", () => {
    const { sessions, clock, pushed } = service();
    const { client, newCookieId } = sessions.ensure(sessions.resolve(null, PHONE_IP, false));
    sessions.login(client, "technician", "laptop");
    clock.advance(15 * 60_000);
    expect(sessions.resolve(newCookieId, PHONE_IP, false)).toMatchObject({ access: "view" });
    expect(pushed.at(-1)).toMatchObject({ access: "view", expires_at: null });
  });

  it("touch resets the idle timer; lock drops to the baseline", () => {
    const { sessions, clock } = service();
    const { client, newCookieId } = sessions.ensure(sessions.resolve(null, PHONE_IP, false));
    sessions.login(client, "control", "phone");
    clock.advance(60 * 60_000);
    sessions.touch(sessions.resolve(newCookieId, PHONE_IP, false));
    clock.advance(90 * 60_000);
    const live = sessions.resolve(newCookieId, PHONE_IP, false);
    expect(live.access).toBe("control");
    expect(live.row?.expires_at).toBe("2026-10-05T13:42:00.000Z");
  });

  it("a kiosk row is ignored from a LAN address (and a remote row from the kiosk)", () => {
    const { sessions } = service();
    const { newCookieId } = sessions.ensure(sessions.resolve(null, "127.0.0.1", true));
    expect(sessions.resolve(newCookieId, PHONE_IP, false)).toMatchObject({ row: null, clientType: "remote", access: "view" });
  });

  it("hello labels only remote rows; the sweep ends idle sessions and drops week-old view rows", () => {
    const { sessions, clock, pushed, db } = service();
    const viewer = sessions.ensure(sessions.resolve(null, "192.168.1.60", false)).client;
    sessions.setLabel(viewer.row.public_id, "tablet");
    const unlocked = sessions.ensure(sessions.resolve(null, PHONE_IP, false)).client;
    sessions.login(unlocked, "control", "phone");
    clock.advance(2 * 60 * 60_000);
    sessions.sweep();
    expect(pushed.at(-1)).toMatchObject({ public_id: unlocked.row.public_id, access: "view" });
    expect(sessions.resolve(viewer.row.id, "192.168.1.60", false).label).toBe("tablet");
    clock.advance(7 * 24 * 60 * 60_000);
    sessions.sweep();
    expect(db.select().from(sessionsTable).all()).toHaveLength(0);
  });

  it("endAccess ends the other sessions of one level and pushes each (PIN change, class-block end)", () => {
    const { sessions, pushed, logs } = service();
    const unlock = (ip: string, level: "control" | "technician", kiosk = false) => {
      const { client } = sessions.ensure(sessions.resolve(null, ip, kiosk));
      return sessions.login(client, level, "phone");
    };
    const me = unlock("192.168.1.50", "control");
    const other = unlock("192.168.1.51", "control");
    const tech = unlock("192.168.1.52", "technician");
    const kioskTech = unlock("127.0.0.1", "technician", true);
    pushed.length = 0;
    expect(sessions.endAccess("control", me.public_id, "room PIN changed")).toBe(1);
    expect(pushed).toEqual([expect.objectContaining({ public_id: other.public_id, access: "view", expires_at: null })]);
    expect(logs.at(-1)).toMatchObject({ type: "session", subject: "room PIN changed", result: "view" });
    expect(sessions.endAccess("technician", null, "technician PIN changed")).toBe(2);
    expect(pushed.slice(1)).toEqual([
      expect.objectContaining({ public_id: tech.public_id, access: "view" }),
      expect.objectContaining({ public_id: kioskTech.public_id, access: "control" }),
    ]);
    expect(sessions.endAccess("control", null, "class block ended")).toBe(1); // `me`; the kiosk row is control by default
  });
});
```

**Test:** `apps/core-api/test/auth/sessions.test.ts` — "endAccess ends the other sessions of one level and pushes each".

**Verify:** `pnpm --filter @eduscope/core-api test` → `250 passed`. `pnpm verify` green.

**Commit:** `git add -A && git commit -m "feat(core-api): end every other session of a level"` (with the ticked box in this plan)


### T12 — WS hub: keep the S3b client list current
- [ ] done

**Files:** `apps/core-api/src/app.ts`, `apps/core-api/src/plugins/realtime.ts`, `apps/core-api/test/routes/realtime.test.ts`

**Context:** S3b "Connected clients" comes from the hub (ARCHITECTURE §6.6, D-21). The hub stored label/access at connect time only, so a later login/lock/expiry showed stale access. `updateSession(session)` updates every socket of that `public_id`; `app.ts` calls it from the session service's `onChange` before pushing.

**Do:**

1. Patch `apps/core-api/src/app.ts` (161 lines, so only the change is shown). Run from the repo root; it must print nothing:
```sh
git apply --whitespace=nowarn <<'PATCH'
diff --git a/apps/core-api/src/app.ts b/apps/core-api/src/app.ts
index 12e05a3..66169e3 100644
--- a/apps/core-api/src/app.ts
+++ b/apps/core-api/src/app.ts
@@ -117,7 +117,10 @@ export async function buildApp(deps: AppDeps): Promise<FastifyInstance> {
   });
   const sessions = createSessionService({
     db, clock, log,
-    onChange: (session) => hub.sendToSession(session.public_id, { type: "session", session }),
+    onChange: (session) => {
+      hub.updateSession(session);
+      hub.sendToSession(session.public_id, { type: "session", session });
+    },
   });
   store.subscribe((state) => hub.broadcast({ type: "state", state }));
 
PATCH
```

2. Replace the whole file `apps/core-api/src/plugins/realtime.ts`:
```ts
import { ClientMessage, type ClientLabel, type ClientSession, type ConnectedClient, type ServerEvent } from "@eduscope/contracts";
import websocket from "@fastify/websocket";
import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import type { WebSocket } from "ws";
import type { SessionService } from "../auth/sessions.ts";
import type { StateStore } from "../domain/state-store.ts";

// ARCHITECTURE §6.6 WS hub: snapshot on connect, `state` + command/activity to all, `session` only
// to that session's sockets, ping every 10 s (2 missed pongs ⇒ terminate). Receive-only (D-03):
// inbound frames other than hello/pong are dropped, > 4 KB closes the socket. Never IR codes or PINs.

export const PING_MS = 10_000;
export const MAX_FRAME_BYTES = 4096;
const MAX_MISSED_PONGS = 2;

interface HubClient {
  socket: WebSocket;
  publicId: string | null;
  label: ClientLabel;
  info: Omit<ConnectedClient, "label" | "public_id">;
  missedPongs: number;
}

export interface Hub {
  add(client: HubClient): void;
  remove(client: HubClient): void;
  broadcast(event: ServerEvent): void;
  sendToSession(publicId: string, event: ServerEvent): void;
  /** Keeps the S3b list current after a login, lock or expiry of that session. */
  updateSession(session: ClientSession): void;
  /** S3b connected clients (GET /api/system/network). */
  clients(): ConnectedClient[];
  /** One ping round: terminate silent sockets, ping the rest. */
  ping(): void;
  size(): number;
}

export function createHub(): Hub {
  const clients = new Set<HubClient>();
  const send = (client: HubClient, event: ServerEvent): void => {
    if (client.socket.readyState === client.socket.OPEN) client.socket.send(JSON.stringify(event));
  };
  return {
    add: (client) => clients.add(client),
    remove: (client) => clients.delete(client),
    broadcast(event) {
      for (const client of clients) send(client, event);
    },
    sendToSession(publicId, event) {
      for (const client of clients) if (client.publicId === publicId) send(client, event);
    },
    updateSession(session) {
      for (const client of clients) {
        if (client.publicId !== session.public_id) continue;
        client.label = session.label;
        client.info = { ...client.info, access: session.access };
      }
    },
    clients: () => [...clients].map((client) => ({ public_id: client.publicId, label: client.label, ...client.info })),
    ping() {
      for (const client of clients) {
        if (client.missedPongs >= MAX_MISSED_PONGS) {
          client.socket.terminate();
          clients.delete(client);
          continue;
        }
        client.missedPongs += 1;
        send(client, { type: "ping" });
      }
    },
    size: () => clients.size,
  };
}

export const realtimePlugin = fp(async (app: FastifyInstance, options: { hub: Hub; store: StateStore; sessions: SessionService }) => {
  const { hub, store, sessions } = options;
  await app.register(websocket, { options: { maxPayload: MAX_FRAME_BYTES } });

  app.get("/ws", { websocket: true }, (socket, request) => {
    const resolved = request.client;
    const client: HubClient = {
      socket,
      publicId: resolved.row?.public_id ?? null,
      label: resolved.label,
      info: { client_type: resolved.clientType, access: resolved.access },
      missedPongs: 0,
    };
    hub.add(client);
    socket.send(JSON.stringify({ type: "snapshot", state: store.get() } satisfies ServerEvent));

    socket.on("message", (data, isBinary) => {
      if (isBinary) return;
      let raw: unknown;
      try {
        raw = JSON.parse(String(data));
      } catch {
        return;
      }
      const message = ClientMessage.safeParse(raw);
      if (!message.success) return;
      client.missedPongs = 0;
      if (message.data.type === "hello" && resolved.clientType === "remote") {
        client.label = message.data.label;
        if (client.publicId !== null) sessions.setLabel(client.publicId, message.data.label);
      }
    });
    socket.on("close", () => hub.remove(client));
  });
});
```

3. Replace the whole file `apps/core-api/test/routes/realtime.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { FAKE_PROJECTOR_CODES } from "../../src/db/seed.ts";
import { hwEvent } from "../helpers.ts";
import { call, cookieOf, openSocket, sessionAt, startApp } from "./app-helpers.ts";

describe("WS hub (§6.6)", () => {
  it("sends the full snapshot on connect", async () => {
    const { app } = await startApp();
    const socket = await openSocket(app);
    const snapshot = await socket.next("snapshot");
    expect(snapshot.state).toMatchObject({ room: { id: "R-101" }, connection: { hw: "up" } });
    expect(snapshot.state.rev).toBe(app.room.store.get().rev);
    socket.ws.terminate();
    await app.close();
  });

  it("fans every state change out to N sockets with a monotonic rev", async () => {
    const { app } = await startApp();
    const sockets = await Promise.all([openSocket(app), openSocket(app), openSocket(app)]);
    await Promise.all(sockets.map((s) => s.next("snapshot")));
    app.room.ingest.handle(hwEvent("lights.state", { gang: "rear", on: true }));
    app.room.ingest.handle(hwEvent("hdmi.state", { input: "smart_board" }));
    for (const socket of sockets) {
      const state = await socket.next("state");
      expect(state.state.environment.lights.rear.value).toBe(true);
      const activity = await socket.next("activity");
      expect(activity).toEqual({ type: "activity", text: "Rear of room turned on", by: "by hand", public_id: null });
    }
    await new Promise((resolve) => setTimeout(resolve, 80));
    for (const socket of sockets) {
      const revs = socket.frames.flatMap((f) => (f.type === "snapshot" || f.type === "state" ? [f.state.rev] : []));
      expect(revs.length).toBeGreaterThanOrEqual(2);
      expect(revs).toEqual([...revs].sort((a, b) => a - b));
      expect(new Set(revs).size).toBe(revs.length);
    }
    for (const socket of sockets) socket.ws.terminate();
    await app.close();
  });

  it("`session` goes only to that session's sockets (login, lock, expiry)", async () => {
    const { app, clock } = await startApp();
    const cookie = await sessionAt(app, "view");
    const mine = await openSocket(app, { cookie });
    const other = await openSocket(app);
    await call(app, "POST", "/api/session/login", { cookie, payload: { level: "control", pin: "1234", label: "phone" } });
    expect((await mine.next("session")).session).toMatchObject({ access: "control", label: "phone" });
    clock.advance(2 * 60 * 60_000);
    app.room.sessions.sweep();
    await expect.poll(() => mine.frames.filter((f) => f.type === "session").at(-1)).toMatchObject({ session: { access: "view" } });
    expect(other.frames.some((f) => f.type === "session")).toBe(false);
    mine.ws.terminate();
    other.ws.terminate();
    await app.close();
  });

  it("the S3b client list follows login and lock", async () => {
    const { app } = await startApp();
    const cookie = await sessionAt(app, "view");
    const socket = await openSocket(app, { cookie });
    await socket.next("snapshot");
    await call(app, "POST", "/api/session/login", { cookie, payload: { level: "technician", pin: "123456", label: "tablet" } });
    expect(app.room.hub.clients()).toEqual([expect.objectContaining({ label: "tablet", access: "technician" })]);
    await call(app, "POST", "/api/session/lock", { cookie });
    expect(app.room.hub.clients()).toEqual([expect.objectContaining({ access: "view" })]);
    socket.ws.terminate();
    await app.close();
  });

  it("never carries IR codes or PIN data", async () => {
    const { app } = await startApp({ SEED_FAKE_IR_CODES: "true" });
    const socket = await openSocket(app);
    const text = JSON.stringify(await socket.next("snapshot"));
    expect(text).not.toContain(FAKE_PROJECTOR_CODES["projector.power_on"]);
    expect(text).not.toContain("scrypt$");
    socket.ws.terminate();
    await app.close();
  });

  it("refuses a foreign Origin at the upgrade", async () => {
    const { app } = await startApp();
    await expect(openSocket(app, { origin: "http://evil.example" })).rejects.toThrow("Unexpected server response: 403");
    await app.close();
  });

  it("hello names the client (S3b list, attribution); junk frames are dropped; > 4 KB closes", async () => {
    const { app } = await startApp();
    const cookie = cookieOf(await call(app, "GET", "/api/session"));
    const socket = await openSocket(app, { cookie });
    await socket.next("snapshot");
    socket.ws.send(JSON.stringify({ type: "hello", label: "tablet" }));
    socket.ws.send("not json");
    socket.ws.send(JSON.stringify({ type: "command", body: {} }));
    await expect.poll(() => app.room.hub.clients()).toEqual([{ public_id: expect.any(String), label: "tablet", client_type: "remote", access: "view" }]);
    expect((await call(app, "GET", "/api/session", { cookie })).json()).toMatchObject({ label: "tablet" });
    const closed = new Promise<number>((resolve) => socket.ws.on("close", (code) => resolve(code)));
    socket.ws.send("x".repeat(5000));
    expect(await closed).toBe(1009);
    await expect.poll(() => app.room.hub.size()).toBe(0);
    await app.close();
  });

  it("ping every round; a socket that misses 2 pongs is terminated", async () => {
    const { app } = await startApp();
    const socket = await openSocket(app);
    await socket.next("snapshot");
    app.room.hub.ping();
    await socket.next("ping");
    socket.ws.send(JSON.stringify({ type: "pong" }));
    await new Promise((resolve) => setTimeout(resolve, 20));
    app.room.hub.ping();
    app.room.hub.ping();
    expect(app.room.hub.size()).toBe(1); // one pong answered, so only 2 unanswered so far
    app.room.hub.ping();
    expect(app.room.hub.size()).toBe(0);
    await app.close();
  });
});
```

**Test:** `apps/core-api/test/routes/realtime.test.ts` — "the S3b client list follows login and lock".

**Verify:** `pnpm --filter @eduscope/core-api test` → `251 passed`. `pnpm verify` green.

**Commit:** `git add -A && git commit -m "feat(core-api): keep the connected-clients list current"` (with the ticked box in this plan)


### T13 — IR routes (S3) behind technician + access table
- [ ] done

**Files:** `apps/core-api/src/app.ts`, `apps/core-api/src/routes/ir.ts`, `apps/core-api/test/routes/access.test.ts`, `apps/core-api/test/routes/app-helpers.ts`, `apps/core-api/test/routes/ir.test.ts`

**Context:** ARCHITECTURE §3.3 `api/ir.ts`, exactly the paths the kiosk http adapter calls (`apps/kiosk/src/data/adapters/http/http-client.ts` `ir:`) plus `PATCH /api/ir/devices/:id` and `DELETE /api/ir/commands/:id` from the contract list. Every route (GETs too) declares `config: { access: "technician" }` → no session 401 `unauthorized` "Enter the room PIN", control 403 `forbidden` "Technician PIN required" (existing guard). Status codes: create 201 + body; learn/cancel/test 202 empty; delete 204; test-result 200 `IrCommand`. The test helper `call()` learns PUT/PATCH/DELETE (DELETE sends no body and no content type, like the kiosk). `test/routes/access.test.ts` is the AC10/AC11 table; T15, T16, T17, T20 add their rows to it.

**Do:**

1. Patch `apps/core-api/src/app.ts` (168 lines, so only the change is shown). Run from the repo root; it must print nothing:
```sh
git apply --whitespace=nowarn <<'PATCH'
diff --git a/apps/core-api/src/app.ts b/apps/core-api/src/app.ts
index 66169e3..80f1c79 100644
--- a/apps/core-api/src/app.ts
+++ b/apps/core-api/src/app.ts
@@ -18,13 +18,16 @@ import type { KwhBaseline } from "./domain/model.ts";
 import { createStateStore, type StateStore } from "./domain/state-store.ts";
 import type { HwClient, HwTimeouts } from "./hw/client.ts";
 import { createIngest, type Ingest } from "./hw/ingest.ts";
+import { createIrService, type IrService } from "./ir/service.ts";
 import { authPlugin } from "./plugins/auth.ts";
 import { errorsPlugin } from "./plugins/errors.ts";
 import { originCheckPlugin } from "./plugins/origin-check.ts";
 import { createHub, PING_MS, realtimePlugin, type Hub } from "./plugins/realtime.ts";
 import { staticPlugin } from "./plugins/static.ts";
+import { createRegistrySync } from "./registry-sync.ts";
 import { commandRoutes } from "./routes/commands.ts";
 import { healthRoutes } from "./routes/health.ts";
+import { irRoutes } from "./routes/ir.ts";
 import { sessionRoutes } from "./routes/session.ts";
 import { stateRoutes } from "./routes/state.ts";
 
@@ -49,6 +52,7 @@ export interface Room {
   ingest: Ingest;
   sessions: SessionService;
   hub: Hub;
+  ir: IrService;
 }
 
 declare module "fastify" {
@@ -123,11 +127,13 @@ export async function buildApp(deps: AppDeps): Promise<FastifyInstance> {
     },
   });
   store.subscribe((state) => hub.broadcast({ type: "state", state }));
+  const sync = createRegistrySync(db, store);
+  const ir = createIrService({ db, store, hw: deps.hw, clock, emit: (event) => hub.broadcast(event), log, sync });
 
   const app = Fastify({ logger: deps.logger ?? false, trustProxy: false });
   app.setValidatorCompiler(validatorCompiler);
   app.setSerializerCompiler(serializerCompiler);
-  app.decorate("room", { db, store, dispatcher, ingest, sessions, hub });
+  app.decorate("room", { db, store, dispatcher, ingest, sessions, hub, ir });
 
   await app.register(errorsPlugin);
   await app.register(cookie, { secret: config.COOKIE_SECRET });
@@ -140,6 +146,7 @@ export async function buildApp(deps: AppDeps): Promise<FastifyInstance> {
       await api.register(stateRoutes, { store });
       await api.register(commandRoutes, { dispatcher, sessions });
       await api.register(healthRoutes, { store });
+      await api.register(irRoutes, { ir });
     },
     { prefix: "/api" },
   );
PATCH
```

2. Create `apps/core-api/src/routes/ir.ts`:
```ts
import { IrCommandCreate, IrDeviceCreate, IrDeviceUpdate, IrTestResultRequest } from "@eduscope/contracts";
import type { FastifyInstance, FastifyRequest } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import type { IrActor, IrService } from "../ir/service.ts";

// ARCHITECTURE §3.3 api/ir.ts — S3 Remote configuration. Every route, GETs included, is technician.

const TECHNICIAN = { access: "technician" } as const;
const IdParams = z.object({ id: z.string().min(1) });

const actor = (request: FastifyRequest): IrActor => ({ public_id: request.client.row?.public_id ?? null, label: request.client.label });

export async function irRoutes(app: FastifyInstance, options: { ir: IrService }) {
  const { ir } = options;
  const api = app.withTypeProvider<ZodTypeProvider>();

  api.get("/ir/devices", { config: TECHNICIAN }, async () => ir.list());

  api.post("/ir/devices", { config: TECHNICIAN, schema: { body: IrDeviceCreate } }, async (request, reply) =>
    reply.status(201).send(ir.createDevice(request.body)),
  );

  api.patch("/ir/devices/:id", { config: TECHNICIAN, schema: { params: IdParams, body: IrDeviceUpdate } }, async (request) =>
    ir.updateDevice(request.params.id, request.body),
  );

  api.post("/ir/devices/:id/commands", { config: TECHNICIAN, schema: { params: IdParams, body: IrCommandCreate } }, async (request, reply) =>
    reply.status(201).send(ir.createCommand(request.params.id, request.body)),
  );

  api.delete("/ir/commands/:id", { config: TECHNICIAN, schema: { params: IdParams } }, async (request, reply) => {
    ir.deleteCommand(request.params.id);
    return reply.status(204).send();
  });

  /** 202 at once; `ir_capture` events report listening → captured | timeout | cancelled | failed (H21). */
  api.post("/ir/commands/:id/learn", { config: TECHNICIAN, schema: { params: IdParams } }, async (request, reply) => {
    ir.learn(request.params.id, actor(request));
    return reply.status(202).send();
  });

  api.post("/ir/commands/:id/learn/cancel", { config: TECHNICIAN, schema: { params: IdParams } }, async (request, reply) => {
    await ir.cancelLearn(request.params.id);
    return reply.status(202).send();
  });

  api.post("/ir/commands/:id/test", { config: TECHNICIAN, schema: { params: IdParams } }, async (request, reply) => {
    await ir.test(request.params.id, actor(request));
    return reply.status(202).send();
  });

  api.post("/ir/commands/:id/test-result", { config: TECHNICIAN, schema: { params: IdParams, body: IrTestResultRequest } }, async (request) =>
    ir.recordTest(request.params.id, request.body.reacted),
  );
}
```

3. Create `apps/core-api/test/routes/access.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { call, sessionAt, startApp, type Method } from "./app-helpers.ts";

// AC10/AC11: every M09 route, GETs included, is technician-only. Bodies are valid so the guard,
// not validation, decides; ids are unknown so a passing guard never changes anything.

const ROUTES: readonly [Method, string, unknown?][] = [
  ["GET", "/api/ir/devices"],
  ["POST", "/api/ir/devices", { name: "Fan", brand: "Acme", kind: "other", transport: "ir_mcu" }],
  ["PATCH", "/api/ir/devices/nope", { name: "Fan" }],
  ["POST", "/api/ir/devices/nope/commands", { name: "On", role: "other", setpoint: null }],
  ["DELETE", "/api/ir/commands/nope"],
  ["POST", "/api/ir/commands/nope/learn", {}],
  ["POST", "/api/ir/commands/nope/learn/cancel", {}],
  ["POST", "/api/ir/commands/nope/test", {}],
  ["POST", "/api/ir/commands/nope/test-result", { reacted: true }],
];

describe("M09 routes need technician", () => {
  it.each(ROUTES)("%s %s: no session 401, control 403, technician passes the guard", async (method, url, payload) => {
    const { app } = await startApp();
    expect((await call(app, method, url, { payload })).json()).toEqual({ code: "unauthorized", message: "Enter the room PIN" });
    const view = await sessionAt(app, "view");
    expect((await call(app, method, url, { payload, cookie: view })).statusCode).toBe(401);
    const control = await sessionAt(app, "control", "192.168.1.51");
    const refused = await call(app, method, url, { payload, cookie: control, remoteAddress: "192.168.1.51" });
    expect([refused.statusCode, refused.json()]).toEqual([403, { code: "forbidden", message: "Technician PIN required" }]);
    const tech = await sessionAt(app, "technician", "192.168.1.52");
    const passed = await call(app, method, url, { payload, cookie: tech, remoteAddress: "192.168.1.52" });
    expect([401, 403]).not.toContain(passed.statusCode);
    await app.close();
  });
});
```

4. Replace the whole file `apps/core-api/test/routes/app-helpers.ts`:
```ts
import { ServerEvent } from "@eduscope/contracts";
import type { FastifyInstance, LightMyRequestResponse } from "fastify";
import type { WebSocket } from "ws";
import { buildApp } from "../../src/app.ts";
import { fixedClock, type FixedClock } from "../../src/clock.ts";
import type { Config } from "../../src/config.ts";
import { fakeHw, snapshotEvent, T0, testConfig, type FakeHw } from "../helpers.ts";

export const HOST = "r-101.local";
export const ORIGIN = `http://${HOST}`;
/** A phone on the room Wi-Fi (not loopback). */
export const PHONE_IP = "192.168.1.50";

export interface TestApp {
  app: FastifyInstance;
  clock: FixedClock;
  hw: FakeHw;
}

/** buildApp with `:memory:`, a fake hw client, a fixed clock; hw reported up (fixture snapshot) unless `hwUp: false`. */
export async function startApp(overrides: Partial<Record<keyof Config, string>> = {}, options: { hwUp?: boolean } = {}): Promise<TestApp> {
  const clock = fixedClock(T0);
  const hw = fakeHw();
  const app = await buildApp({ db: ":memory:", hw, clock, config: testConfig(overrides) });
  await app.ready();
  if (options.hwUp !== false) app.room.ingest.handle(snapshotEvent());
  return { app, clock, hw };
}

export interface Call {
  cookie?: string | null;
  payload?: unknown;
  origin?: string | null;
  contentType?: string;
  remoteAddress?: string;
}

export type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

/** A browser request: JSON body for POST/PUT/PATCH; DELETE has no body and no content type (like the kiosk). */
export function call(app: FastifyInstance, method: Method, url: string, options: Call = {}): Promise<LightMyRequestResponse> {
  const headers: Record<string, string> = { host: HOST };
  const hasBody = method === "POST" || method === "PUT" || method === "PATCH";
  if (options.origin !== null) headers.origin = options.origin ?? ORIGIN;
  if (options.cookie) headers.cookie = `ec_sid=${options.cookie}`;
  if (hasBody) headers["content-type"] = options.contentType ?? "application/json";
  return app.inject({
    method, url, headers, remoteAddress: options.remoteAddress ?? PHONE_IP,
    ...(hasBody ? { payload: JSON.stringify(options.payload ?? {}) } : {}),
  });
}

/** The signed `ec_sid` value a response set, if any. */
export function cookieOf(response: LightMyRequestResponse): string | null {
  return response.cookies.find((c) => c.name === "ec_sid")?.value ?? null;
}

/** A browser session at the given level (control: room PIN, technician: technician PIN). */
export async function sessionAt(app: FastifyInstance, level: "view" | "control" | "technician", remoteAddress = PHONE_IP): Promise<string> {
  const cookie = cookieOf(await call(app, "GET", "/api/session", { remoteAddress }));
  if (cookie === null) throw new Error("no cookie");
  if (level === "view") return cookie;
  const pin = level === "control" ? "1234" : "123456";
  const response = await call(app, "POST", "/api/session/login", { cookie, remoteAddress, payload: { level, pin, label: "phone" } });
  if (response.statusCode !== 200) throw new Error(`login failed: ${response.body}`);
  return cookie;
}

let seq = 0;
export const commandBody = (body: unknown): { client_cmd_id: string; body: unknown } => ({
  client_cmd_id: `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`,
  body,
});

const isType =
  <T extends ServerEvent["type"]>(type: T) =>
  (frame: ServerEvent): frame is Extract<ServerEvent, { type: T }> =>
    frame.type === type;

export interface TestSocket {
  ws: WebSocket;
  frames: ServerEvent[];
  /** Resolves with the next frame of `type` (already received ones count). */
  next<T extends ServerEvent["type"]>(type: T, after?: number): Promise<Extract<ServerEvent, { type: T }>>;
}

export async function openSocket(app: FastifyInstance, options: { cookie?: string | null; origin?: string } = {}): Promise<TestSocket> {
  const frames: ServerEvent[] = [];
  const headers: Record<string, string> = { host: HOST, origin: options.origin ?? ORIGIN };
  if (options.cookie) headers.cookie = `ec_sid=${options.cookie}`;
  const ws = await app.injectWS("/ws", { headers }, {
    onInit: (socket) => socket.on("message", (data) => frames.push(ServerEvent.parse(JSON.parse(String(data))))),
  });
  return {
    ws,
    frames,
    async next(type, after = 0) {
      for (let i = 0; i < 100; i += 1) {
        const found = frames.slice(after).find(isType(type));
        if (found !== undefined) return found;
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      throw new Error(`no ${type} frame`);
    },
  };
}
```

5. Create `apps/core-api/test/routes/ir.test.ts`:
```ts
import type { IrDevice } from "@eduscope/contracts";
import { describe, expect, it } from "vitest";
import { findIrCommand } from "../../src/db/ir.ts";
import { call, openSocket, sessionAt, startApp } from "./app-helpers.ts";

async function technician(overrides: Record<string, string> = {}) {
  const started = await startApp({ SEED_FAKE_IR_CODES: "true", ...overrides });
  const cookie = await sessionAt(started.app, "technician");
  return { ...started, cookie };
}

describe("IR routes (S3)", () => {
  it("lists AC (14) and Projector (2) from the DB, without codes", async () => {
    const { app, cookie } = await technician();
    const response = await call(app, "GET", "/api/ir/devices", { cookie });
    const list: IrDevice[] = response.json();
    expect(list.map((d) => [d.name, d.commands.length])).toEqual([["Air conditioning", 14], ["Projector", 2]]);
    expect(response.body).not.toContain("C/8hRgHrBkYBgAMH");
    await app.close();
  });

  it("learn → 202, listening then captured over WS; test → 202 sends the code; test-result → tested", async () => {
    const { app, hw, cookie } = await technician();
    const socket = await openSocket(app, { cookie });
    const learn = await call(app, "POST", "/api/ir/commands/projector.power_on/learn", { cookie });
    expect([learn.statusCode, learn.body]).toEqual([202, ""]);
    expect(await socket.next("ir_capture")).toMatchObject({ command_id: "projector.power_on", status: "listening" });
    await app.room.ir.idle();
    await expect.poll(() => socket.frames.filter((f) => f.type === "ir_capture").at(-1)).toMatchObject({ status: "captured" });
    expect(await socket.next("invalidate")).toEqual({ type: "invalidate", keys: [["ir", "devices"]] });
    expect((await call(app, "POST", "/api/ir/commands/projector.power_on/test", { cookie })).statusCode).toBe(202);
    expect(hw.calls.at(-1)).toEqual({ method: "irSend", body: { transport: "ir_zs06", code_format: "tuya", code: "Q0FQVFVSRUQ=" } });
    const answer = await call(app, "POST", "/api/ir/commands/projector.power_on/test-result", { cookie, payload: { reacted: true } });
    expect(answer.json()).toMatchObject({ id: "projector.power_on", captured: true, test: "reacted" });
    socket.ws.terminate();
    await app.close();
  });

  it("nothing received keeps the stored code (H21)", async () => {
    const { app, hw, cookie } = await technician();
    hw.nextLearns.push({ status: "timeout" });
    await call(app, "POST", "/api/ir/commands/projector.power_on/learn", { cookie });
    await app.room.ir.idle();
    expect(findIrCommand(app.room.db, "projector.power_on")?.code).toBe("C/8hRgHrBkYBgAMH");
    await app.close();
  });

  it("a second learn while one runs → 409 precondition", async () => {
    const { app, hw, cookie } = await technician();
    hw.nextLearns.push(new Promise(() => undefined)); // the first capture never ends in this test
    await call(app, "POST", "/api/ir/commands/projector.power_on/learn", { cookie });
    const second = await call(app, "POST", "/api/ir/commands/ac.setpoint_24/learn", { cookie });
    expect([second.statusCode, second.json()]).toEqual([409, { code: "precondition", message: "Another capture is running" }]);
    await app.close();
  });

  it("+ Add device, + Add a command, delete; 404 for an unknown command; validation 400", async () => {
    const { app, cookie } = await technician();
    const device = await call(app, "POST", "/api/ir/devices", { cookie, payload: { name: "Fan", brand: "Acme", kind: "other", transport: "ir_mcu" } });
    expect(device.statusCode).toBe(201);
    const id: string = device.json().device_id;
    const command = await call(app, "POST", `/api/ir/devices/${id}/commands`, { cookie, payload: { name: "On", role: "power_on", setpoint: null } });
    expect([command.statusCode, command.json()]).toEqual([201, expect.objectContaining({ name: "On", captured: false, test: "untested" })]);
    const renamed = await call(app, "PATCH", `/api/ir/devices/${id}`, { cookie, payload: { name: "Ceiling fan" } });
    expect(renamed.json()).toMatchObject({ name: "Ceiling fan", commands: [expect.objectContaining({ name: "On" })] });
    expect((await call(app, "DELETE", `/api/ir/commands/${command.json().id}`, { cookie })).statusCode).toBe(204);
    expect((await call(app, "DELETE", "/api/ir/commands/nope", { cookie })).json()).toEqual({ code: "not_found", message: "Command not found" });
    const bad = await call(app, "POST", "/api/ir/devices/ac/commands", { cookie, payload: { name: "25", role: "setpoint", setpoint: null } });
    expect([bad.statusCode, bad.json().code]).toEqual([400, "validation"]);
    await app.close();
  });
});
```

**Test:** `test/routes/access.test.ts` (9 IR rows × no-session 401, view 401, control 403, technician passes); `test/routes/ir.test.ts` — list without codes; learn → listening → captured → invalidate, test sends the new code, test-result; nothing received keeps the code; second learn 409; add device/command/rename/delete/404/400.

**Verify:** `pnpm --filter @eduscope/core-api test` → `265 passed`. `pnpm verify` green.

**Commit:** `git add -A && git commit -m "feat(core-api): IR routes (S3) behind technician"` (with the ticked box in this plan)


### T14 — Activity: every authorised mutation resets the idle timer
- [ ] done

**Files:** `apps/core-api/src/plugins/auth.ts`, `apps/core-api/test/routes/session.test.ts`

**Context:** ARCHITECTURE §5 "Activity = any authorised mutation": without it a technician working in S3 for 15 min is logged out mid-edit. One `onResponse` hook in `plugins/auth.ts`: a 2xx answer to a non-GET route that declares `config.access` calls `sessions.touch`. Refused / failed requests do not count. (`POST /api/commands` keeps its own touch; touching twice is harmless.)

**Do:**

1. Replace the whole file `apps/core-api/src/plugins/auth.ts`:
```ts
import type { AccessLevel, ApiError } from "@eduscope/contracts";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import fp from "fastify-plugin";
import "@fastify/cookie"; // request.cookies / reply.setCookie typings
import type { ResolvedClient, SessionRow, SessionService } from "../auth/sessions.ts";
import { hasAccess, isKioskRequest } from "../domain/session-rules.ts";

// ARCHITECTURE §5 guard. Resolves `request.client` from the signed `ec_sid` cookie and the socket
// address (never a header, trustProxy is false), enforces `config.access`, refuses to start when a
// mutating route forgets to declare it, and counts every successful guarded mutation as activity.

export const SESSION_COOKIE = "ec_sid";

declare module "fastify" {
  interface FastifyContextConfig {
    /** Required level for this route. Mandatory on every non-GET route unless `public`. */
    access?: "control" | "technician";
    /** Mutating route open to everyone (login, lock). */
    public?: boolean;
  }
  interface FastifyRequest {
    client: ResolvedClient;
  }
}

const READ_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/** Throws for a non-GET route without `config.access` (or `config.public`). Exported for tests. */
export function assertRouteAccess(route: { method: string | string[]; url: string; config?: { access?: string; public?: boolean } }): void {
  const methods = Array.isArray(route.method) ? route.method : [route.method];
  const mutating = methods.some((method) => !READ_METHODS.has(method));
  if (mutating && route.config?.access === undefined && route.config?.public !== true) {
    throw new Error(`Route ${methods.join(",")} ${route.url} must declare config.access`);
  }
}

/** Sets the session cookie when `ensure` created a row. */
export function ensureSession(sessions: SessionService, request: FastifyRequest, reply: FastifyReply): ResolvedClient & { row: SessionRow } {
  const { client, newCookieId } = sessions.ensure(request.client);
  if (newCookieId !== null) {
    reply.setCookie(SESSION_COOKIE, newCookieId, { path: "/", httpOnly: true, sameSite: "strict", signed: true });
  }
  request.client = client;
  return client;
}

export function readSessionCookie(request: FastifyRequest): string | null {
  const raw = request.cookies[SESSION_COOKIE];
  if (raw === undefined) return null;
  const unsigned = request.unsignCookie(raw);
  return unsigned.valid ? unsigned.value : null;
}

export const authPlugin = fp(async (app: FastifyInstance, options: { sessions: SessionService; localhostIsKiosk: boolean }) => {
  app.decorateRequest("client");

  app.addHook("onRoute", (route) => assertRouteAccess({ method: route.method, url: route.url, config: route.config ?? {} }));

  app.addHook("onRequest", async (request) => {
    // trustProxy is false, so request.ip IS the socket peer address (never X-Forwarded-For).
    const kiosk = isKioskRequest(request.ip, options.localhostIsKiosk);
    request.client = options.sessions.resolve(readSessionCookie(request), request.ip ?? "", kiosk);
  });

  app.addHook("preHandler", async (request, reply) => {
    const need: AccessLevel | undefined = request.routeOptions.config.access;
    if (need === undefined || hasAccess(request.client.access, need)) return;
    const body: ApiError =
      request.client.access === "view"
        ? { code: "unauthorized", message: "Enter the room PIN" }
        : { code: "forbidden", message: "Technician PIN required" };
    return reply.status(body.code === "unauthorized" ? 401 : 403).send(body);
  });

  // §5 "Activity = any authorised mutation": a 2xx on a guarded non-GET route resets the idle timer.
  app.addHook("onResponse", async (request, reply) => {
    if (READ_METHODS.has(request.method) || request.routeOptions.config.access === undefined) return;
    if (reply.statusCode < 300) options.sessions.touch(request.client);
  });
});
```

2. Patch `apps/core-api/test/routes/session.test.ts` (125 lines, so only the change is shown). Run from the repo root; it must print nothing:
```sh
git apply --whitespace=nowarn <<'PATCH'
diff --git a/apps/core-api/test/routes/session.test.ts b/apps/core-api/test/routes/session.test.ts
index c5440d9..b0a9973 100644
--- a/apps/core-api/test/routes/session.test.ts
+++ b/apps/core-api/test/routes/session.test.ts
@@ -108,3 +108,18 @@ describe("kiosk exemption (D-09)", () => {
     await app.close();
   });
 });
+
+describe("activity (§5)", () => {
+  it("a successful technician mutation resets the 15 min idle timer; a refused one does not", async () => {
+    const { app, clock } = await startApp();
+    const cookie = await sessionAt(app, "technician");
+    clock.advance(10 * 60_000);
+    const created = await call(app, "POST", "/api/ir/devices", { cookie, payload: { name: "Fan", brand: "Acme", kind: "other", transport: "ir_mcu" } });
+    expect(created.statusCode).toBe(201);
+    expect((await call(app, "GET", "/api/session", { cookie })).json()).toMatchObject({ expires_at: "2026-10-05T11:07:00.000Z" });
+    clock.advance(10 * 60_000);
+    expect((await call(app, "DELETE", "/api/ir/commands/nope", { cookie })).statusCode).toBe(404);
+    expect((await call(app, "GET", "/api/session", { cookie })).json()).toMatchObject({ access: "technician", expires_at: "2026-10-05T11:07:00.000Z" });
+    await app.close();
+  });
+});
PATCH
```

**Test:** `apps/core-api/test/routes/session.test.ts` — "activity (§5)": a 201 moves `expires_at` to 11:07; a 404 does not.

**Verify:** `pnpm --filter @eduscope/core-api test` → `266 passed`. `pnpm verify` green.

**Commit:** `git add -A && git commit -m "feat(core-api): every authorised mutation counts as activity"` (with the ticked box in this plan)


### T15 — `db/schedule.ts`: class blocks and timed actions
- [ ] done

**Files:** `apps/core-api/src/db/schedule.ts`, `apps/core-api/test/db/schedule.test.ts`

**Context:** ARCHITECTURE §6.2 `class_blocks` / `timed_actions` (JSON `days`, `steps`), contracts `ClassBlock`, `TimedAction`, `ClassBlockInput`, `TimedActionInput`. Rows are parsed with the contracts on the way out. Order: blocks by start, actions by time.

**Do:**

1. Create `apps/core-api/src/db/schedule.ts`:
```ts
import { ClassBlock, TimedAction, type ClassBlockInput, type Schedule, type TimedActionInput } from "@eduscope/contracts";
import { asc, eq } from "drizzle-orm";
import type { Db } from "./client.ts";
import { classBlocks, timedActions } from "./schema.ts";

// S3c Schedule (ARCHITECTURE §6.2): class blocks end control sessions (§2.3), timed actions run
// as "schedule" (scheduler/). JSON columns are parsed with the contracts on the way out.

type BlockRow = typeof classBlocks.$inferSelect;
type ActionRow = typeof timedActions.$inferSelect;

function toBlock(row: BlockRow): ClassBlock {
  const days: unknown = JSON.parse(row.days);
  return ClassBlock.parse({ id: row.id, days, start: row.start, end: row.end });
}

function toAction(row: ActionRow): TimedAction {
  const days: unknown = JSON.parse(row.days);
  const steps: unknown = JSON.parse(row.steps);
  return TimedAction.parse({ id: row.id, name: row.name, time: row.time, days, enabled: row.enabled, steps });
}

/** GET /api/schedule: blocks by start time, actions by time. */
export function loadSchedule(db: Db): Schedule {
  return {
    class_blocks: db.select().from(classBlocks).orderBy(asc(classBlocks.start)).all().map(toBlock),
    actions: db.select().from(timedActions).orderBy(asc(timedActions.time)).all().map(toAction),
  };
}

function findBlock(db: Db, id: string): ClassBlock | null {
  const row = db.select().from(classBlocks).where(eq(classBlocks.id, id)).get();
  return row === undefined ? null : toBlock(row);
}

function findAction(db: Db, id: string): TimedAction | null {
  const row = db.select().from(timedActions).where(eq(timedActions.id, id)).get();
  return row === undefined ? null : toAction(row);
}

const blockColumns = (input: ClassBlockInput) => ({ days: JSON.stringify(input.days), start: input.start, end: input.end });
const actionColumns = (input: TimedActionInput) => ({
  name: input.name, time: input.time, days: JSON.stringify(input.days), enabled: input.enabled, steps: JSON.stringify(input.steps),
});

export function createBlock(db: Db, id: string, input: ClassBlockInput): ClassBlock {
  db.insert(classBlocks).values({ id, ...blockColumns(input) }).run();
  const block = findBlock(db, id);
  if (block === null) throw new Error("class block vanished");
  return block;
}

/** Null when the id is unknown. */
export function updateBlock(db: Db, id: string, input: ClassBlockInput): ClassBlock | null {
  db.update(classBlocks).set(blockColumns(input)).where(eq(classBlocks.id, id)).run();
  return findBlock(db, id);
}

export function deleteBlock(db: Db, id: string): boolean {
  return db.delete(classBlocks).where(eq(classBlocks.id, id)).run().changes > 0;
}

export function createAction(db: Db, id: string, input: TimedActionInput): TimedAction {
  db.insert(timedActions).values({ id, ...actionColumns(input) }).run();
  const action = findAction(db, id);
  if (action === null) throw new Error("timed action vanished");
  return action;
}

/** Null when the id is unknown (also how the S3c enable toggle saves). */
export function updateAction(db: Db, id: string, input: TimedActionInput): TimedAction | null {
  db.update(timedActions).set(actionColumns(input)).where(eq(timedActions.id, id)).run();
  return findAction(db, id);
}

export function deleteAction(db: Db, id: string): boolean {
  return db.delete(timedActions).where(eq(timedActions.id, id)).run().changes > 0;
}
```

2. Create `apps/core-api/test/db/schedule.test.ts`:
```ts
import type { TimedActionInput } from "@eduscope/contracts";
import { describe, expect, it } from "vitest";
import { openDb } from "../../src/db/client.ts";
import { createAction, createBlock, deleteAction, deleteBlock, loadSchedule, updateAction, updateBlock } from "../../src/db/schedule.ts";

const ALL_OFF: TimedActionInput = {
  name: "All off", time: "18:00", days: ["mon", "tue", "wed", "thu", "fri"], enabled: true,
  steps: [{ kind: "lights.set", gang: "front", on: false }, { kind: "ac.power", on: false }],
};

describe("schedule records", () => {
  it("round-trips blocks and actions, sorted by time", () => {
    const { db } = openDb(":memory:");
    createBlock(db, "b2", { days: ["mon"], start: "10:15", end: "12:15" });
    createBlock(db, "b1", { days: ["mon", "wed"], start: "08:00", end: "10:00" });
    const action = createAction(db, "a1", ALL_OFF);
    expect(action).toEqual({ id: "a1", ...ALL_OFF });
    expect(loadSchedule(db)).toEqual({
      class_blocks: [
        { id: "b1", days: ["mon", "wed"], start: "08:00", end: "10:00" },
        { id: "b2", days: ["mon"], start: "10:15", end: "12:15" },
      ],
      actions: [{ id: "a1", ...ALL_OFF }],
    });
  });

  it("updates and deletes; unknown ids answer null / false", () => {
    const { db } = openDb(":memory:");
    createBlock(db, "b1", { days: ["mon"], start: "08:00", end: "10:00" });
    createAction(db, "a1", ALL_OFF);
    expect(updateBlock(db, "b1", { days: ["fri"], start: "09:00", end: "11:00" })).toEqual({ id: "b1", days: ["fri"], start: "09:00", end: "11:00" });
    expect(updateAction(db, "a1", { ...ALL_OFF, enabled: false })?.enabled).toBe(false);
    expect(updateBlock(db, "nope", { days: ["fri"], start: "09:00", end: "11:00" })).toBeNull();
    expect(deleteBlock(db, "b1")).toBe(true);
    expect(deleteAction(db, "a1")).toBe(true);
    expect(deleteAction(db, "a1")).toBe(false);
    expect(loadSchedule(db)).toEqual({ class_blocks: [], actions: [] });
  });
});
```

**Test:** `apps/core-api/test/db/schedule.test.ts` — round trip + sort; update/delete; unknown ids.

**Verify:** `pnpm --filter @eduscope/core-api test` → `268 passed`. `pnpm verify` green.

**Commit:** `git add -A && git commit -m "feat(core-api): schedule records"` (with the ticked box in this plan)


### T16 — Schedule routes (S3c)
- [ ] done

**Files:** `apps/core-api/src/app.ts`, `apps/core-api/src/routes/schedule.ts`, `apps/core-api/test/routes/access.test.ts`, `apps/core-api/test/routes/schedule.test.ts`

**Context:** ARCHITECTURE §3.3 `api/schedule.ts`; kiosk calls `GET /api/schedule`, `POST /api/schedule/blocks`, `DELETE /api/schedule/blocks/:id`, `POST /api/schedule/actions`, `PUT /api/schedule/actions/:id` (also the enable toggle), `DELETE /api/schedule/actions/:id`; the contract comment adds `PUT /api/schedule/blocks/:id`. Technician; every write broadcasts `invalidate [["schedule"]]`; unknown id 404 "Not found". Validation errors come from the contract ("end: end must be after start").

**Do:**

1. Patch `apps/core-api/src/app.ts` (170 lines, so only the change is shown). Run from the repo root; it must print nothing:
```sh
git apply --whitespace=nowarn <<'PATCH'
diff --git a/apps/core-api/src/app.ts b/apps/core-api/src/app.ts
index 80f1c79..968e8b2 100644
--- a/apps/core-api/src/app.ts
+++ b/apps/core-api/src/app.ts
@@ -28,6 +28,7 @@ import { createRegistrySync } from "./registry-sync.ts";
 import { commandRoutes } from "./routes/commands.ts";
 import { healthRoutes } from "./routes/health.ts";
 import { irRoutes } from "./routes/ir.ts";
+import { scheduleRoutes } from "./routes/schedule.ts";
 import { sessionRoutes } from "./routes/session.ts";
 import { stateRoutes } from "./routes/state.ts";
 
@@ -147,6 +148,7 @@ export async function buildApp(deps: AppDeps): Promise<FastifyInstance> {
       await api.register(commandRoutes, { dispatcher, sessions });
       await api.register(healthRoutes, { store });
       await api.register(irRoutes, { ir });
+      await api.register(scheduleRoutes, { db, emit: (event) => hub.broadcast(event) });
     },
     { prefix: "/api" },
   );
PATCH
```

2. Create `apps/core-api/src/routes/schedule.ts`:
```ts
import { randomUUID } from "node:crypto";
import { ClassBlockInput, TimedActionInput, type ServerEvent } from "@eduscope/contracts";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import type { Db } from "../db/client.ts";
import { createAction, createBlock, deleteAction, deleteBlock, loadSchedule, updateAction, updateBlock } from "../db/schedule.ts";
import { ApiFailure } from "../errors.ts";

// ARCHITECTURE §3.3 api/schedule.ts — S3c. Technician only; every write invalidates ["schedule"].
// The scheduler reads the table on each tick, so changes apply from the next tick on.

const TECHNICIAN = { access: "technician" } as const;
const IdParams = z.object({ id: z.string().min(1) });
const notFound = (): ApiFailure => new ApiFailure(404, "not_found", "Not found");

export async function scheduleRoutes(app: FastifyInstance, options: { db: Db; emit: (event: ServerEvent) => void; newId?: () => string }) {
  const { db } = options;
  const newId = options.newId ?? randomUUID;
  const changed = (): void => options.emit({ type: "invalidate", keys: [["schedule"]] });
  const api = app.withTypeProvider<ZodTypeProvider>();

  api.get("/schedule", { config: TECHNICIAN }, async () => loadSchedule(db));

  api.post("/schedule/blocks", { config: TECHNICIAN, schema: { body: ClassBlockInput } }, async (request, reply) => {
    const block = createBlock(db, newId(), request.body);
    changed();
    return reply.status(201).send(block);
  });

  api.put("/schedule/blocks/:id", { config: TECHNICIAN, schema: { params: IdParams, body: ClassBlockInput } }, async (request) => {
    const block = updateBlock(db, request.params.id, request.body);
    if (block === null) throw notFound();
    changed();
    return block;
  });

  api.delete("/schedule/blocks/:id", { config: TECHNICIAN, schema: { params: IdParams } }, async (request, reply) => {
    if (!deleteBlock(db, request.params.id)) throw notFound();
    changed();
    return reply.status(204).send();
  });

  api.post("/schedule/actions", { config: TECHNICIAN, schema: { body: TimedActionInput } }, async (request, reply) => {
    const action = createAction(db, newId(), request.body);
    changed();
    return reply.status(201).send(action);
  });

  api.put("/schedule/actions/:id", { config: TECHNICIAN, schema: { params: IdParams, body: TimedActionInput } }, async (request) => {
    const action = updateAction(db, request.params.id, request.body);
    if (action === null) throw notFound();
    changed();
    return action;
  });

  api.delete("/schedule/actions/:id", { config: TECHNICIAN, schema: { params: IdParams } }, async (request, reply) => {
    if (!deleteAction(db, request.params.id)) throw notFound();
    changed();
    return reply.status(204).send();
  });
}
```

3. Replace the whole file `apps/core-api/test/routes/access.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { call, sessionAt, startApp, type Method } from "./app-helpers.ts";

// AC10/AC11: every M09 route, GETs included, is technician-only. Bodies are valid so the guard,
// not validation, decides; ids are unknown so a passing guard never changes anything.

const ROUTES: readonly [Method, string, unknown?][] = [
  ["GET", "/api/ir/devices"],
  ["POST", "/api/ir/devices", { name: "Fan", brand: "Acme", kind: "other", transport: "ir_mcu" }],
  ["PATCH", "/api/ir/devices/nope", { name: "Fan" }],
  ["POST", "/api/ir/devices/nope/commands", { name: "On", role: "other", setpoint: null }],
  ["DELETE", "/api/ir/commands/nope"],
  ["POST", "/api/ir/commands/nope/learn", {}],
  ["POST", "/api/ir/commands/nope/learn/cancel", {}],
  ["POST", "/api/ir/commands/nope/test", {}],
  ["POST", "/api/ir/commands/nope/test-result", { reacted: true }],
  ["GET", "/api/schedule"],
  ["POST", "/api/schedule/blocks", { days: ["mon"], start: "08:00", end: "10:00" }],
  ["PUT", "/api/schedule/blocks/nope", { days: ["mon"], start: "08:00", end: "10:00" }],
  ["DELETE", "/api/schedule/blocks/nope"],
  ["POST", "/api/schedule/actions", { name: "All off", time: "18:00", days: ["fri"], enabled: true, steps: [{ kind: "ac.power", on: false }] }],
  ["PUT", "/api/schedule/actions/nope", { name: "All off", time: "18:00", days: ["fri"], enabled: true, steps: [{ kind: "ac.power", on: false }] }],
  ["DELETE", "/api/schedule/actions/nope"],
];

describe("M09 routes need technician", () => {
  it.each(ROUTES)("%s %s: no session 401, control 403, technician passes the guard", async (method, url, payload) => {
    const { app } = await startApp();
    expect((await call(app, method, url, { payload })).json()).toEqual({ code: "unauthorized", message: "Enter the room PIN" });
    const view = await sessionAt(app, "view");
    expect((await call(app, method, url, { payload, cookie: view })).statusCode).toBe(401);
    const control = await sessionAt(app, "control", "192.168.1.51");
    const refused = await call(app, method, url, { payload, cookie: control, remoteAddress: "192.168.1.51" });
    expect([refused.statusCode, refused.json()]).toEqual([403, { code: "forbidden", message: "Technician PIN required" }]);
    const tech = await sessionAt(app, "technician", "192.168.1.52");
    const passed = await call(app, method, url, { payload, cookie: tech, remoteAddress: "192.168.1.52" });
    expect([401, 403]).not.toContain(passed.statusCode);
    await app.close();
  });
});
```

4. Create `apps/core-api/test/routes/schedule.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { call, openSocket, sessionAt, startApp } from "./app-helpers.ts";

const LIGHTS_OFF = { name: "Lights off", time: "18:00", days: ["mon", "fri"], enabled: true, steps: [{ kind: "lights.set", gang: "rear", on: false }] };

describe("schedule routes (S3c)", () => {
  it("creates, edits and removes blocks and actions; every write invalidates ['schedule']", async () => {
    const { app } = await startApp();
    const cookie = await sessionAt(app, "technician");
    const socket = await openSocket(app, { cookie });
    expect((await call(app, "GET", "/api/schedule", { cookie })).json()).toEqual({ class_blocks: [], actions: [] });

    const block = await call(app, "POST", "/api/schedule/blocks", { cookie, payload: { days: ["mon"], start: "08:00", end: "10:00" } });
    expect([block.statusCode, block.json()]).toEqual([201, { id: expect.any(String), days: ["mon"], start: "08:00", end: "10:00" }]);
    expect(await socket.next("invalidate")).toEqual({ type: "invalidate", keys: [["schedule"]] });
    const action = await call(app, "POST", "/api/schedule/actions", { cookie, payload: LIGHTS_OFF });
    expect(action.statusCode).toBe(201);
    const actionId: string = action.json().id;
    const off = await call(app, "PUT", `/api/schedule/actions/${actionId}`, { cookie, payload: { ...LIGHTS_OFF, enabled: false } });
    expect(off.json()).toEqual({ id: actionId, ...LIGHTS_OFF, enabled: false });
    expect((await call(app, "GET", "/api/schedule", { cookie })).json().actions).toEqual([{ id: actionId, ...LIGHTS_OFF, enabled: false }]);

    expect((await call(app, "DELETE", `/api/schedule/blocks/${block.json().id}`, { cookie })).statusCode).toBe(204);
    expect((await call(app, "DELETE", `/api/schedule/actions/${actionId}`, { cookie })).statusCode).toBe(204);
    expect((await call(app, "DELETE", `/api/schedule/actions/${actionId}`, { cookie })).json()).toEqual({ code: "not_found", message: "Not found" });
    expect(socket.frames.filter((f) => f.type === "invalidate")).toHaveLength(5);
    socket.ws.terminate();
    await app.close();
  });

  it("validates the contract: end after start, at least one day and one step", async () => {
    const { app } = await startApp();
    const cookie = await sessionAt(app, "technician");
    const backwards = await call(app, "POST", "/api/schedule/blocks", { cookie, payload: { days: ["mon"], start: "10:00", end: "08:00" } });
    expect([backwards.statusCode, backwards.json()]).toEqual([400, { code: "validation", message: "end: end must be after start" }]);
    const noSteps = await call(app, "POST", "/api/schedule/actions", { cookie, payload: { ...LIGHTS_OFF, steps: [] } });
    expect(noSteps.statusCode).toBe(400);
    await app.close();
  });
});
```

**Test:** `test/routes/schedule.test.ts` (CRUD + 5 invalidations; validation); 7 rows added to `test/routes/access.test.ts`.

**Verify:** `pnpm --filter @eduscope/core-api test` → `277 passed`. `pnpm verify` green.

**Commit:** `git add -A && git commit -m "feat(core-api): schedule routes (S3c)"` (with the ticked box in this plan)


### T17 — Device registry and permit-join routes (S3d)
- [ ] done

**Files:** `apps/core-api/src/app.ts`, `apps/core-api/src/routes/devices.ts`, `apps/core-api/test/routes/access.test.ts`, `apps/core-api/test/routes/devices.test.ts`

**Context:** ARCHITECTURE §3.3 `api/devices.ts`; SPEC S3d, R8, S2.E21. `GET /api/devices` = `state.devices` (registry + live online, like the mock). `PATCH` (DevicePatch: name, transport, hw_ref) → R8 rule from T8 (409 "Only IR devices change transport (ZS06 or MCU)"), registry sync, `invalidate [["devices"],["ir","devices"]]`, answers the live `Device`. `DELETE` → 204, registry + AC range sync (R4), same invalidate. `POST /api/zigbee/permit-join {seconds: 240}` → 503 "Hardware service offline" when hw is down, 409 "Coordinator offline", hw refusal 503 "Coordinator didn't respond", else 202; the countdown reaches every client through hw's `zigbee.mesh` event (already ingested since M08).

**Do:**

1. Patch `apps/core-api/src/app.ts` (172 lines, so only the change is shown). Run from the repo root; it must print nothing:
```sh
git apply --whitespace=nowarn <<'PATCH'
diff --git a/apps/core-api/src/app.ts b/apps/core-api/src/app.ts
index 968e8b2..e9fc58b 100644
--- a/apps/core-api/src/app.ts
+++ b/apps/core-api/src/app.ts
@@ -26,6 +26,7 @@ import { createHub, PING_MS, realtimePlugin, type Hub } from "./plugins/realtime
 import { staticPlugin } from "./plugins/static.ts";
 import { createRegistrySync } from "./registry-sync.ts";
 import { commandRoutes } from "./routes/commands.ts";
+import { deviceRoutes } from "./routes/devices.ts";
 import { healthRoutes } from "./routes/health.ts";
 import { irRoutes } from "./routes/ir.ts";
 import { scheduleRoutes } from "./routes/schedule.ts";
@@ -149,6 +150,7 @@ export async function buildApp(deps: AppDeps): Promise<FastifyInstance> {
       await api.register(healthRoutes, { store });
       await api.register(irRoutes, { ir });
       await api.register(scheduleRoutes, { db, emit: (event) => hub.broadcast(event) });
+      await api.register(deviceRoutes, { db, store, hw: deps.hw, sync, emit: (event) => hub.broadcast(event) });
     },
     { prefix: "/api" },
   );
PATCH
```

2. Create `apps/core-api/src/routes/devices.ts`:
```ts
import { DevicePatch, PermitJoinRequest, type Device, type ServerEvent } from "@eduscope/contracts";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import type { Db } from "../db/client.ts";
import { deleteDevice, findDevice, updateDevice } from "../db/devices.ts";
import { transportChangeError } from "../domain/devices.ts";
import type { StateStore } from "../domain/state-store.ts";
import { ApiFailure } from "../errors.ts";
import type { HwClient } from "../hw/client.ts";
import type { RegistrySync } from "../registry-sync.ts";

// ARCHITECTURE §3.3 api/devices.ts — S3d registry and permit joining. Technician only. A registry
// write reloads the store's registry (devices[] in the next `state`) and invalidates both lists.

const TECHNICIAN = { access: "technician" } as const;
const IdParams = z.object({ id: z.string().min(1) });
const REGISTRY_KEYS = [["devices"], ["ir", "devices"]];
const notFound = (): ApiFailure => new ApiFailure(404, "not_found", "Device not found");

export async function deviceRoutes(
  app: FastifyInstance,
  options: { db: Db; store: StateStore; hw: HwClient; sync: RegistrySync; emit: (event: ServerEvent) => void },
) {
  const { db, store, hw, sync } = options;
  const changed = (): void => options.emit({ type: "invalidate", keys: REGISTRY_KEYS });
  const live = (id: string): Device => {
    const device = store.get().devices.find((candidate) => candidate.id === id);
    if (device === undefined) throw notFound();
    return device;
  };
  const api = app.withTypeProvider<ZodTypeProvider>();

  api.get("/devices", { config: TECHNICIAN }, async () => store.get().devices);

  /** S3d edit sheet: rename, hardware id, transport (IR devices only, R8). */
  api.patch("/devices/:id", { config: TECHNICIAN, schema: { params: IdParams, body: DevicePatch } }, async (request) => {
    const current = findDevice(db, request.params.id);
    if (current === null) throw notFound();
    const refused = transportChangeError(current.transport, request.body.transport);
    if (refused !== null) throw new ApiFailure(409, "precondition", refused);
    updateDevice(db, current.id, request.body);
    sync.registry();
    changed();
    return live(current.id);
  });

  api.delete("/devices/:id", { config: TECHNICIAN, schema: { params: IdParams } }, async (request, reply) => {
    if (!deleteDevice(db, request.params.id)) throw notFound();
    sync.registry();
    sync.acSetpoints(); // its IR commands went with it (R4)
    changed();
    return reply.status(204).send();
  });

  /** S3d "Permit joining": hw opens the mesh; `zigbee.mesh` then drives S2.E21's countdown on every client. */
  api.post("/zigbee/permit-join", { config: TECHNICIAN, schema: { body: PermitJoinRequest } }, async (request, reply) => {
    const state = store.get();
    if (state.connection.hw === "down") throw new ApiFailure(503, "hw_unavailable", "Hardware service offline");
    if (state.zigbee.coordinator.status !== "online") throw new ApiFailure(409, "precondition", "Coordinator offline");
    const ack = await hw.permitJoin({ seconds: request.body.seconds });
    if (!ack.ok) throw new ApiFailure(503, "hw_unavailable", "Coordinator didn't respond");
    return reply.status(202).send();
  });
}
```

3. Replace the whole file `apps/core-api/test/routes/access.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { call, sessionAt, startApp, type Method } from "./app-helpers.ts";

// AC10/AC11: every M09 route, GETs included, is technician-only. Bodies are valid so the guard,
// not validation, decides; ids are unknown so a passing guard never changes anything.

const ROUTES: readonly [Method, string, unknown?][] = [
  ["GET", "/api/ir/devices"],
  ["POST", "/api/ir/devices", { name: "Fan", brand: "Acme", kind: "other", transport: "ir_mcu" }],
  ["PATCH", "/api/ir/devices/nope", { name: "Fan" }],
  ["POST", "/api/ir/devices/nope/commands", { name: "On", role: "other", setpoint: null }],
  ["DELETE", "/api/ir/commands/nope"],
  ["POST", "/api/ir/commands/nope/learn", {}],
  ["POST", "/api/ir/commands/nope/learn/cancel", {}],
  ["POST", "/api/ir/commands/nope/test", {}],
  ["POST", "/api/ir/commands/nope/test-result", { reacted: true }],
  ["GET", "/api/schedule"],
  ["POST", "/api/schedule/blocks", { days: ["mon"], start: "08:00", end: "10:00" }],
  ["PUT", "/api/schedule/blocks/nope", { days: ["mon"], start: "08:00", end: "10:00" }],
  ["DELETE", "/api/schedule/blocks/nope"],
  ["POST", "/api/schedule/actions", { name: "All off", time: "18:00", days: ["fri"], enabled: true, steps: [{ kind: "ac.power", on: false }] }],
  ["PUT", "/api/schedule/actions/nope", { name: "All off", time: "18:00", days: ["fri"], enabled: true, steps: [{ kind: "ac.power", on: false }] }],
  ["DELETE", "/api/schedule/actions/nope"],
  ["GET", "/api/devices"],
  ["PATCH", "/api/devices/nope", { name: "x" }],
  ["DELETE", "/api/devices/nope"],
  ["POST", "/api/zigbee/permit-join", { seconds: 240 }],
];

describe("M09 routes need technician", () => {
  it.each(ROUTES)("%s %s: no session 401, control 403, technician passes the guard", async (method, url, payload) => {
    const { app } = await startApp();
    expect((await call(app, method, url, { payload })).json()).toEqual({ code: "unauthorized", message: "Enter the room PIN" });
    const view = await sessionAt(app, "view");
    expect((await call(app, method, url, { payload, cookie: view })).statusCode).toBe(401);
    const control = await sessionAt(app, "control", "192.168.1.51");
    const refused = await call(app, method, url, { payload, cookie: control, remoteAddress: "192.168.1.51" });
    expect([refused.statusCode, refused.json()]).toEqual([403, { code: "forbidden", message: "Technician PIN required" }]);
    const tech = await sessionAt(app, "technician", "192.168.1.52");
    const passed = await call(app, method, url, { payload, cookie: tech, remoteAddress: "192.168.1.52" });
    expect([401, 403]).not.toContain(passed.statusCode);
    await app.close();
  });
});
```

4. Create `apps/core-api/test/routes/devices.test.ts`:
```ts
import type { IrDevice } from "@eduscope/contracts";
import { describe, expect, it } from "vitest";
import { hwEvent, T0 } from "../helpers.ts";
import { call, openSocket, sessionAt, startApp } from "./app-helpers.ts";

describe("device routes (S3d)", () => {
  it("lists the registry with live online state", async () => {
    const { app } = await startApp();
    const cookie = await sessionAt(app, "technician");
    const list = (await call(app, "GET", "/api/devices", { cookie })).json();
    expect(list).toHaveLength(12);
    expect(list[0]).toMatchObject({ id: "projector", transport: "ir_zs06", online: { value: true } });
    await app.close();
  });

  it("R8: switching the projector to mcu shows 'via MCU' in S3 and in devices[]", async () => {
    const { app } = await startApp();
    const cookie = await sessionAt(app, "technician");
    const socket = await openSocket(app, { cookie });
    const patched = await call(app, "PATCH", "/api/devices/projector", { cookie, payload: { transport: "ir_mcu" } });
    expect(patched.json()).toMatchObject({ id: "projector", name: "Projector", transport: "ir_mcu" });
    expect(await socket.next("invalidate")).toEqual({ type: "invalidate", keys: [["devices"], ["ir", "devices"]] });
    const ir: IrDevice[] = (await call(app, "GET", "/api/ir/devices", { cookie })).json();
    expect(ir.find((d) => d.device_id === "projector")?.transport).toBe("ir_mcu");
    expect(app.room.store.get().devices.find((d) => d.id === "projector")?.transport).toBe("ir_mcu");
    socket.ws.terminate();
    await app.close();
  });

  it("renames; refuses a transport change on a non-IR device; removes", async () => {
    const { app } = await startApp();
    const cookie = await sessionAt(app, "technician");
    expect((await call(app, "PATCH", "/api/devices/lights", { cookie, payload: { name: "Lights", hw_ref: "r101_lights_2" } })).json()).toMatchObject({
      name: "Lights", hw_ref: "r101_lights_2",
    });
    const refused = await call(app, "PATCH", "/api/devices/lights", { cookie, payload: { transport: "ir_mcu" } });
    expect([refused.statusCode, refused.json()]).toEqual([409, { code: "precondition", message: "Only IR devices change transport (ZS06 or MCU)" }]);
    expect((await call(app, "DELETE", "/api/devices/door", { cookie })).statusCode).toBe(204);
    expect(app.room.store.get().devices.map((d) => d.id)).not.toContain("door");
    expect((await call(app, "DELETE", "/api/devices/door", { cookie })).statusCode).toBe(404);
    await app.close();
  });

  it("removing the AC removes its setpoints from S1 (R4)", async () => {
    const { app } = await startApp({ SEED_FAKE_IR_CODES: "true" });
    const cookie = await sessionAt(app, "technician");
    expect(app.room.store.get().environment.ac.available_setpoints).toHaveLength(13);
    await call(app, "DELETE", "/api/devices/ac", { cookie });
    expect(app.room.store.get().environment.ac.available_setpoints).toEqual([]);
    await app.close();
  });

  it("permit joining asks hw for 240 s; the mesh event opens S2's countdown", async () => {
    const { app, hw } = await startApp();
    const cookie = await sessionAt(app, "technician");
    const until = new Date(Date.parse(T0) + 240_000).toISOString();
    hw.onCall = (method) => {
      if (method === "permitJoin") app.room.ingest.handle(hwEvent("zigbee.mesh", { joining_until: until }));
    };
    const response = await call(app, "POST", "/api/zigbee/permit-join", { cookie, payload: { seconds: 240 } });
    expect([response.statusCode, hw.calls.at(-1)]).toEqual([202, { method: "permitJoin", body: { seconds: 240 } }]);
    expect(app.room.store.get().zigbee.mesh.joining).toEqual({ state: "open", until });
    expect((await call(app, "POST", "/api/zigbee/permit-join", { cookie, payload: { seconds: 60 } })).statusCode).toBe(400);
    await app.close();
  });

  it("permit joining: coordinator offline 409, hw refusal 503", async () => {
    const { app, hw } = await startApp();
    const cookie = await sessionAt(app, "technician");
    hw.nextAcks.push({ ok: false, error: { code: "timeout", message: "no answer" } });
    expect((await call(app, "POST", "/api/zigbee/permit-join", { cookie, payload: { seconds: 240 } })).json()).toEqual({
      code: "hw_unavailable", message: "Coordinator didn't respond",
    });
    const coordinator = { ...app.room.store.get().zigbee.coordinator, status: "offline" as const };
    app.room.ingest.handle(hwEvent("zigbee.coordinator", coordinator));
    expect((await call(app, "POST", "/api/zigbee/permit-join", { cookie, payload: { seconds: 240 } })).json()).toEqual({
      code: "precondition", message: "Coordinator offline",
    });
    await app.close();
  });
});
```

**Test:** `test/routes/devices.test.ts` — list; R8 projector → mcu in S3 list and `devices[]`; rename/refuse/remove/404; removing AC empties S1 range; permit join 240 s opens the mesh, 60 → 400; coordinator offline 409, hw refusal 503. 4 rows added to `access.test.ts`.

**Verify:** `pnpm --filter @eduscope/core-api test` → `287 passed`. `pnpm verify` green.

**Commit:** `git add -A && git commit -m "feat(core-api): device registry and permit-join routes (S3d)"` (with the ticked box in this plan)


### T18 — PIN changes (S3d)
- [ ] done

**Files:** `apps/core-api/src/app.ts`, `apps/core-api/src/routes/settings.ts`, `apps/core-api/test/routes/access.test.ts`, `apps/core-api/test/routes/settings.test.ts`

**Context:** ARCHITECTURE §3.3 `api/settings.ts`, §5 PIN storage (scrypt via existing `hashPin`). `PUT /api/settings/pins/room` {4 digits} / `/technician` {6 digits} → 204. The new hash replaces the setting; every OTHER session of that level ends (T11 `endAccess`, pushes `session` → kiosk toast "Locked · enter PIN to control"); the caller's own session stays. Logged as `system` with the count, never the PIN.

**Do:**

1. Patch `apps/core-api/src/app.ts` (174 lines, so only the change is shown). Run from the repo root; it must print nothing:
```sh
git apply --whitespace=nowarn <<'PATCH'
diff --git a/apps/core-api/src/app.ts b/apps/core-api/src/app.ts
index e9fc58b..85b509b 100644
--- a/apps/core-api/src/app.ts
+++ b/apps/core-api/src/app.ts
@@ -31,6 +31,7 @@ import { healthRoutes } from "./routes/health.ts";
 import { irRoutes } from "./routes/ir.ts";
 import { scheduleRoutes } from "./routes/schedule.ts";
 import { sessionRoutes } from "./routes/session.ts";
+import { settingsRoutes } from "./routes/settings.ts";
 import { stateRoutes } from "./routes/state.ts";
 
 // ARCHITECTURE §6.1: buildApp(deps) is used by main.ts and by tests (fastify.inject / injectWS).
@@ -151,6 +152,7 @@ export async function buildApp(deps: AppDeps): Promise<FastifyInstance> {
       await api.register(irRoutes, { ir });
       await api.register(scheduleRoutes, { db, emit: (event) => hub.broadcast(event) });
       await api.register(deviceRoutes, { db, store, hw: deps.hw, sync, emit: (event) => hub.broadcast(event) });
+      await api.register(settingsRoutes, { db, sessions, clock, log });
     },
     { prefix: "/api" },
   );
PATCH
```

2. Create `apps/core-api/src/routes/settings.ts`:
```ts
import { RoomPinRequest, TechnicianPinRequest } from "@eduscope/contracts";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { hashPin } from "../auth/pin-hash.ts";
import type { SessionService } from "../auth/sessions.ts";
import type { Clock } from "../clock.ts";
import type { Db } from "../db/client.ts";
import type { EventLogger } from "../db/event-log.ts";
import { writeSetting } from "../db/settings.ts";

// ARCHITECTURE §3.3 api/settings.ts — S3d PIN changes (technician). The new PIN is re-hashed
// (scrypt, §5); every OTHER session unlocked with the old PIN ends (pushes `session`). The PIN
// itself is never logged.

const TECHNICIAN = { access: "technician" } as const;

export async function settingsRoutes(app: FastifyInstance, options: { db: Db; sessions: SessionService; clock: Clock; log: EventLogger }) {
  const { db, sessions, clock, log } = options;
  const api = app.withTypeProvider<ZodTypeProvider>();

  async function change(request: FastifyRequest, reply: FastifyReply, level: "control" | "technician", pin: string) {
    const key = level === "control" ? "room_pin_hash" : "technician_pin_hash";
    const reason = level === "control" ? "room PIN changed" : "technician PIN changed";
    writeSetting(db, key, await hashPin(pin), clock.now().toISOString());
    const own = request.client.row?.public_id ?? null;
    const ended = sessions.endAccess(level, own, reason);
    log({ type: "system", actor: request.client.label, public_id: own, subject: reason, result: `${ended} sessions ended` });
    return reply.status(204).send();
  }

  api.put("/settings/pins/room", { config: TECHNICIAN, schema: { body: RoomPinRequest } }, async (request, reply) =>
    change(request, reply, "control", request.body.pin),
  );

  api.put("/settings/pins/technician", { config: TECHNICIAN, schema: { body: TechnicianPinRequest } }, async (request, reply) =>
    change(request, reply, "technician", request.body.pin),
  );
}
```

3. Replace the whole file `apps/core-api/test/routes/access.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { call, sessionAt, startApp, type Method } from "./app-helpers.ts";

// AC10/AC11: every M09 route, GETs included, is technician-only. Bodies are valid so the guard,
// not validation, decides; ids are unknown so a passing guard never changes anything.

const ROUTES: readonly [Method, string, unknown?][] = [
  ["GET", "/api/ir/devices"],
  ["POST", "/api/ir/devices", { name: "Fan", brand: "Acme", kind: "other", transport: "ir_mcu" }],
  ["PATCH", "/api/ir/devices/nope", { name: "Fan" }],
  ["POST", "/api/ir/devices/nope/commands", { name: "On", role: "other", setpoint: null }],
  ["DELETE", "/api/ir/commands/nope"],
  ["POST", "/api/ir/commands/nope/learn", {}],
  ["POST", "/api/ir/commands/nope/learn/cancel", {}],
  ["POST", "/api/ir/commands/nope/test", {}],
  ["POST", "/api/ir/commands/nope/test-result", { reacted: true }],
  ["GET", "/api/schedule"],
  ["POST", "/api/schedule/blocks", { days: ["mon"], start: "08:00", end: "10:00" }],
  ["PUT", "/api/schedule/blocks/nope", { days: ["mon"], start: "08:00", end: "10:00" }],
  ["DELETE", "/api/schedule/blocks/nope"],
  ["POST", "/api/schedule/actions", { name: "All off", time: "18:00", days: ["fri"], enabled: true, steps: [{ kind: "ac.power", on: false }] }],
  ["PUT", "/api/schedule/actions/nope", { name: "All off", time: "18:00", days: ["fri"], enabled: true, steps: [{ kind: "ac.power", on: false }] }],
  ["DELETE", "/api/schedule/actions/nope"],
  ["GET", "/api/devices"],
  ["PATCH", "/api/devices/nope", { name: "x" }],
  ["DELETE", "/api/devices/nope"],
  ["POST", "/api/zigbee/permit-join", { seconds: 240 }],
  ["PUT", "/api/settings/pins/room", { pin: "4321" }],
  ["PUT", "/api/settings/pins/technician", { pin: "654321" }],
];

describe("M09 routes need technician", () => {
  it.each(ROUTES)("%s %s: no session 401, control 403, technician passes the guard", async (method, url, payload) => {
    const { app } = await startApp();
    expect((await call(app, method, url, { payload })).json()).toEqual({ code: "unauthorized", message: "Enter the room PIN" });
    const view = await sessionAt(app, "view");
    expect((await call(app, method, url, { payload, cookie: view })).statusCode).toBe(401);
    const control = await sessionAt(app, "control", "192.168.1.51");
    const refused = await call(app, method, url, { payload, cookie: control, remoteAddress: "192.168.1.51" });
    expect([refused.statusCode, refused.json()]).toEqual([403, { code: "forbidden", message: "Technician PIN required" }]);
    const tech = await sessionAt(app, "technician", "192.168.1.52");
    const passed = await call(app, method, url, { payload, cookie: tech, remoteAddress: "192.168.1.52" });
    expect([401, 403]).not.toContain(passed.statusCode);
    await app.close();
  });
});
```

4. Create `apps/core-api/test/routes/settings.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { eventLog } from "../../src/db/schema.ts";
import { call, cookieOf, openSocket, sessionAt, startApp } from "./app-helpers.ts";

const TECH_IP = "192.168.1.70";
const OTHER_IP = "192.168.1.71";

async function login(app: Parameters<typeof call>[0], level: "control" | "technician", pin: string, remoteAddress: string) {
  const cookie = cookieOf(await call(app, "GET", "/api/session", { remoteAddress }));
  const response = await call(app, "POST", "/api/session/login", { cookie, remoteAddress, payload: { level, pin, label: "phone" } });
  return { cookie, status: response.statusCode };
}

describe("PIN changes (S3d)", () => {
  it("room PIN: the old PIN fails, the new one works, other control sessions are locked and told", async () => {
    const { app } = await startApp();
    const tech = await sessionAt(app, "technician", TECH_IP);
    const phone = await sessionAt(app, "control", OTHER_IP);
    const phoneSocket = await openSocket(app, { cookie: phone });
    await phoneSocket.next("snapshot");
    const changed = await call(app, "PUT", "/api/settings/pins/room", { cookie: tech, remoteAddress: TECH_IP, payload: { pin: "4321" } });
    expect([changed.statusCode, changed.body]).toEqual([204, ""]);
    await expect.poll(() => phoneSocket.frames.filter((f) => f.type === "session").at(-1)).toMatchObject({ session: { access: "view" } });
    expect((await call(app, "GET", "/api/session", { cookie: phone, remoteAddress: OTHER_IP })).json()).toMatchObject({ access: "view" });
    expect((await login(app, "control", "1234", "192.168.1.72")).status).toBe(401);
    expect((await login(app, "control", "4321", "192.168.1.73")).status).toBe(200);
    expect((await call(app, "GET", "/api/session", { cookie: tech, remoteAddress: TECH_IP })).json()).toMatchObject({ access: "technician" });
    phoneSocket.ws.terminate();
    await app.close();
  });

  it("technician PIN: other technician sessions end, the one that changed it stays", async () => {
    const { app } = await startApp();
    const me = await sessionAt(app, "technician", TECH_IP);
    const other = await sessionAt(app, "technician", OTHER_IP);
    expect((await call(app, "PUT", "/api/settings/pins/technician", { cookie: me, remoteAddress: TECH_IP, payload: { pin: "654321" } })).statusCode).toBe(204);
    expect((await call(app, "GET", "/api/session", { cookie: other, remoteAddress: OTHER_IP })).json()).toMatchObject({ access: "view" });
    expect((await call(app, "GET", "/api/session", { cookie: me, remoteAddress: TECH_IP })).json()).toMatchObject({ access: "technician" });
    expect((await login(app, "technician", "123456", "192.168.1.74")).status).toBe(401);
    expect((await login(app, "technician", "654321", "192.168.1.75")).status).toBe(200);
    await app.close();
  });

  it("refuses the wrong length and never logs the PIN", async () => {
    const { app } = await startApp();
    const tech = await sessionAt(app, "technician");
    const bad = await call(app, "PUT", "/api/settings/pins/room", { cookie: tech, payload: { pin: "12345" } });
    expect([bad.statusCode, bad.json()]).toEqual([400, { code: "validation", message: "pin: Room PIN is 4 digits" }]);
    await call(app, "PUT", "/api/settings/pins/room", { cookie: tech, payload: { pin: "4321" } });
    const rows = app.room.db.select().from(eventLog).all();
    expect(JSON.stringify(rows)).not.toContain("4321");
    await app.close();
  });
});
```

**Test:** `test/routes/settings.test.ts` — AC7 (old PIN 401, new 200, other control session locked + pushed, technician kept); technician PIN; wrong length 400 "pin: Room PIN is 4 digits"; PIN not in `event_log`. 2 rows added to `access.test.ts`.

**Verify:** `pnpm --filter @eduscope/core-api test` → `292 passed`. `pnpm verify` green.

**Commit:** `git add -A && git commit -m "feat(core-api): room and technician PIN changes"` (with the ticked box in this plan)


### T19 — Network rules for S3b (pure)
- [ ] done

**Files:** `apps/core-api/src/domain/network.ts`, `apps/core-api/test/domain/network.test.ts`

**Context:** SPEC S3b rows Hostname / Address / Connection. Address = first external IPv4, wired (`eth*`, `en*`) before Wi-Fi (`wl*`) before others; `docker*`, `br-*`, `veth*`, `virbr*`, `tun*`, `tap*`, `lo*` skipped. Hostname = `<os hostname>.local` (avahi, ARCHITECTURE §9) `[ASSUMED]`. Wi-Fi from `nmcli -t -f ACTIVE,SSID,SIGNAL dev wifi` (escaped `\:` in SSIDs). Kiosk renders "Wi-Fi · {ssid} · {signal}%" (`features/settings/network/network.view.ts`), so an unknown SSID is the text "unknown network", never an empty string.

**Do:**

1. Create `apps/core-api/src/domain/network.ts`:
```ts
import type { NetworkConnection } from "@eduscope/contracts";

// S3b Network, the parts that are pure: which interface is "the" address, the mDNS name, and
// what `nmcli` says about Wi-Fi. Probing the OS lives in system/info.ts.

/** The shape of one entry of `os.networkInterfaces()` that matters here. */
export interface InterfaceAddress {
  address: string;
  family: string;
  internal: boolean;
}

export interface WifiInfo {
  ssid: string;
  signal_pct: number | null;
}

const WIRED = /^(eth|en)/;
const WIRELESS = /^(wl|wlan)/;
const VIRTUAL = /^(docker|br-|veth|virbr|tun|tap|lo)/;

/** S3b "Address": the first external IPv4, wired before Wi-Fi before anything else (virtual bridges skipped). */
export function primaryInterface(interfaces: Readonly<Record<string, readonly InterfaceAddress[] | undefined>>): { name: string; address: string } | null {
  const candidates = Object.entries(interfaces).flatMap(([name, addresses]) =>
    VIRTUAL.test(name) ? [] : (addresses ?? []).filter((a) => a.family === "IPv4" && !a.internal).map((a) => ({ name, address: a.address })),
  );
  const rank = (name: string): number => (WIRED.test(name) ? 0 : WIRELESS.test(name) ? 1 : 2);
  return [...candidates].sort((a, b) => rank(a.name) - rank(b.name))[0] ?? null;
}

/** avahi publishes `<hostname>.local` (ARCHITECTURE §9) [ASSUMED]; a dotted name is kept as it is. */
export function mdnsHostname(hostname: string): string {
  return hostname.includes(".") ? hostname : `${hostname}.local`;
}

/**
 * The active network from `nmcli -t -f ACTIVE,SSID,SIGNAL dev wifi` ("yes:R101-Staff:72"; nmcli escapes
 * ":" in an SSID as "\:"). Null when no line is active.
 */
export function parseNmcliWifi(stdout: string): WifiInfo | null {
  for (const line of stdout.split("\n")) {
    const match = /^yes:(.*):(\d*)$/.exec(line.trim());
    if (match === null) continue;
    const ssid = (match[1] ?? "").replace(/\\(.)/g, "$1");
    const signal = match[2] === undefined || match[2] === "" ? null : Math.min(100, Number(match[2]));
    return { ssid, signal_pct: signal };
  }
  return null;
}

/** Shown as the SSID when nmcli is missing or the network hides its name ("Wi-Fi · unknown network"). */
export const UNKNOWN_SSID = "unknown network";

/** S3b "Connection": Ethernet, Wi-Fi with SSID/signal when nmcli knows them, or none. */
export function connectionOf(primary: { name: string } | null, wifi: WifiInfo | null): NetworkConnection {
  if (primary === null) return { kind: "none" };
  if (!WIRELESS.test(primary.name)) return { kind: "ethernet" };
  return { kind: "wifi", ssid: wifi === null || wifi.ssid === "" ? UNKNOWN_SSID : wifi.ssid, signal_pct: wifi?.signal_pct ?? null };
}
```

2. Create `apps/core-api/test/domain/network.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { connectionOf, mdnsHostname, parseNmcliWifi, primaryInterface } from "../../src/domain/network.ts";

const v4 = (address: string, internal = false) => ({ address, family: "IPv4", internal });
const v6 = (address: string) => ({ address, family: "IPv6", internal: false });

describe("S3b network", () => {
  it("picks the first external IPv4, wired before Wi-Fi, skipping loopback and bridges", () => {
    expect(primaryInterface({ lo: [v4("127.0.0.1", true)], wlan0: [v6("fe80::1"), v4("192.168.1.40")], eth0: [v4("10.0.0.5")] })).toEqual({
      name: "eth0", address: "10.0.0.5",
    });
    expect(primaryInterface({ docker0: [v4("172.17.0.1")], wlp3s0: [v4("192.168.1.41")] })).toEqual({ name: "wlp3s0", address: "192.168.1.41" });
    expect(primaryInterface({ lo: [v4("127.0.0.1", true)], eth0: undefined })).toBeNull();
  });

  it("names the host for mDNS", () => {
    expect(mdnsHostname("r-101")).toBe("r-101.local");
    expect(mdnsHostname("r-101.local")).toBe("r-101.local");
  });

  it("reads the active Wi-Fi from nmcli terse output", () => {
    expect(parseNmcliWifi("no:Guest:40\nyes:R101\\:Staff:72\n")).toEqual({ ssid: "R101:Staff", signal_pct: 72 });
    expect(parseNmcliWifi("yes::\n")).toEqual({ ssid: "", signal_pct: null });
    expect(parseNmcliWifi("no:Guest:40\n")).toBeNull();
    expect(parseNmcliWifi("")).toBeNull();
  });

  it("describes the connection", () => {
    expect(connectionOf({ name: "eth0" }, null)).toEqual({ kind: "ethernet" });
    expect(connectionOf({ name: "wlan0" }, { ssid: "R101-Staff", signal_pct: 72 })).toEqual({ kind: "wifi", ssid: "R101-Staff", signal_pct: 72 });
    expect(connectionOf({ name: "wlan0" }, null)).toEqual({ kind: "wifi", ssid: "unknown network", signal_pct: null });
    expect(connectionOf({ name: "wlan0" }, { ssid: "", signal_pct: 50 })).toEqual({ kind: "wifi", ssid: "unknown network", signal_pct: 50 });
    expect(connectionOf(null, null)).toEqual({ kind: "none" });
  });
});
```

**Test:** `test/domain/network.test.ts` — interface choice, mDNS name, nmcli parsing, connection kinds.

**Verify:** `pnpm --filter @eduscope/core-api test` → `296 passed`. `pnpm verify` green.

**Commit:** `git add -A && git commit -m "feat(core-api): network rules for S3b"` (with the ticked box in this plan)


### T20 — System probe: OS facts for network and about
- [ ] done

**Files:** `apps/core-api/src/paths.ts`, `apps/core-api/src/system/info.ts`, `apps/core-api/test/system/info.test.ts`

**Context:** M09 scope: "IPs from `os.networkInterfaces`, Wi-Fi SSID/signal via `nmcli` when available … version from package.json, uptime, Pi model from `/proc/device-tree/model` or \"unknown\"". Every probe is a fixed command/path and fails soft. `PACKAGE_JSON` joins `src/paths.ts` (works from `src/` and the bundled `dist/main.js`, like `MIGRATIONS_DIR`). nmcli runs only when the primary interface is wireless (2 s timeout). The About URL comes from `ROOM_HOSTNAME`, never from the request.

**Do:**

1. Replace the whole file `apps/core-api/src/paths.ts`:
```ts
import { fileURLToPath } from "node:url";

// Lives directly in src/ so the same relative URL works from src/*.ts (tsx, vitest) and from the
// bundled dist/main.js: both sit one level below apps/core-api/.
export const MIGRATIONS_DIR = fileURLToPath(new URL("../drizzle/", import.meta.url));
/** core-api's own package.json: S3e "Software version". */
export const PACKAGE_JSON = fileURLToPath(new URL("../package.json", import.meta.url));
```

2. Create `apps/core-api/src/system/info.ts`:
```ts
import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import { hostname, networkInterfaces } from "node:os";
import type { AboutInfo, ConnectedClient, NetworkInfo } from "@eduscope/contracts";
import { z } from "zod";
import { connectionOf, mdnsHostname, parseNmcliWifi, primaryInterface, type InterfaceAddress, type WifiInfo } from "../domain/network.ts";
import { PACKAGE_JSON } from "../paths.ts";

// S3b / S3e facts from the OS. Every probe is fixed (no user input reaches a command line) and
// fails soft: a missing nmcli or device-tree file gives "unknown", never an error.

export const PI_MODEL_PATH = "/proc/device-tree/model";
const NMCLI_TIMEOUT_MS = 2000;

export interface SystemProbe {
  hostname(): string;
  interfaces(): Record<string, readonly InterfaceAddress[] | undefined>;
  /** Active Wi-Fi from nmcli, or null (no nmcli, not on Wi-Fi). */
  wifi(): Promise<WifiInfo | null>;
  /** "Raspberry Pi 5 Model B Rev 1.0", or "unknown" off a Pi. */
  piModel(): string;
  version(): string;
}

/** The device-tree model string without its trailing NUL, or "unknown". */
export function readPiModel(path: string = PI_MODEL_PATH): string {
  try {
    const model = readFileSync(path, "utf8").replace(/\0/g, "").trim();
    return model === "" ? "unknown" : model;
  } catch {
    return "unknown";
  }
}

/** `version` from a package.json, or "unknown". */
export function readVersion(path: string = PACKAGE_JSON): string {
  try {
    const raw: unknown = JSON.parse(readFileSync(path, "utf8"));
    return z.object({ version: z.string() }).parse(raw).version;
  } catch {
    return "unknown";
  }
}

function nmcliWifi(): Promise<WifiInfo | null> {
  return new Promise((resolve) => {
    execFile("nmcli", ["-t", "-f", "ACTIVE,SSID,SIGNAL", "dev", "wifi"], { timeout: NMCLI_TIMEOUT_MS }, (error, stdout) => {
      resolve(error === null ? parseNmcliWifi(stdout) : null);
    });
  });
}

export const systemProbe: SystemProbe = {
  hostname: () => hostname(),
  interfaces: () => networkInterfaces(),
  wifi: nmcliWifi,
  piModel: () => readPiModel(),
  version: () => readVersion(),
};

/** S3b. nmcli is asked only when the primary interface is wireless. */
export async function networkInfo(probe: SystemProbe, hw: "up" | "down", clients: ConnectedClient[]): Promise<NetworkInfo> {
  const primary = primaryInterface(probe.interfaces());
  const wireless = primary !== null && connectionOf(primary, null).kind === "wifi";
  return {
    hostname: mdnsHostname(probe.hostname()),
    address: primary?.address ?? null,
    connection: connectionOf(primary, wireless ? await probe.wifi() : null),
    controller: { hw },
    clients,
  };
}

/** S3e. The URL (and QR) always come from ROOM_HOSTNAME, never from the request (ARCHITECTURE §9). */
export function aboutInfo(probe: SystemProbe, room: { id: string; hostname: string; uptimeS: number }): AboutInfo {
  return { room: room.id, version: probe.version(), uptime_s: Math.max(0, Math.floor(room.uptimeS)), pi_model: probe.piModel(), url: `http://${room.hostname}` };
}
```

3. Create `apps/core-api/test/system/info.test.ts`:
```ts
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { aboutInfo, networkInfo, readPiModel, readVersion, type SystemProbe } from "../../src/system/info.ts";

function probe(overrides: Partial<SystemProbe> = {}): SystemProbe {
  return {
    hostname: () => "r-101",
    interfaces: () => ({ lo: [{ address: "127.0.0.1", family: "IPv4", internal: true }], eth0: [{ address: "192.168.1.20", family: "IPv4", internal: false }] }),
    wifi: vi.fn(async () => ({ ssid: "R101-Staff", signal_pct: 72 })),
    piModel: () => "Raspberry Pi 5 Model B Rev 1.0",
    version: () => "0.0.0",
    ...overrides,
  };
}

describe("system info", () => {
  it("S3b on Ethernet: hostname.local, address, controller, clients; nmcli not asked", async () => {
    const p = probe();
    const clients = [{ public_id: null, label: "room screen", client_type: "kiosk", access: "control" }] as const;
    expect(await networkInfo(p, "up", [...clients])).toEqual({
      hostname: "r-101.local", address: "192.168.1.20", connection: { kind: "ethernet" }, controller: { hw: "up" }, clients: [...clients],
    });
    expect(p.wifi).not.toHaveBeenCalled();
  });

  it("S3b on Wi-Fi asks nmcli", async () => {
    const p = probe({ interfaces: () => ({ wlan0: [{ address: "192.168.1.21", family: "IPv4", internal: false }] }) });
    expect((await networkInfo(p, "down", [])).connection).toEqual({ kind: "wifi", ssid: "R101-Staff", signal_pct: 72 });
  });

  it("S3e about: URL from the room hostname, whole seconds of uptime", () => {
    expect(aboutInfo(probe(), { id: "R-101", hostname: "r-101.local", uptimeS: 3725.9 })).toEqual({
      room: "R-101", version: "0.0.0", uptime_s: 3725, pi_model: "Raspberry Pi 5 Model B Rev 1.0", url: "http://r-101.local",
    });
  });

  it("reads the Pi model (NUL stripped) or 'unknown', and the package version", () => {
    const dir = mkdtempSync(join(tmpdir(), "eduscope-model-"));
    const model = join(dir, "model");
    writeFileSync(model, "Raspberry Pi 5 Model B Rev 1.0\0");
    expect(readPiModel(model)).toBe("Raspberry Pi 5 Model B Rev 1.0");
    expect(readPiModel(join(dir, "missing"))).toBe("unknown");
    expect(readVersion()).toBe("0.0.0");
    expect(readVersion(join(dir, "missing.json"))).toBe("unknown");
  });
});
```

**Test:** `test/system/info.test.ts` — Ethernet (nmcli not asked), Wi-Fi, about, Pi model file with NUL / missing, version.

**Verify:** `pnpm --filter @eduscope/core-api test` → `300 passed`. `pnpm verify` green.

**Commit:** `git add -A && git commit -m "feat(core-api): system probe for network and about"` (with the ticked box in this plan)


### T21 — Network, about and restart routes (S3b, S3e)
- [ ] done

**Files:** `apps/core-api/src/app.ts`, `apps/core-api/src/routes/system.ts`, `apps/core-api/src/system/restart.ts`, `apps/core-api/test/routes/access.test.ts`, `apps/core-api/test/routes/system.test.ts`, `apps/core-api/test/system/restart.test.ts`

**Context:** ARCHITECTURE §3.3 `api/system.ts`. `GET /api/system/network` → `NetworkInfo` (controller = `connection.hw`, clients = `hub.clients()`); `GET /api/system/about` → `AboutInfo` (uptime = seconds since `buildApp` by the injectable clock); `POST /api/system/restart` → 202, then `restart()` after 250 ms so the answer reaches the browser first. `system/restart.ts` turns `RESTART_COMMAND` into argv (split on spaces, `spawn` without a shell, detached, spawn errors reported not thrown); unset → the `exit` callback. `AppDeps` gains optional `restart` (default no-op: tests never exit) and `system` (default real probe).

**Do:**

1. Patch `apps/core-api/src/app.ts` (184 lines, so only the change is shown). Run from the repo root; it must print nothing:
```sh
git apply --whitespace=nowarn <<'PATCH'
diff --git a/apps/core-api/src/app.ts b/apps/core-api/src/app.ts
index 85b509b..1301adf 100644
--- a/apps/core-api/src/app.ts
+++ b/apps/core-api/src/app.ts
@@ -25,6 +25,7 @@ import { originCheckPlugin } from "./plugins/origin-check.ts";
 import { createHub, PING_MS, realtimePlugin, type Hub } from "./plugins/realtime.ts";
 import { staticPlugin } from "./plugins/static.ts";
 import { createRegistrySync } from "./registry-sync.ts";
+import { systemProbe, type SystemProbe } from "./system/info.ts";
 import { commandRoutes } from "./routes/commands.ts";
 import { deviceRoutes } from "./routes/devices.ts";
 import { healthRoutes } from "./routes/health.ts";
@@ -32,6 +33,7 @@ import { irRoutes } from "./routes/ir.ts";
 import { scheduleRoutes } from "./routes/schedule.ts";
 import { sessionRoutes } from "./routes/session.ts";
 import { settingsRoutes } from "./routes/settings.ts";
+import { systemRoutes } from "./routes/system.ts";
 import { stateRoutes } from "./routes/state.ts";
 
 // ARCHITECTURE §6.1: buildApp(deps) is used by main.ts and by tests (fastify.inject / injectWS).
@@ -45,6 +47,10 @@ export interface AppDeps {
   clock: Clock;
   config: Config;
   logger?: FastifyServerOptions["logger"];
+  /** S3e "Restart controller" (main.ts: system/restart.ts). Default: nothing happens (tests). */
+  restart?: () => void;
+  /** S3b/S3e OS facts. Default: the real probe. */
+  system?: SystemProbe;
 }
 
 /** What tests and main.ts reach into. */
@@ -84,6 +90,7 @@ const KwhBaselineSchema = z.object({ date: z.string(), kwh_total: z.number() });
 
 export async function buildApp(deps: AppDeps): Promise<FastifyInstance> {
   const { config, clock } = deps;
+  const bootedAt = clock.now();
   const { db, close: closeDb } = openDb(deps.db);
   await seed(db, config, clock.now().toISOString());
 
@@ -153,6 +160,9 @@ export async function buildApp(deps: AppDeps): Promise<FastifyInstance> {
       await api.register(scheduleRoutes, { db, emit: (event) => hub.broadcast(event) });
       await api.register(deviceRoutes, { db, store, hw: deps.hw, sync, emit: (event) => hub.broadcast(event) });
       await api.register(settingsRoutes, { db, sessions, clock, log });
+      await api.register(systemRoutes, {
+        store, hub, probe: deps.system ?? systemProbe, config, clock, bootedAt, restart: deps.restart ?? (() => undefined), log,
+      });
     },
     { prefix: "/api" },
   );
PATCH
```

2. Create `apps/core-api/src/routes/system.ts`:
```ts
import type { FastifyInstance } from "fastify";
import type { Clock } from "../clock.ts";
import type { Config } from "../config.ts";
import type { EventLogger } from "../db/event-log.ts";
import type { StateStore } from "../domain/state-store.ts";
import type { Hub } from "../plugins/realtime.ts";
import { aboutInfo, networkInfo, type SystemProbe } from "../system/info.ts";

// ARCHITECTURE §3.3 api/system.ts — S3b Network, S3e About and Restart. Technician only.

const TECHNICIAN = { access: "technician" } as const;
/** The 202 reaches the browser before the controller goes away (H3 → H4 on the clients). */
export const RESTART_DELAY_MS = 250;

export async function systemRoutes(
  app: FastifyInstance,
  options: { store: StateStore; hub: Hub; probe: SystemProbe; config: Config; clock: Clock; bootedAt: Date; restart: () => void; log: EventLogger },
) {
  const { store, hub, probe, config, clock } = options;

  app.get("/system/network", { config: TECHNICIAN }, async () => networkInfo(probe, store.get().connection.hw, hub.clients()));

  app.get("/system/about", { config: TECHNICIAN }, async () =>
    aboutInfo(probe, { id: config.ROOM_ID, hostname: config.ROOM_HOSTNAME, uptimeS: (clock.now().getTime() - options.bootedAt.getTime()) / 1000 }),
  );

  app.post("/system/restart", { config: TECHNICIAN }, async (request, reply) => {
    options.log({ type: "system", actor: request.client.label, public_id: request.client.row?.public_id ?? null, subject: "restart" });
    setTimeout(options.restart, RESTART_DELAY_MS);
    return reply.status(202).send();
  });
}
```

3. Create `apps/core-api/src/system/restart.ts`:
```ts
import { spawn } from "node:child_process";

// S3e "Restart controller". RESTART_COMMAND is configuration (M10 sets
// `sudo systemctl restart eduscope.target`): split on spaces, run without a shell, detached so it
// outlives core-api. Nothing from a request ever reaches it. Unset: core-api exits.

export type Spawn = (file: string, args: readonly string[], onError: (error: Error) => void) => void;

const spawnDetached: Spawn = (file, args, onError) => {
  const child = spawn(file, [...args], { detached: true, stdio: "ignore" });
  child.on("error", onError);
  child.unref();
};

export function createRestart(options: {
  command: string | undefined;
  exit: () => void;
  onError: (error: Error) => void;
  spawn?: Spawn;
}): () => void {
  const [file, ...args] = options.command?.trim().split(/\s+/) ?? [];
  if (file === undefined || file === "") return options.exit;
  const run = options.spawn ?? spawnDetached;
  return () => run(file, args, options.onError);
}
```

4. Replace the whole file `apps/core-api/test/routes/access.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { call, sessionAt, startApp, type Method } from "./app-helpers.ts";

// AC10/AC11: every M09 route, GETs included, is technician-only. Bodies are valid so the guard,
// not validation, decides; ids are unknown so a passing guard never changes anything.

const ROUTES: readonly [Method, string, unknown?][] = [
  ["GET", "/api/ir/devices"],
  ["POST", "/api/ir/devices", { name: "Fan", brand: "Acme", kind: "other", transport: "ir_mcu" }],
  ["PATCH", "/api/ir/devices/nope", { name: "Fan" }],
  ["POST", "/api/ir/devices/nope/commands", { name: "On", role: "other", setpoint: null }],
  ["DELETE", "/api/ir/commands/nope"],
  ["POST", "/api/ir/commands/nope/learn", {}],
  ["POST", "/api/ir/commands/nope/learn/cancel", {}],
  ["POST", "/api/ir/commands/nope/test", {}],
  ["POST", "/api/ir/commands/nope/test-result", { reacted: true }],
  ["GET", "/api/schedule"],
  ["POST", "/api/schedule/blocks", { days: ["mon"], start: "08:00", end: "10:00" }],
  ["PUT", "/api/schedule/blocks/nope", { days: ["mon"], start: "08:00", end: "10:00" }],
  ["DELETE", "/api/schedule/blocks/nope"],
  ["POST", "/api/schedule/actions", { name: "All off", time: "18:00", days: ["fri"], enabled: true, steps: [{ kind: "ac.power", on: false }] }],
  ["PUT", "/api/schedule/actions/nope", { name: "All off", time: "18:00", days: ["fri"], enabled: true, steps: [{ kind: "ac.power", on: false }] }],
  ["DELETE", "/api/schedule/actions/nope"],
  ["GET", "/api/devices"],
  ["PATCH", "/api/devices/nope", { name: "x" }],
  ["DELETE", "/api/devices/nope"],
  ["POST", "/api/zigbee/permit-join", { seconds: 240 }],
  ["PUT", "/api/settings/pins/room", { pin: "4321" }],
  ["PUT", "/api/settings/pins/technician", { pin: "654321" }],
  ["GET", "/api/system/network"],
  ["GET", "/api/system/about"],
  ["POST", "/api/system/restart", {}],
];

describe("M09 routes need technician", () => {
  it.each(ROUTES)("%s %s: no session 401, control 403, technician passes the guard", async (method, url, payload) => {
    const { app } = await startApp();
    expect((await call(app, method, url, { payload })).json()).toEqual({ code: "unauthorized", message: "Enter the room PIN" });
    const view = await sessionAt(app, "view");
    expect((await call(app, method, url, { payload, cookie: view })).statusCode).toBe(401);
    const control = await sessionAt(app, "control", "192.168.1.51");
    const refused = await call(app, method, url, { payload, cookie: control, remoteAddress: "192.168.1.51" });
    expect([refused.statusCode, refused.json()]).toEqual([403, { code: "forbidden", message: "Technician PIN required" }]);
    const tech = await sessionAt(app, "technician", "192.168.1.52");
    const passed = await call(app, method, url, { payload, cookie: tech, remoteAddress: "192.168.1.52" });
    expect([401, 403]).not.toContain(passed.statusCode);
    await app.close();
  });
});
```

5. Create `apps/core-api/test/routes/system.test.ts`:
```ts
import { describe, expect, it, vi } from "vitest";
import { buildApp } from "../../src/app.ts";
import { fixedClock } from "../../src/clock.ts";
import type { SystemProbe } from "../../src/system/info.ts";
import { fakeHw, snapshotEvent, T0, testConfig } from "../helpers.ts";
import { call, openSocket, sessionAt } from "./app-helpers.ts";

const PROBE: SystemProbe = {
  hostname: () => "r-101",
  interfaces: () => ({ eth0: [{ address: "192.168.1.20", family: "IPv4", internal: false }] }),
  wifi: async () => null,
  piModel: () => "Raspberry Pi 5 Model B Rev 1.0",
  version: () => "0.0.0",
};

async function start() {
  const clock = fixedClock(T0);
  const restart = vi.fn();
  const app = await buildApp({ db: ":memory:", hw: fakeHw(), clock, config: testConfig(), restart, system: PROBE });
  await app.ready();
  app.room.ingest.handle(snapshotEvent());
  return { app, clock, restart, cookie: await sessionAt(app, "technician") };
}

describe("system routes (S3b, S3e)", () => {
  it("network: hostname, address, connection, controller and the connected clients", async () => {
    const { app, cookie } = await start();
    const socket = await openSocket(app, { cookie });
    await socket.next("snapshot");
    expect((await call(app, "GET", "/api/system/network", { cookie })).json()).toEqual({
      hostname: "r-101.local", address: "192.168.1.20", connection: { kind: "ethernet" }, controller: { hw: "up" },
      clients: [{ public_id: expect.any(String), label: "phone", client_type: "remote", access: "technician" }],
    });
    socket.ws.terminate();
    await app.close();
  });

  it("about: room, version, uptime since boot, Pi model, URL from ROOM_HOSTNAME", async () => {
    const { app, clock } = await start();
    clock.advance(3_725_000);
    const cookie = await sessionAt(app, "technician", "192.168.1.60"); // the first one idled out meanwhile
    expect((await call(app, "GET", "/api/system/about", { cookie, remoteAddress: "192.168.1.60" })).json()).toEqual({
      room: "R-101", version: "0.0.0", uptime_s: 3725, pi_model: "Raspberry Pi 5 Model B Rev 1.0", url: "http://r-101.local",
    });
    await app.close();
  });

  it("restart answers 202 first, then restarts", async () => {
    const { app, restart, cookie } = await start();
    const response = await call(app, "POST", "/api/system/restart", { cookie });
    expect(response.statusCode).toBe(202);
    expect(restart).not.toHaveBeenCalled();
    await expect.poll(() => restart.mock.calls.length).toBe(1);
    await app.close();
  });
});
```

6. Create `apps/core-api/test/system/restart.test.ts`:
```ts
import { describe, expect, it, vi } from "vitest";
import { createRestart } from "../../src/system/restart.ts";

describe("restart controller (S3e)", () => {
  it("runs RESTART_COMMAND as argv, without a shell", () => {
    const spawn = vi.fn();
    const exit = vi.fn();
    createRestart({ command: " sudo  systemctl restart eduscope.target", exit, onError: vi.fn(), spawn })();
    expect(spawn).toHaveBeenCalledWith("sudo", ["systemctl", "restart", "eduscope.target"], expect.any(Function));
    expect(exit).not.toHaveBeenCalled();
  });

  it("exits when no command is configured", () => {
    const exit = vi.fn();
    createRestart({ command: undefined, exit, onError: vi.fn() })();
    expect(exit).toHaveBeenCalledOnce();
  });

  it("reports a command that cannot start instead of crashing", async () => {
    const onError = vi.fn();
    createRestart({ command: "/nonexistent/eduscope-restart", exit: vi.fn(), onError })();
    await expect.poll(() => onError.mock.calls.length).toBe(1);
  });
});
```

**Test:** `test/system/restart.test.ts` (argv without shell; exit when unset; a missing binary reports); `test/routes/system.test.ts` (network with the client list; about uptime 3725 s; restart 202 then called). 3 rows added to `access.test.ts`.

**Verify:** `pnpm --filter @eduscope/core-api test` → `309 passed`. `pnpm verify` green.

**Commit:** `git add -A && git commit -m "feat(core-api): network, about and restart routes (S3b, S3e)"` (with the ticked box in this plan)


### T22 — `main.ts` restarts the controller; dev restarts through `tsx watch`
- [ ] done

**Files:** `apps/core-api/package.json`, `apps/core-api/src/main.ts`

**Context:** Production: M10 sets `RESTART_COMMAND=sudo systemctl restart eduscope.target`. Unset: close the stream and the app, exit 0. **Dev:** `tsx watch` does NOT restart a process that exits (checked: it waits for a file change), so the milestone's "`process.exit(0)` under the dev runner" would leave core-api down. The dev script therefore sets `RESTART_COMMAND='touch src/main.ts'`: the touch makes `tsx watch` restart core-api (checked: "[tsx] change in ./src/main.ts Restarting...", back in ~1 s). This is configuration, not code.

**Do:**

1. Replace the whole file `apps/core-api/package.json`:
```json
{
  "name": "@eduscope/core-api",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "PORT=3000 HOST=0.0.0.0 DB_PATH=./data/dev.db HW_URL=http://127.0.0.1:8081 COOKIE_SECRET=dev-only-cookie-secret-never-used-on-the-pi LOCALHOST_IS_KIOSK=false INITIAL_ROOM_PIN=1234 INITIAL_TECH_PIN=123456 SEED_FAKE_IR_CODES=true RESTART_COMMAND='touch src/main.ts' tsx watch src/main.ts",
    "build": "tsx scripts/build.ts",
    "start": "node dist/main.js",
    "typecheck": "tsc -p tsconfig.json",
    "test": "vitest run",
    "db:generate": "drizzle-kit generate"
  },
  "dependencies": {
    "@eduscope/contracts": "workspace:*",
    "@fastify/cookie": "^11.1.3",
    "@fastify/static": "^10.1.6",
    "@fastify/websocket": "^11.3.4",
    "better-sqlite3": "^13.0.3",
    "drizzle-orm": "^0.45.4",
    "eventsource-parser": "^4.1.2",
    "fastify": "^5.12.5",
    "fastify-plugin": "^6.0.1",
    "fastify-type-provider-zod": "^7.0.0",
    "zod": "^4.6.5"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^9.6.0",
    "@types/node": "^22.20.5",
    "@types/ws": "^8.18.2",
    "drizzle-kit": "^0.31.11",
    "esbuild": "^0.28.2",
    "tsx": "^4.23.15",
    "typescript": "~6.0.3",
    "vitest": "^5.0.3"
  }
}
```

2. Replace the whole file `apps/core-api/src/main.ts`:
```ts
import { buildApp, hwTimeouts } from "./app.ts";
import { systemClock } from "./clock.ts";
import { loadConfig } from "./config.ts";
import { createHwClient } from "./hw/client.ts";
import { startHwStream } from "./hw/stream.ts";
import { createRestart } from "./system/restart.ts";

// ARCHITECTURE §6.1 boot: config → db migrate/seed (inside buildApp) → store → listen → hw stream.

const config = loadConfig();
/** Closes everything and exits; replaced once the stream runs. */
let shutdown = (): void => process.exit(0);
const app = await buildApp({
  db: config.DB_PATH,
  hw: createHwClient({ baseUrl: config.HW_URL, timeouts: hwTimeouts(config) }),
  clock: systemClock,
  config,
  logger: { level: "info" },
  // S3e: RESTART_COMMAND when set (systemd on the Pi, `touch src/main.ts` under `tsx watch` in dev), else exit.
  restart: createRestart({
    command: config.RESTART_COMMAND,
    exit: () => shutdown(),
    onError: (error) => app.log.error({ err: error }, "RESTART_COMMAND failed"),
  }),
});
await app.listen({ port: config.PORT, host: config.HOST });

const { ingest } = app.room;
const stream = startHwStream({
  url: `${config.HW_URL}/v1/events`,
  deadMs: config.HW_STREAM_DEAD_MS,
  onEvent: (event) => ingest.handle(event),
  onDown: () => ingest.down(),
  onInvalid: (reason) => app.log.warn({ reason }, "hw event dropped"),
});

shutdown = () => {
  stream.stop();
  void app.close().then(() => process.exit(0));
};
for (const signal of ["SIGINT", "SIGTERM"] as const) process.once(signal, () => shutdown());
```

No new test: `main.ts` is wiring (restart logic is tested in T20).

**Verify:** `pnpm --filter @eduscope/core-api typecheck` and `pnpm --filter @eduscope/core-api build` ("built dist/main.js"); `pnpm verify` green (`309 passed`). Manual: `pnpm dev`, then with a technician cookie `curl -XPOST localhost:3000/api/system/restart …` → 202, the core-api log shows `[tsx] change in ./src/main.ts Restarting...` and `/api/health` answers again within ~2 s.

**Commit:** `git add -A && git commit -m "feat(core-api): restart the controller from main"` (with the ticked box in this plan)


### T23 — Scheduler due-calculation (days, minute boundary, midnight)
- [ ] done

**Files:** `apps/core-api/src/domain/schedule.ts`, `apps/core-api/test/domain/schedule.test.ts`

**Context:** ARCHITECTURE §6.8, S3c. Pure. A tick covers (last tick, now]; an action is due when a local moment `HH:MM:00` on one of its days falls in that window, so the 30 s tick fires each action exactly once per minute and 00:00 belongs to the new day. Catch-up after a long gap (suspend, clock jump) is capped at 5 min (`MAX_CATCH_UP_MS`). Class blocks use the same rule with their `end`. Local time = process time zone (the Pi's); tests run with `TZ=UTC`.

**Do:**

1. Create `apps/core-api/src/domain/schedule.ts`:
```ts
import type { ClassBlock, TimedAction, Weekday } from "@eduscope/contracts";

// S3c / ARCHITECTURE §6.8: which timed actions are due and which class blocks ended between two
// scheduler ticks. Times are local wall-clock "HH:MM" in the process time zone (the Pi's). Pure.

/** A tick never replays more than this (a suspended laptop, a clock jump): older moments are skipped. */
export const MAX_CATCH_UP_MS = 5 * 60_000;

const WEEKDAYS: readonly Weekday[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

export function weekdayOf(at: Date): Weekday {
  return WEEKDAYS[at.getDay()] ?? "sun";
}

/** Local midnight of the day `at` falls on. */
function startOfDay(at: Date): Date {
  return new Date(at.getFullYear(), at.getMonth(), at.getDate());
}

/** Every local moment "HH:MM:00" on one of `days` with from < moment ≤ to. */
export function occurrences(days: readonly Weekday[], time: string, from: Date, to: Date): Date[] {
  const [hours = 0, minutes = 0] = time.split(":").map(Number);
  const found: Date[] = [];
  for (let day = startOfDay(from); day.getTime() <= to.getTime(); day = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1)) {
    const moment = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hours, minutes);
    if (days.includes(weekdayOf(moment)) && moment.getTime() > from.getTime() && moment.getTime() <= to.getTime()) found.push(moment);
  }
  return found;
}

/** The window a tick covers: since the last tick, at most MAX_CATCH_UP_MS back. */
export function tickWindow(lastTick: Date, now: Date): { from: Date; to: Date } {
  return { from: new Date(Math.max(lastTick.getTime(), now.getTime() - MAX_CATCH_UP_MS)), to: now };
}

/** Enabled actions whose time passed in (from, to] on one of their days. */
export function dueActions(actions: readonly TimedAction[], from: Date, to: Date): TimedAction[] {
  return actions.filter((action) => action.enabled && occurrences(action.days, action.time, from, to).length > 0);
}

/** Blocks whose end passed in (from, to] on one of their days (§2.3: control sessions end then). */
export function endedBlocks(blocks: readonly ClassBlock[], from: Date, to: Date): ClassBlock[] {
  return blocks.filter((block) => occurrences(block.days, block.end, from, to).length > 0);
}
```

2. Create `apps/core-api/test/domain/schedule.test.ts`:
```ts
import type { ClassBlock, TimedAction } from "@eduscope/contracts";
import { describe, expect, it } from "vitest";
import { dueActions, endedBlocks, occurrences, tickWindow, weekdayOf } from "../../src/domain/schedule.ts";

// vitest.config.ts runs with TZ=UTC, so local time = the ISO strings below. 2026-10-05 is a Monday.

const at = (iso: string): Date => new Date(iso);
const action = (time: string, days: TimedAction["days"], enabled = true): TimedAction => ({
  id: `${time}-${days.join("")}`, name: "Lights off", time, days, enabled, steps: [{ kind: "lights.set", gang: "rear", on: false }],
});
const block = (end: string, days: ClassBlock["days"]): ClassBlock => ({ id: end, days, start: "00:00", end });

describe("scheduler due-calculation", () => {
  it("knows the weekday", () => {
    expect(weekdayOf(at("2026-10-05T10:42:00Z"))).toBe("mon");
    expect(weekdayOf(at("2026-10-11T23:59:59Z"))).toBe("sun");
  });

  it("minute boundary: due once, in the tick that crosses HH:MM:00", () => {
    const actions = [action("18:00", ["mon"])];
    expect(dueActions(actions, at("2026-10-05T17:59:30Z"), at("2026-10-05T18:00:00Z"))).toEqual(actions);
    expect(dueActions(actions, at("2026-10-05T18:00:00Z"), at("2026-10-05T18:00:30Z"))).toEqual([]); // not twice
    expect(dueActions(actions, at("2026-10-05T17:59:00Z"), at("2026-10-05T17:59:59Z"))).toEqual([]);
  });

  it("days: only on the listed weekdays", () => {
    const weekdays = action("18:00", ["mon", "tue", "wed", "thu", "fri"]);
    const sunday = action("18:00", ["sun"]);
    expect(dueActions([weekdays, sunday], at("2026-10-05T17:59:45Z"), at("2026-10-05T18:00:15Z"))).toEqual([weekdays]);
    expect(dueActions([weekdays, sunday], at("2026-10-11T17:59:45Z"), at("2026-10-11T18:00:15Z"))).toEqual([sunday]);
  });

  it("midnight: 00:00 belongs to the new day; 23:59 to the old one", () => {
    const tuesdayMidnight = action("00:00", ["tue"]);
    const mondayLate = action("23:59", ["mon"]);
    const from = at("2026-10-05T23:59:45Z");
    const to = at("2026-10-06T00:00:15Z");
    expect(dueActions([tuesdayMidnight, mondayLate], from, to)).toEqual([tuesdayMidnight]);
    expect(occurrences(["mon"], "23:59", at("2026-10-05T23:58:50Z"), at("2026-10-06T00:00:10Z"))).toEqual([at("2026-10-05T23:59:00Z")]);
  });

  it("a disabled action never runs", () => {
    expect(dueActions([action("18:00", ["mon"], false)], at("2026-10-05T17:59:30Z"), at("2026-10-05T18:00:00Z"))).toEqual([]);
  });

  it("a long gap catches up at most 5 minutes", () => {
    const window = tickWindow(at("2026-10-05T12:00:00Z"), at("2026-10-05T18:00:30Z"));
    expect(window).toEqual({ from: at("2026-10-05T17:55:30Z"), to: at("2026-10-05T18:00:30Z") });
    expect(dueActions([action("15:00", ["mon"])], window.from, window.to)).toEqual([]);
    expect(tickWindow(at("2026-10-05T18:00:00Z"), at("2026-10-05T18:00:30Z")).from).toEqual(at("2026-10-05T18:00:00Z"));
  });

  it("class-block end: due on its days at its end time", () => {
    const morning = block("10:00", ["mon", "wed"]);
    expect(endedBlocks([morning], at("2026-10-05T09:59:45Z"), at("2026-10-05T10:00:15Z"))).toEqual([morning]);
    expect(endedBlocks([morning], at("2026-10-06T09:59:45Z"), at("2026-10-06T10:00:15Z"))).toEqual([]);
  });
});
```

**Test:** `test/domain/schedule.test.ts` — weekday; minute boundary (once, not twice); days; midnight; disabled; 5-min catch-up; class-block end.

**Verify:** `pnpm --filter @eduscope/core-api test` → `316 passed`. `pnpm verify` green.

**Commit:** `git add -A && git commit -m "feat(core-api): schedule due-calculation"` (with the ticked box in this plan)


### T24 — Midnight kWh baseline and event-log pruning
- [ ] done

**Files:** `apps/core-api/src/db/event-log.ts`, `apps/core-api/src/domain/energy.ts`, `apps/core-api/test/db/event-log.test.ts`, `apps/core-api/test/domain/energy.test.ts`

**Context:** ARCHITECTURE §6.4 ("baseline … reset by the scheduler at local midnight") and §6.2 (`event_log` pruned to 30 days). `rollKwhBaseline` (pure): on a new local day the last meter total becomes the baseline and `power.kwh_today` reads 0 at once; same day or no total → the same model object. `pruneEventLog(db, now)` deletes rows older than 30 days.

**Do:**

1. Replace the whole file `apps/core-api/src/db/event-log.ts`:
```ts
import { lt } from "drizzle-orm";
import type { Clock } from "../clock.ts";
import type { Db } from "./client.ts";
import { eventLog } from "./schema.ts";

// ARCHITECTURE §6.2 `event_log`: commands, by-hand changes, sessions, PIN failures, hw up/down.
// Kept 30 days; the scheduler prunes older rows once a day.

export const EVENT_LOG_RETENTION_MS = 30 * 24 * 60 * 60_000;

export interface LogEntry {
  type: "command" | "state" | "session" | "pin_failure" | "hw" | "system";
  actor?: string | null;
  public_id?: string | null;
  subject?: string | null;
  payload?: unknown;
  result?: string | null;
}

export type EventLogger = (entry: LogEntry) => void;

export function createEventLogger(db: Db, clock: Clock): EventLogger {
  return (entry) => {
    db.insert(eventLog)
      .values({
        at: clock.now().toISOString(),
        type: entry.type,
        actor: entry.actor ?? null,
        public_id: entry.public_id ?? null,
        subject: entry.subject ?? null,
        payload: entry.payload === undefined ? null : JSON.stringify(entry.payload),
        result: entry.result ?? null,
      })
      .run();
  };
}

/** Deletes rows older than the retention; returns how many went. */
export function pruneEventLog(db: Db, now: Date): number {
  const cutoff = new Date(now.getTime() - EVENT_LOG_RETENTION_MS).toISOString();
  return db.delete(eventLog).where(lt(eventLog.at, cutoff)).run().changes;
}
```

2. Replace the whole file `apps/core-api/src/domain/energy.ts`:
```ts
import type { KwhBaseline, RoomModel } from "./model.ts";

// S2.E12 "TODAY": kWh since local midnight = meter total − the first total seen that local day.

/** Local calendar date "YYYY-MM-DD" in the process time zone (the Pi's). */
export function localDate(at: Date): string {
  const pad = (n: number): string => String(n).padStart(2, "0");
  return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`;
}

/** A new day (or no baseline yet) starts a new baseline at this total. Never negative (meter reset). */
export function kwhToday(baseline: KwhBaseline | null, totalKwh: number, date: string): { baseline: KwhBaseline; kwhToday: number } {
  const current = baseline !== null && baseline.date === date && baseline.kwh_total <= totalKwh ? baseline : { date, kwh_total: totalKwh };
  return { baseline: current, kwhToday: Math.round((totalKwh - current.kwh_total) * 1000) / 1000 };
}

/**
 * ARCHITECTURE §6.4/§6.8 midnight reset: on a new local day the last meter total becomes the
 * baseline and "TODAY" reads 0 at once, without waiting for the next reading. Unchanged otherwise.
 */
export function rollKwhBaseline(model: RoomModel, now: Date): RoomModel {
  const total = model.facts.energy_kwh_total;
  const date = localDate(now);
  if (total === null || model.facts.kwh_baseline?.date === date) return model;
  const { projector } = model.state.display;
  const power = projector.power.value === null ? projector.power : { ...projector.power, value: { ...projector.power.value, kwh_today: 0 } };
  return {
    ...model,
    state: { ...model.state, display: { ...model.state.display, projector: { ...projector, power } } },
    facts: { ...model.facts, kwh_baseline: { date, kwh_total: total } },
  };
}
```

3. Replace the whole file `apps/core-api/test/db/event-log.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { fixedClock } from "../../src/clock.ts";
import { openDb } from "../../src/db/client.ts";
import { createEventLogger, pruneEventLog } from "../../src/db/event-log.ts";
import { eventLog } from "../../src/db/schema.ts";
import { T0 } from "../helpers.ts";

describe("event log", () => {
  it("writes one row per entry, stamped with the clock, payload as JSON", () => {
    const { db } = openDb(":memory:");
    const log = createEventLogger(db, fixedClock(T0));
    log({ type: "command", actor: "phone", public_id: "p1", subject: "lights.set", payload: { gang: "rear" }, result: "confirmed" });
    log({ type: "hw", subject: "link", result: "down" });
    expect(db.select().from(eventLog).all()).toEqual([
      { id: 1, at: T0, type: "command", actor: "phone", public_id: "p1", subject: "lights.set", payload: '{"gang":"rear"}', result: "confirmed" },
      { id: 2, at: T0, type: "hw", actor: null, public_id: null, subject: "link", payload: null, result: "down" },
    ]);
  });
});

describe("event log retention", () => {
  it("prunes rows older than 30 days, keeps the rest", () => {
    const { db } = openDb(":memory:");
    const clock = fixedClock("2026-09-05T10:41:59.000Z");
    const log = createEventLogger(db, clock);
    log({ type: "system", subject: "old" });
    clock.set("2026-09-05T10:42:01.000Z");
    log({ type: "system", subject: "kept" });
    expect(pruneEventLog(db, new Date(T0))).toBe(1);
    expect(db.select().from(eventLog).all().map((row) => row.subject)).toEqual(["kept"]);
  });
});
```

4. Replace the whole file `apps/core-api/test/domain/energy.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { kwhToday, localDate, rollKwhBaseline } from "../../src/domain/energy.ts";
import { applyPowerReading } from "../../src/domain/projector.ts";
import { bootModel, T0 } from "../helpers.ts";

describe("kWh today", () => {
  it("localDate is the process-local calendar date (TZ=UTC in tests)", () => {
    expect(localDate(new Date("2026-10-05T23:59:59Z"))).toBe("2026-10-05");
    expect(localDate(new Date("2026-10-06T00:00:00Z"))).toBe("2026-10-06");
  });
  it.each([
    [null, 412.67, "2026-10-05", { date: "2026-10-05", kwh_total: 412.67 }, 0],
    [{ date: "2026-10-05", kwh_total: 412.67 }, 414.51, "2026-10-05", { date: "2026-10-05", kwh_total: 412.67 }, 1.84],
    [{ date: "2026-10-04", kwh_total: 400 }, 414.51, "2026-10-05", { date: "2026-10-05", kwh_total: 414.51 }, 0],
    [{ date: "2026-10-05", kwh_total: 412.67 }, 2, "2026-10-05", { date: "2026-10-05", kwh_total: 2 }, 0], // meter reset
  ])("baseline %j, total %d on %s", (baseline, total, date, expectedBaseline, expected) => {
    expect(kwhToday(baseline, total, date)).toEqual({ baseline: expectedBaseline, kwhToday: expected });
  });
});

describe("midnight baseline", () => {
  const reading = { watts: 287, volts: 230, energy_kwh_total: 414.51 };
  const morning = applyPowerReading(bootModel({ kwhBaseline: { date: "2026-10-05", kwh_total: 412.67 } }), reading, T0);

  it("same day: nothing changes", () => {
    expect(rollKwhBaseline(morning, new Date("2026-10-05T23:59:59Z"))).toBe(morning);
  });

  it("a new day: the last total is the baseline and TODAY reads 0", () => {
    expect(morning.state.display.projector.power.value?.kwh_today).toBe(1.84);
    const next = rollKwhBaseline(morning, new Date("2026-10-06T00:00:10Z"));
    expect(next.facts.kwh_baseline).toEqual({ date: "2026-10-06", kwh_total: 414.51 });
    expect(next.state.display.projector.power.value).toMatchObject({ watts: 287, kwh_today: 0 });
  });

  it("no meter total yet: nothing to roll", () => {
    const boot = bootModel();
    expect(rollKwhBaseline(boot, new Date("2026-10-06T00:00:10Z"))).toBe(boot);
  });
});
```

**Test:** `test/domain/energy.test.ts` "midnight baseline"; `test/db/event-log.test.ts` "event log retention" (boundary ±1 s).

**Verify:** `pnpm --filter @eduscope/core-api test` → `320 passed`. `pnpm verify` green.

**Commit:** `git add -A && git commit -m "feat(core-api): midnight kWh baseline and event-log pruning"` (with the ticked box in this plan)


### T25 — Dispatcher: the scheduler as an issuer
- [ ] done

**Files:** `apps/core-api/src/commands/dispatcher.ts`, `apps/core-api/test/commands/dispatcher.test.ts`

**Context:** ARCHITECTURE §6.8 "each step dispatched as a command with `issued_by: null`, attribution \"schedule\""; contracts already allow `Command.issued_by: null` and `ChangedBy "schedule"`; the kiosk renders `by: "schedule"` as "· by schedule" (`apps/kiosk/src/lib/format.ts`). `Issuer.public_id` becomes nullable and `label` may be `"schedule"`; `SCHEDULE_ISSUER` has technician access (a technician authored the steps, so `projector.mains` is allowed). Nothing else in the dispatcher changes.

**Do:**

1. Patch `apps/core-api/src/commands/dispatcher.ts` (158 lines, so only the change is shown). Run from the repo root; it must print nothing:
```sh
git apply --whitespace=nowarn <<'PATCH'
diff --git a/apps/core-api/src/commands/dispatcher.ts b/apps/core-api/src/commands/dispatcher.ts
index c473365..6719a7b 100644
--- a/apps/core-api/src/commands/dispatcher.ts
+++ b/apps/core-api/src/commands/dispatcher.ts
@@ -14,11 +14,20 @@ import { type CommandPlan, planCommand, requiredAccess } from "./policies.ts";
 // read-back (confirmed) | IR ack (assumed) | deadline (timed_out). Last write wins per output.
 
 export interface Issuer {
-  public_id: string;
-  label: ClientLabel;
+  /** null = the scheduler. */
+  public_id: string | null;
+  label: ClientLabel | "schedule";
   access: AccessLevel;
 }
 
+/** Timed actions (ARCHITECTURE §6.8): `issued_by: null`, attribution "· by schedule", any command kind. */
+export const SCHEDULE_ISSUER: Issuer = { public_id: null, label: "schedule", access: "technician" };
+
+function issuedBy(issuer: Issuer): Command["issued_by"] {
+  if (issuer.public_id === null || issuer.label === "schedule") return null;
+  return { public_id: issuer.public_id, label: issuer.label };
+}
+
 /** 403 (access), 409 (precondition) or 503 (hw down): no Command is created. */
 export class CommandRejected extends ApiFailure {
   constructor(status: 403 | 409 | 503, code: ApiErrorCode, message: string) {
@@ -38,7 +47,7 @@ interface Inflight {
 /** A command that a hw report just proved (returned by claim, finished by confirm). */
 export interface Claim {
   readonly inflight: Inflight;
-  readonly by: ClientLabel;
+  readonly by: ClientLabel | "schedule";
 }
 
 export interface Dispatcher {
@@ -116,7 +125,7 @@ export function createDispatcher(deps: {
 
       const command: Command = {
         id: newId(), client_cmd_id: request.client_cmd_id, body,
-        issued_by: { public_id: issuer.public_id, label: issuer.label },
+        issued_by: issuedBy(issuer),
         status: "pending", error: null, at: deps.clock.now().toISOString(),
       };
       const older = inflight.get(plan.key);
PATCH
```

2. Replace the whole file `apps/core-api/test/commands/dispatcher.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { CommandRejected, SCHEDULE_ISSUER } from "../../src/commands/dispatcher.ts";
import { applyHwDown } from "../../src/domain/hw-events.ts";
import { hwEvent, T0 } from "../helpers.ts";
import { LAPTOP, PHONE, room } from "./setup.ts";

describe("dispatcher outcomes", () => {
  it("assumed: AC power on sends the 24° frame; values become assumed (R3)", async () => {
    const r = room();
    const command = r.send({ kind: "ac.power", on: true });
    expect(command).toMatchObject({ status: "pending", issued_by: { public_id: "pub-phone", label: "phone" }, at: T0 });
    await expect.poll(() => r.statuses(command)).toEqual(["pending", "sent", "assumed"]);
    expect(r.hw.calls).toEqual([{ method: "irSend", body: { transport: "ir_zs06", code_format: "tuya", code: "AC-24" } }]);
    const { ac } = r.store.get().environment;
    expect(ac.power).toMatchObject({ value: "on", confidence: "assumed", changed_by: "phone" });
    expect(ac.setpoint_c.value).toBe(24);
    expect(r.activities()).toEqual(["Air conditioning turned on · phone"]);
    expect(r.logs).toEqual([expect.objectContaining({ type: "command", actor: "phone", subject: "ac.power", result: "assumed" })]);
  });

  it("assumed: AC + steps to the next captured setpoint (R4)", async () => {
    const r = room();
    const on = r.send({ kind: "ac.power", on: true });
    await expect.poll(() => r.statuses(on).at(-1)).toBe("assumed");
    const step = r.send({ kind: "ac.step", direction: "up" });
    await expect.poll(() => r.statuses(step).at(-1)).toBe("assumed");
    expect(r.hw.calls.at(-1)?.body).toMatchObject({ code: "AC-26" }); // 25 never captured
    expect(r.store.get().environment.ac.setpoint_c.value).toBe(26);
  });

  it("assumed: projector power on waits for draw (H7b) and never confirms by IR (R2)", async () => {
    const r = room();
    r.report(hwEvent("projector_power.reading", { watts: 3, volts: 231, energy_kwh_total: 412.7 }));
    const command = r.send({ kind: "projector.power", on: true });
    expect(r.store.get().display.projector.feedback).toEqual({ last_ir: "power_on", sent_at: T0, phase: "waiting_for_draw" });
    await expect.poll(() => r.statuses(command)).toEqual(["pending", "sent", "assumed"]);
    expect(r.store.get().display.projector.state.value).toBe("standby");
    r.report(hwEvent("projector_power.reading", { watts: 24, volts: 231, energy_kwh_total: 412.7 }));
    expect(r.store.get().display.projector.state.value).toBe("warming_up");
    expect(r.store.get().display.projector.feedback.phase).toBe("idle");
  });

  it("failed: hw refuses → H6a text per transport; projector feedback is reverted", async () => {
    const r = room();
    r.hw.nextAcks.push({ ok: false, error: { code: "device_offline", message: "r101_lights is offline" } });
    const lights = r.send({ kind: "lights.set", gang: "front", on: false });
    await expect.poll(() => r.statuses(lights)).toEqual(["pending", "failed"]);
    expect(r.events.find((e) => e.type === "command" && e.command.status === "failed")).toMatchObject({ command: { error: "Switch didn't respond" } });

    r.report(hwEvent("projector_power.reading", { watts: 3, volts: 231, energy_kwh_total: 412.7 }));
    r.hw.nextAcks.push({ ok: false, error: { code: "transport", message: "hw-service unreachable" } });
    const projector = r.send({ kind: "projector.power", on: true });
    await expect.poll(() => r.statuses(projector).at(-1)).toBe("failed");
    expect(r.events.findLast((e) => e.type === "command")).toMatchObject({ command: { error: "Couldn't reach the blaster" } });
    expect(r.store.get().display.projector.feedback.phase).toBe("idle");
    expect(r.activities()).toEqual([]);
  });

  it("timed_out: no read-back within the transport timeout; a hw timeout ack too", async () => {
    const r = room();
    const silent = r.send({ kind: "lights.set", gang: "rear", on: true });
    await expect.poll(() => r.statuses(silent)).toEqual(["pending", "sent", "timed_out"]);
    r.hw.nextAcks.push({ ok: false, error: { code: "timeout", message: "no answer" } });
    const slow = r.send({ kind: "screen.move", to: "raise" });
    await expect.poll(() => r.statuses(slow)).toEqual(["pending", "timed_out"]);
    expect(r.dispatcher.inflightCount()).toBe(0);
  });

  it("hw down: 503 hw_unavailable, no command, no hw call (§6.7)", () => {
    const r = room();
    r.store.update((model, at) => applyHwDown(model, at));
    expect(() => r.send({ kind: "lights.set", gang: "rear", on: true })).toThrow(
      expect.objectContaining({ status: 503, code: "hw_unavailable", message: "Hardware service offline" }),
    );
    expect(r.hw.calls).toEqual([]);
    expect(r.events.filter((e) => e.type === "command")).toEqual([]);
  });

  it("last write wins: a newer command on the same output supersedes the older one quietly", () => {
    const r = room();
    const first = r.send({ kind: "lights.set", gang: "rear", on: true }, PHONE);
    const second = r.send({ kind: "lights.set", gang: "rear", on: false }, LAPTOP);
    expect(r.statuses(first)).toEqual(["pending", "assumed"]); // no longer awaited, no toast
    expect(r.statuses(second)).toEqual(["pending"]);
    expect(r.dispatcher.inflightCount()).toBe(1);
    expect(r.activities()).toEqual([]);
  });

  it("access: projector mains as control → 403 CommandRejected", () => {
    const r = room();
    expect(() => r.send({ kind: "projector.mains", on: true }, PHONE)).toThrow(CommandRejected);
    expect(() => r.send({ kind: "projector.mains", on: true }, PHONE)).toThrow(expect.objectContaining({ status: 403, code: "forbidden" }));
  });
});

describe("schedule as issuer (§6.8)", () => {
  it("issued_by null, attribution 'schedule' on the value and the activity, logged as schedule", async () => {
    const r = room();
    r.echo((method) => (method === "lightsSet" ? hwEvent("lights.state", { gang: "rear", on: false }) : null));
    r.report(hwEvent("lights.state", { gang: "rear", on: true }));
    const command = r.send({ kind: "lights.set", gang: "rear", on: false }, SCHEDULE_ISSUER);
    expect(command.issued_by).toBeNull();
    await expect.poll(() => r.statuses(command).at(-1)).toBe("confirmed");
    expect(r.store.get().environment.lights.rear).toMatchObject({ value: false, changed_by: "schedule" });
    expect(r.events.filter((e) => e.type === "activity").at(-1)).toEqual({
      type: "activity", text: "Rear of room turned off", by: "schedule", public_id: null,
    });
    expect(r.logs.at(-1)).toMatchObject({ type: "command", actor: "schedule", public_id: null, result: "confirmed" });
  });

  it("may run technician kinds", () => {
    const r = room();
    r.report(hwEvent("projector_power.reading", { watts: 0, volts: 231, energy_kwh_total: 412.7 }));
    expect(() => r.send({ kind: "projector.mains", on: false }, SCHEDULE_ISSUER)).not.toThrow();
  });
});
```

**Test:** `test/commands/dispatcher.test.ts` "schedule as issuer": `issued_by` null, `changed_by` and activity `schedule`, `public_id` null, logged as schedule; may run technician kinds.

**Verify:** `pnpm --filter @eduscope/core-api test` → `322 passed`. `pnpm verify` green.

**Commit:** `git add -A && git commit -m "feat(core-api): the scheduler as a command issuer"` (with the ticked box in this plan)


### T26 — Scheduler: 30 s tick wired into `buildApp`
- [ ] done

**Files:** `apps/core-api/src/app.ts`, `apps/core-api/src/scheduler/scheduler.ts`, `apps/core-api/test/scheduler/scheduler.test.ts`

**Context:** ARCHITECTURE §6.8. Each tick: load the schedule, dispatch every step of each due action as `SCHEDULE_ISSUER` (a refused step is logged `refused: <message>` and the next step still runs), end remote control sessions when a class block ends (`endAccess("control", null, "class block ended")` → H24 toast on those clients), roll the kWh baseline (persisted like ingest does), prune the event log once per local day (also on the first tick after boot). **Expired-session sweep:** already a 15 s timer since M08 (ARCHITECTURE §5); the scheduler does not repeat it. `app.room.scheduler` is exposed so tests call `tick()` after moving the clock.

**Do:**

1. Patch `apps/core-api/src/app.ts` (189 lines, so only the change is shown). Run from the repo root; it must print nothing:
```sh
git apply --whitespace=nowarn <<'PATCH'
diff --git a/apps/core-api/src/app.ts b/apps/core-api/src/app.ts
index 1301adf..bd97d32 100644
--- a/apps/core-api/src/app.ts
+++ b/apps/core-api/src/app.ts
@@ -25,6 +25,7 @@ import { originCheckPlugin } from "./plugins/origin-check.ts";
 import { createHub, PING_MS, realtimePlugin, type Hub } from "./plugins/realtime.ts";
 import { staticPlugin } from "./plugins/static.ts";
 import { createRegistrySync } from "./registry-sync.ts";
+import { createScheduler, SCHEDULER_TICK_MS, type Scheduler } from "./scheduler/scheduler.ts";
 import { systemProbe, type SystemProbe } from "./system/info.ts";
 import { commandRoutes } from "./routes/commands.ts";
 import { deviceRoutes } from "./routes/devices.ts";
@@ -62,6 +63,7 @@ export interface Room {
   sessions: SessionService;
   hub: Hub;
   ir: IrService;
+  scheduler: Scheduler;
 }
 
 declare module "fastify" {
@@ -116,10 +118,11 @@ export async function buildApp(deps: AppDeps): Promise<FastifyInstance> {
     store, hw: deps.hw, ir: createIrCodeLookup(db), timeouts: hwTimeouts(config), clock, emit: (event) => hub.broadcast(event), log,
   });
   const timers = new Set<ReturnType<typeof setTimeout>>();
+  const persistBaseline = (baseline: KwhBaseline): void => writeSetting(db, "kwh_baseline", baseline, clock.now().toISOString());
   const ingest = createIngest({
     store, dispatcher, log,
     emit: (event) => hub.broadcast(event),
-    persistBaseline: (baseline: KwhBaseline) => writeSetting(db, "kwh_baseline", baseline, clock.now().toISOString()),
+    persistBaseline,
     scheduleTick: (delayMs) => {
       const timer = setTimeout(() => {
         timers.delete(timer);
@@ -139,11 +142,12 @@ export async function buildApp(deps: AppDeps): Promise<FastifyInstance> {
   store.subscribe((state) => hub.broadcast({ type: "state", state }));
   const sync = createRegistrySync(db, store);
   const ir = createIrService({ db, store, hw: deps.hw, clock, emit: (event) => hub.broadcast(event), log, sync });
+  const scheduler = createScheduler({ db, store, dispatcher, sessions, clock, log, persistBaseline });
 
   const app = Fastify({ logger: deps.logger ?? false, trustProxy: false });
   app.setValidatorCompiler(validatorCompiler);
   app.setSerializerCompiler(serializerCompiler);
-  app.decorate("room", { db, store, dispatcher, ingest, sessions, hub, ir });
+  app.decorate("room", { db, store, dispatcher, ingest, sessions, hub, ir, scheduler });
 
   await app.register(errorsPlugin);
   await app.register(cookie, { secret: config.COOKIE_SECRET });
@@ -172,6 +176,7 @@ export async function buildApp(deps: AppDeps): Promise<FastifyInstance> {
     timers.add(setInterval(() => store.tick(), TICK_MS));
     timers.add(setInterval(() => sessions.sweep(), SESSION_SWEEP_MS));
     timers.add(setInterval(() => hub.ping(), PING_MS));
+    timers.add(setInterval(() => scheduler.tick(), SCHEDULER_TICK_MS));
   });
   app.addHook("onClose", async () => {
     for (const timer of timers) clearTimeout(timer);
PATCH
```

2. Create `apps/core-api/src/scheduler/scheduler.ts`:
```ts
import { randomUUID } from "node:crypto";
import type { TimedAction } from "@eduscope/contracts";
import type { SessionService } from "../auth/sessions.ts";
import type { Clock } from "../clock.ts";
import { SCHEDULE_ISSUER, type Dispatcher } from "../commands/dispatcher.ts";
import type { Db } from "../db/client.ts";
import { pruneEventLog, type EventLogger } from "../db/event-log.ts";
import { loadSchedule } from "../db/schedule.ts";
import { localDate, rollKwhBaseline } from "../domain/energy.ts";
import type { KwhBaseline } from "../domain/model.ts";
import { dueActions, endedBlocks, tickWindow } from "../domain/schedule.ts";
import type { StateStore } from "../domain/state-store.ts";
import { ApiFailure } from "../errors.ts";

// ARCHITECTURE §6.8: one tick every 30 s. Runs the timed actions due since the last tick (each step
// a command issued by "schedule"), ends remote control sessions when a class block ends (§2.3),
// resets the kWh baseline at local midnight and prunes the event log once a day. The expired-session
// sweep stays on its own 15 s timer (app.ts, ARCHITECTURE §5). Tests call tick() after moving the clock.

export const SCHEDULER_TICK_MS = 30_000;

export interface Scheduler {
  tick(): void;
}

export function createScheduler(deps: {
  db: Db;
  store: StateStore;
  dispatcher: Dispatcher;
  sessions: SessionService;
  clock: Clock;
  log: EventLogger;
  persistBaseline: (baseline: KwhBaseline) => void;
  newId?: () => string;
}): Scheduler {
  const { db, store, dispatcher, sessions, clock, log } = deps;
  const newId = deps.newId ?? randomUUID;
  let lastTick = clock.now();
  let prunedOn: string | null = null;

  /** Every step is dispatched even when an earlier one is refused (a refusal is logged, never thrown). */
  function run(action: TimedAction): void {
    log({ type: "system", actor: "schedule", subject: action.name, result: "run" });
    for (const step of action.steps) {
      try {
        dispatcher.dispatch({ client_cmd_id: newId(), body: step }, SCHEDULE_ISSUER);
      } catch (error) {
        if (!(error instanceof ApiFailure)) throw error;
        log({ type: "command", actor: "schedule", subject: step.kind, payload: step, result: `refused: ${error.message}` });
      }
    }
  }

  function rollBaseline(now: Date): void {
    const before = store.model().facts.kwh_baseline;
    store.update((model) => rollKwhBaseline(model, now));
    const after = store.model().facts.kwh_baseline;
    if (after !== null && JSON.stringify(after) !== JSON.stringify(before)) deps.persistBaseline(after);
  }

  return {
    tick() {
      const now = clock.now();
      const { from, to } = tickWindow(lastTick, now);
      lastTick = now;
      const schedule = loadSchedule(db);
      for (const action of dueActions(schedule.actions, from, to)) run(action);
      if (endedBlocks(schedule.class_blocks, from, to).length > 0) sessions.endAccess("control", null, "class block ended");
      rollBaseline(now);
      const today = localDate(now);
      if (prunedOn !== today) {
        prunedOn = today;
        pruneEventLog(db, now);
      }
    },
  };
}
```

3. Create `apps/core-api/test/scheduler/scheduler.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createEventLogger } from "../../src/db/event-log.ts";
import { eventLog } from "../../src/db/schema.ts";
import { readSetting } from "../../src/db/settings.ts";
import { hwEvent } from "../helpers.ts";
import { call, openSocket, sessionAt, startApp } from "../routes/app-helpers.ts";

// T0 = Mon 2026-10-05 10:42:00 UTC; tests run with TZ=UTC, so "10:44" is two minutes later.

const LIGHTS_OFF = {
  name: "Lights off", time: "10:44", days: ["mon"], enabled: true,
  steps: [{ kind: "lights.set", gang: "front", on: false }, { kind: "lights.set", gang: "rear", on: false }],
};

async function room() {
  const started = await startApp();
  const tech = await sessionAt(started.app, "technician", "192.168.1.90");
  const add = (url: string, payload: unknown) => call(started.app, "POST", url, { cookie: tech, remoteAddress: "192.168.1.90", payload });
  // like the hw fake: every lights command is echoed back as a report
  started.hw.onCall = (method, body) => {
    const parsed = z.object({ gang: z.enum(["front", "rear"]), on: z.boolean() }).safeParse(body);
    if (method === "lightsSet" && parsed.success) started.app.room.ingest.handle(hwEvent("lights.state", parsed.data, started.clock.now().toISOString()));
  };
  return { ...started, add };
}

describe("scheduler (§6.8)", () => {
  it("AC5: a timed action fires at its minute, every client gets '… · by schedule', lights turn off", async () => {
    const { app, clock, hw, add } = await room();
    app.room.ingest.handle(hwEvent("lights.state", { gang: "front", on: true }));
    expect((await add("/api/schedule/actions", LIGHTS_OFF)).statusCode).toBe(201);
    const viewer = await openSocket(app);
    await viewer.next("snapshot");
    clock.set("2026-10-05T10:43:50.000Z");
    app.room.scheduler.tick();
    expect(hw.calls.filter((c) => c.method === "lightsSet")).toHaveLength(0);
    clock.set("2026-10-05T10:44:20.000Z");
    app.room.scheduler.tick();
    expect(hw.calls.filter((c) => c.method === "lightsSet").map((c) => c.body)).toEqual([{ gang: "front", on: false }, { gang: "rear", on: false }]);
    await expect.poll(() => viewer.frames.filter((f) => f.type === "activity").map((f) => (f.type === "activity" ? `${f.text} · ${f.by}` : ""))).toContain(
      "Front of room turned off · schedule",
    );
    expect(app.room.store.get().environment.lights.front).toMatchObject({ value: false, changed_by: "schedule" });
    clock.set("2026-10-05T10:44:50.000Z");
    app.room.scheduler.tick(); // same minute again: not twice
    expect(hw.calls.filter((c) => c.method === "lightsSet")).toHaveLength(2);
    viewer.ws.terminate();
    await app.close();
  });

  it("a disabled action or another weekday does nothing; a refused step does not stop the rest", async () => {
    const { app, clock, hw, add } = await room();
    await add("/api/schedule/actions", { ...LIGHTS_OFF, enabled: false });
    await add("/api/schedule/actions", { ...LIGHTS_OFF, days: ["tue"] });
    await add("/api/schedule/actions", { ...LIGHTS_OFF, name: "AC up", steps: [{ kind: "ac.step", direction: "up" }, { kind: "lights.set", gang: "rear", on: false }] });
    clock.set("2026-10-05T10:44:10.000Z");
    app.room.scheduler.tick();
    expect(hw.calls.filter((c) => c.method === "lightsSet").map((c) => c.body)).toEqual([{ gang: "rear", on: false }]);
    const refused = app.room.db.select().from(eventLog).all().find((row) => row.subject === "ac.step");
    expect(refused).toMatchObject({ actor: "schedule", result: "refused: Turn the air conditioning on first" });
    await app.close();
  });

  it("AC6: at a class block's end remote control sessions drop to view and are told; technician stays", async () => {
    const { app, clock, add } = await room();
    await add("/api/schedule/blocks", { days: ["mon"], start: "09:00", end: "10:44" });
    const phone = await sessionAt(app, "control");
    const socket = await openSocket(app, { cookie: phone });
    await socket.next("snapshot");
    clock.set("2026-10-05T10:43:40.000Z");
    app.room.scheduler.tick();
    expect((await call(app, "GET", "/api/session", { cookie: phone })).json()).toMatchObject({ access: "control" });
    clock.set("2026-10-05T10:44:10.000Z");
    app.room.scheduler.tick();
    await expect.poll(() => socket.frames.filter((f) => f.type === "session").at(-1)).toMatchObject({ session: { access: "view" } });
    expect(app.room.sessions.endAccess("technician", null, "check")).toBe(1); // the technician was not ended by the block
    socket.ws.terminate();
    await app.close();
  });

  it("midnight: kWh today restarts at 0 and the baseline is saved", async () => {
    const { app, clock } = await room();
    app.room.ingest.handle(hwEvent("projector_power.reading", { watts: 287, volts: 230, energy_kwh_total: 414.51 }));
    expect(readSetting(app.room.db, "kwh_baseline", z.object({ date: z.string(), kwh_total: z.number() }))?.date).toBe("2026-10-05");
    clock.set("2026-10-06T00:00:10.000Z");
    app.room.scheduler.tick();
    expect(app.room.store.get().display.projector.power.value?.kwh_today).toBe(0);
    expect(readSetting(app.room.db, "kwh_baseline", z.object({ date: z.string(), kwh_total: z.number() }))).toEqual({ date: "2026-10-06", kwh_total: 414.51 });
    await app.close();
  });

  it("prunes event-log rows older than 30 days once a day", async () => {
    const { app } = await room();
    createEventLogger(app.room.db, { now: () => new Date("2026-08-01T00:00:00.000Z") })({ type: "system", subject: "ancient" });
    app.room.scheduler.tick();
    expect(app.room.db.select().from(eventLog).all().map((row) => row.subject)).not.toContain("ancient");
    await app.close();
  });
});
```

**Test:** `apps/core-api/test/scheduler/scheduler.test.ts` — AC5 (fires at 10:44, both lights off, activity "· schedule" to a view socket, not twice in one minute); disabled / other weekday / refused step; AC6 (control → view + pushed, technician kept); midnight baseline saved; pruning.

**Verify:** `pnpm verify` → green; core-api `327 passed`, hw `134 passed`.

**Commit:** `git add -A && git commit -m "feat(core-api): scheduler for timed actions, class-block end, midnight and pruning"` (with the ticked box in this plan)

### T27 — Acceptance walk-through (M09 criteria)
- [ ] done

**Files:** this plan file only (tick the boxes; write any failure under `## Blockers` and stop).

**Context:** every M09 acceptance criterion with its exact check, in an order that avoids interference:
- **AC2 runs before AC1.** The fake projector only reacts to its seeded code (`HW_FAKE_PROJECTOR_ON_CODE`); AC1's
  re-learn stores a new random code, after which S1 "Power on" no longer drives the fake projector. AC2's "the projector
  still powers on from S1" must therefore be checked first.
- **AC7 runs after AC6** (it locks the other control sessions) and restores PIN `1234` at the end.
- Use real time (no `HW_FAKE_TIME_SCALE`): AC8's 4-minute countdown and AC1's 20 s countdown are meant to be watched.

"Desktop" = Chromium on this machine at `http://localhost:5173` (1280×800), "phone" = a phone on the same Wi-Fi at
`http://<arch-ip>:5173` (the `Network:` address Vite prints) or Chromium devtools at 390×844 in a second profile.
Technician PIN `123456`, room PIN `1234`. Write the observed result next to each item in your report.

**Do:**
1. **Fresh dev database** (it is git-ignored local data; T4's seed applies to an empty one):
   `rm -f apps/core-api/data/dev.db apps/core-api/data/dev.db-wal apps/core-api/data/dev.db-shm`, then `pnpm dev`.
   Wait for core-api's "Server listening at http://0.0.0.0:3000" and `curl -s localhost:3000/api/health` → `"hw":"up"`.
2. **AC1 (part 1) — list.** Desktop: Settings → `123456` → Remote configuration. The device list shows "Air conditioning ·
   Panasonic · via ZS06" `14` and "Projector · Epson · via ZS06" `2` (all rows "Tuya code · captured · untested": the dev
   seed's codes have never been tested).
3. **AC2.** Desktop S1: unlock with `1234`, projector **Power on** → "Warming up" then "On · confirmed by draw"; **Power
   off** → back to Standby (≈ 1–2 min at real time; the walk can continue meanwhile). Then
   `curl -s -XPOST http://127.0.0.1:8081/v1/_fake/ir/nothing_received` → `{"ok":true}`. S3 → Projector → "Power on" →
   **Re-learn**: "Listening… point the remote at the ZS06 and press the button" with a 20 s countdown; after 20 s "Nothing
   received" + **Try again**. Then
   `curl -s -XPOST http://127.0.0.1:8081/v1/_fake/ir/nothing_received -H 'content-type: application/json' -d '{"on":false}'`.
   Back on S1, Power on again → the projector warms up (the stored code is unchanged).
4. **AC1 (part 2) — capture, test, persist.** S3 → Projector → "Power on" → **Re-learn** → "Listening…" countdown → after
   ~3 s "Captured · now test it" with Test highlighted → **Test** → "Did the Projector react?" → **Yes** → the row reads
   "Tuya code · tested ✓ just now". Reload the page (F5) and re-enter `123456` if asked: the row still shows "tested ✓".
   While a capture is listening, Re-learn on another row is disabled; `curl` check of the server rule is in T13's tests.
5. **AC3.** S3 → Air conditioning → **+ Add a command** → 31 °C (mode cool, fan auto) → it starts capturing → "Captured ·
   now test it". S1: unlock if needed, AC **Power on**, press **+** repeatedly → the setpoint goes up to **31°** and the +
   button disables at 31° (H19).
6. **AC4.** Settings → Devices → tap "Projector" → Transport **MCU** → Save. Settings → Remote configuration shows
   "Projector · Epson · via MCU" (desktop and phone, no reload). Set it back to **ZS06** afterwards.
7. **AC5.** Phone: open S1 (view is enough). Desktop: S1 turn both light rows **on**. Settings → Schedule → **+ Add action**
   → "Lights off", time = now + 2 min (`date -d '+2 min' +%H:%M`), today's weekday → Save. Within 30 s after that minute
   both clients show the toasts "Front of room turned off · by schedule" and "Rear of room turned off · by schedule", and
   both light rows are off.
8. **AC6.** Phone: tap any S1 control → `1234` (now `control`). Desktop: Settings → Schedule → **+ Add block**, today, start
   `00:00`, end = now + 2 min → Save. Within 30 s after the end minute the phone shows "Locked · enter PIN to control" and
   its cards show padlocks again. The desktop (technician) stays in Settings.
9. **AC7.** Phone: unlock again with `1234`. Desktop: Settings → Devices → Room PIN → **Change** → `4321` → the phone drops
   to view with "Locked · enter PIN to control"; on the phone `1234` → "Wrong PIN", `4321` → unlocked. Change the room PIN
   back to `1234` on the desktop.
10. **AC8.** Desktop: Settings → Devices → **Permit joining** → the card reads "Joining open · 3:59 left". Desktop and phone:
    Devices (S2) mesh card shows "Open · 4:00 left" counting down (3:59, 3:58, …) on both, and "Closed" after 4 min.
11. **AC9.** Settings → Network: Hostname `<this machine's hostname>.local`, Address = this machine's LAN IPv4, Connection
    "Ethernet" or "Wi-Fi · {SSID} · {n}%", Controller online, Connected clients listing at least "phone" and "laptop".
    Settings → About: room `R-101`, version `0.0.0`, uptime counting since `pnpm dev` started, Pi model "unknown", QR code
    with `http://r-101.local` beneath it.
12. **AC10.** With `pnpm dev` still running, save this block as `/tmp/ec-m09-ac10.sh` and run `bash /tmp/ec-m09-ac10.sh`
    (bash, not zsh):
```sh
O='origin: http://localhost:3000'; J='content-type: application/json'; B=http://localhost:3000
curl -s -c /tmp/ec-m09-control.jar -XPOST $B/api/session/login -H "$J" -H "$O" -d '{"level":"control","pin":"1234","label":"laptop"}' >/dev/null
while read -r M P D; do
  for JAR in none /tmp/ec-m09-control.jar; do
    if [ "$M" = GET ] || [ "$M" = DELETE ]; then ARGS=(); else ARGS=(-H "$J" -d "$D"); fi
    [ "$JAR" = none ] && C=() || C=(-b "$JAR")
    printf '%-6s %-40s %-5s %s\n' "$M" "$P" "${JAR##*-}" "$(curl -s -o /dev/null -w '%{http_code}' -X "$M" "${C[@]}" -H "$O" "${ARGS[@]}" "$B$P" </dev/null)"
  done
done <<'ROUTES'
GET /api/ir/devices -
POST /api/ir/devices {"name":"Fan","brand":"Acme","kind":"other","transport":"ir_mcu"}
PATCH /api/ir/devices/projector {"name":"Projector"}
POST /api/ir/devices/ac/commands {"name":"x","role":"other","setpoint":null}
DELETE /api/ir/commands/ac.setpoint_18 -
POST /api/ir/commands/projector.power_on/learn {}
POST /api/ir/commands/projector.power_on/learn/cancel {}
POST /api/ir/commands/projector.power_on/test {}
POST /api/ir/commands/projector.power_on/test-result {"reacted":true}
GET /api/schedule -
POST /api/schedule/blocks {"days":["mon"],"start":"08:00","end":"10:00"}
PUT /api/schedule/blocks/x {"days":["mon"],"start":"08:00","end":"10:00"}
DELETE /api/schedule/blocks/x -
POST /api/schedule/actions {"name":"x","time":"18:00","days":["mon"],"enabled":true,"steps":[{"kind":"ac.power","on":false}]}
PUT /api/schedule/actions/x {"name":"x","time":"18:00","days":["mon"],"enabled":true,"steps":[{"kind":"ac.power","on":false}]}
DELETE /api/schedule/actions/x -
GET /api/devices -
PATCH /api/devices/projector {"name":"Projector"}
DELETE /api/devices/door -
POST /api/zigbee/permit-join {"seconds":240}
PUT /api/settings/pins/room {"pin":"9999"}
PUT /api/settings/pins/technician {"pin":"999999"}
GET /api/system/network -
GET /api/system/about -
POST /api/system/restart {}
ROUTES
```
    Expected: 50 lines; every `none` line ends in `401`, every `control.jar` line in `403`. (Nothing changes: the guard
    answers before any handler. Verified on the dry run: 25 × `none 401`, 25 × `control.jar 403`.)
13. **Restart (S3e, D12).** Settings → About → **Restart controller** → confirm. Both clients show "Reconnecting…", the
    core-api log prints `[tsx] change in ./src/main.ts Restarting...`, then "Back online" within a few seconds.
    Ctrl+C `pnpm dev`.
14. **AC11.** `pnpm verify` → exit 0; core-api **327 passed**, hw **134 passed**. Coverage map:
    learn/test state transitions → `test/ir/service.test.ts`, `test/routes/ir.test.ts`; setpoint list rebuild →
    `test/domain/ac.test.ts`, `test/registry-sync.test.ts`, `test/ir/service.test.ts` (R4 cases), `test/routes/devices.test.ts`;
    scheduler due-calculation (days, minute boundary, midnight) → `test/domain/schedule.test.ts`; class-block end expiry →
    `test/scheduler/scheduler.test.ts` (AC6 case), `test/auth/sessions.test.ts` (`endAccess`); PIN change invalidation →
    `test/routes/settings.test.ts`; all new routes' access levels → `test/routes/access.test.ts` (25 routes).
15. **Scope check.** `git diff --stat m09-start -- apps/kiosk packages` → empty (no kiosk or contract change);
    `git diff --stat m09-start -- services` → only `app/modules/ir/driver_fake.py`, `tests/test_ir.py`,
    `tests/test_registry.py`; `git diff --stat m09-start -- apps/core-api/drizzle` → empty (no migration, D14).
16. Tick every T1–T27 box.

**Verify:** all items above as stated.

**Commit:** `git commit -am "docs: M09 acceptance walk-through"`


## Checkpoints

- After T9: the data layer and the pure rules exist; nothing to look at. `pnpm --filter @eduscope/core-api test` → 235 passed.
- After T13: "Human: `pnpm dev`, desktop Settings → `123456` → Remote configuration: the list comes from core-api (AC
  14 / Projector 2); Re-learn on Projector · Power off shows Listening… then Captured · now test it."
- After T18: "Human: `pnpm dev`, Settings → Schedule and Devices load from core-api; add a class block and remove it; rename
  a device and rename it back."
- After T22: "Human: `pnpm dev`, Settings → Network and About show this machine's facts; Restart controller comes back."
- After T26: run T27.

## Blockers

(executor writes here; leave empty)

## Nice-to-haves (not tasks)

- A fake hw option to capture a chosen code (e.g. `/v1/_fake/ir/next_code`), so AC1's re-learn can keep the fake
  projector working and AC1/AC2 could run in any order.
- Push the session's new `expires_at` after T14's activity touch (M08-L4 follow-up; nothing reads it yet).
- Control `expires_at` = min(idle, end of the current class block) at login (ARCHITECTURE §5 wording), so the client could
  show when it will lock; today the block end is enforced by the scheduler only.
- Refuse removing a device that S1 needs (projector, AC, lights…) or ask twice in S3d; today a technician may remove any.
- Log refused permit-join and failed restart commands into `event_log` (today pino only for the restart).
