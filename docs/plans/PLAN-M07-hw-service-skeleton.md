# PLAN-M07 — hw-service skeleton (fake drivers)
Milestone: `docs/milestones/M07-hw-service-skeleton.md` · Start tag: `m07-start` · Verify-all: `pnpm verify`

Inputs read for this plan: M07; ARCHITECTURE §1, §2, §3.1, §3.4, §6.3, §6.7, §7.1–7.3, §8, §10 (D-05, D-06, D-13,
D-18, D-19); SPEC R1, H7b, H21, H25, Q1, Q2, Q4, Q8, Q12, S1.E13, S2.E12–E13, S2.E21, S3.E10; CLAUDE.md; M08 (what it
expects from hw: AC2 `by_hand` with no body, AC3 the projector ramp); `packages/contracts/src/hw/*`,
`packages/contracts/fixtures/hw/*` + `fixtures/README.md`; root `package.json`, `.gitignore`, `eslint.config.js`.
No UI in this milestone, so there is no screenshot work. **No contract change**: the zod schemas and fixtures stay as
M01 left them; pydantic is written to match them.

## Executor notes (read once, apply to every task)

- Paths are relative to the repo root `/home/rust-cohle/edcontrol`. "Run `cmd`" = run it from the repo root.
- Before T1: `git tag m07-start` (on the commit that adds this plan).
- Tooling verified with: uv 0.12.23, Python 3.11.17 (uv-managed), fastapi 0.143.0, starlette 1.8.0, pydantic 2.14.1,
  pydantic-settings 2.15.0, sse-starlette 3.5.0, uvicorn 0.54.0, pytest 9.1.1, pytest-asyncio 1.4.0, httpx 0.28.1,
  ruff 0.17.0, pnpm 11.28.3.
- **Every code block in this plan was run.** The finished service was built in a scratch worktree from `main`
  (1c56588): `pnpm verify` green (133 pytest tests), stable over repeated runs and with 6 parallel runs pinned to
  one CPU. Every acceptance curl in T20 was run against it. Apply blocks **verbatim**:
  - "Create `X`" = the block is the full file content (end it with one newline). Create missing directories.
  - "Create empty `X`" = a zero-byte file (Python package marker).
  - "In `X` replace: … with: …" = an exact, unique text replacement.
- The Python blocks are already `ruff format`-ed and `ruff check`-clean. If `pnpm hw:lint` fails, you mistyped a
  block: diff it against the plan. Do not "fix" by reformatting or adding `# noqa`.
- `uv run` creates `services/hw/.venv` and installs on first use; it needs network the first time (it also
  downloads CPython 3.11 if missing). `.venv/`, `__pycache__/`, `.pytest_cache/`, `.ruff_cache/` and `.env` are
  already ignored by the root `.gitignore`. **Commit `services/hw/uv.lock`.**
- Never import from `reference/`. No real hardware is touched in this milestone; every real driver is a stub.
- Python 3.11 syntax only (`.python-version` = 3.11, ruff `target-version = "py311"`): no `type X = …` statements,
  no `class C[T]` generics.

### Decisions this plan makes (do not re-open them)

- **D1 — module shape.** Each `app/modules/<capability>/` has exactly `__init__.py` (empty), `schemas.py`,
  `service.py`, `driver_fake.py`, `driver_real.py`, `router.py`. `service.py` holds the `<Cap>Driver(Protocol)` and
  `<Cap>Service(driver, bus)`. **Drivers only emit events; the service keeps the last reported state** (that is what
  `snapshot()` returns) and publishes every event on the bus. `router.py` exposes `build_router(service)`. Fake-only
  simulation routes live in `driver_fake.py` as `build_fake_router(driver)`; `registry.py` mounts them only when that
  module runs its fake driver.
- **D2 — where contract models live.** `app/contracts.py`: shared pieces with no module imports (`HwModel` base with
  `extra="forbid"`, `HwAck`, `HwHealth`, `HwError*`, heartbeat, `HwEnvelope`). `modules/*/schemas.py`: that module's
  requests, data, events and snapshot section. `app/snapshot.py`: `HwSnapshot` + the `HwEvent` union (it needs every
  module). Every top-level zod schema has a pydantic model **with the same name** (the fixture test looks models up by
  name); zod's inline objects get descriptive internal names (`HwLightsSnapshot`, `HwLightsStateEvent`, …).
- **D3 — event envelope.** `HwEnvelope(type, at)` with `at` defaulting to "now" in UTC (serialised with `Z`); each
  event class narrows `type` to a literal default and adds `data`. Drivers write `HwLightsStateEvent(data=…)`.
- **D4 — real drivers before intake.** `start()`/`stop()` do nothing (the module reports nothing, its snapshot stays
  null/unknown); every command raises `NotImplementedError("hardware intake pending")`. Services turn **any** driver
  exception into `{"ok":false,"error":{"code":"transport","message":"<module>: …"}}` (AC6). IR learn has no error
  variant in the contract, so a driver failure there answers `{"status":"timeout"}` and publishes `hw.error`.
- **D5 — env names.** Every setting is `HW_`-prefixed (CLAUDE.md). The milestone's `FAKE_TIME_SCALE` is
  **`HW_FAKE_TIME_SCALE`**; T20 uses that name.
- **D6 — fake time.** `HW_FAKE_TIME_SCALE` (default 1) divides simulated durations: projector ramp steps (10 s each),
  IR capture (3 s), screen travel (3 s), permit-join length. Periodic power and climate readings use
  `HW_FAKE_REPORT_INTERVAL_S` (default 10 s), **not** scaled, so the stream stays readable at scale 60.
- **D7 — fake projector.** Starts with relay on, standby 3 W, 231 V, `energy_kwh_total` 412.67. It reacts to
  `HW_FAKE_PROJECTOR_ON_CODE` (default `C/8hRgHrBkYBgAMH` = the code in `fixtures/hw/request.ir.send.json`) and
  `HW_FAKE_PROJECTOR_OFF_CODE` (default `C/8hRgHrBkYBgAMP`), delivered by the fake IR driver (wired in the
  registry). Warm-up readings 12, 24, 36, 48, 160, 287 W; cool-down 120, 45, 38, 30, 22, 14, 6, 3 W `[ASSUMED]`.
  Relay off → 0 W and IR is ignored; relay on → standby. Energy integrates `watts × interval × scale`.
- **D8 — fake initial state** = screenshot 01 / `response.snapshot.json`: lights front on, rear off; HDMI
  podium_pc; screen lowered; mic 62, pc 38 unmuted; climate 26.4 °C / 61 %, motion detected, door closed;
  coordinator ZG-808Z online + 5 nodes from config; blaster online LQI 196. **Exception:** the projector starts in
  standby (D7) so AC4's power-on ramp can be seen without a power-off first.
- **D9 — fake IR learn.** One capture at a time (a new learn cancels the running one → `cancelled`). Emits
  `ir.learn listening`, then after 3 s (scaled) answers `captured` with a random base64 code from
  `random.Random(HW_FAKE_SEED)` (deterministic per process). It answers `timeout` after `timeout_s` (scaled) when
  the blaster is offline or `timeout_s < 3`. `POST /v1/ir/learn/cancel` always acks.
- **D10 — fake simulation routes** (all `POST`, all answer `HwAck`; bodies optional unless marked):

  | Route | Body | Effect |
  |---|---|---|
  | `/v1/_fake/lights/by_hand` | `{gang?: "front"\|"rear" = "rear", on?: bool}` (no `on` = flip) | `lights.state`, no command |
  | `/v1/_fake/zigbee_status/node_offline` | `{friendly_name` **(required)**`, online?: bool = false}` | `zigbee.node` with `online:false` (`online:true` = back, `last_seen` now); unknown name → `{"ok":false,"error":{"code":"invalid",…}}` |
  | `/v1/_fake/zigbee_status/coordinator_offline` | `{online?: bool = false}` | `zigbee.coordinator` status `offline`/`online`; permit join then answers `device_offline` |
  | `/v1/_fake/sensors/value` | an `HwSensorReadingData` **(required)** | `sensors.reading` |
  | `/v1/_fake/ir/blaster_offline` | `{online?: bool = false}` | `ir.blaster {online:false, lqi:null}`; send → `device_offline "r101_ir is offline"`; learn → `timeout` |
  | `/v1/_fake/projector_power/meter_offline` | `{online?: bool = false}` | readings stop (the ramp continues unseen); relay → `device_offline "r101_proj_plug is offline"` |

  Fake screen: `moving`, then `raised`/`lowered` after 3 s scaled; a new move replaces the one in progress. Fake
  permit join: `zigbee.mesh {joining_until: now + seconds/scale}`, then `{joining_until: null}` when it expires;
  `seconds: 0` closes at once.
- **D11 — tests.** Module tests are self-contained: they start the service with its fake driver on a private bus and
  hit the routes through `tests/helpers.http_client(*routers)` (in-process, no registry), so T6–T13 do not depend
  on T15–T16. Time-based tests use `HW_FAKE_TIME_SCALE=1000` (`make_settings`). `GET /v1/events` is tested twice:
  the generator directly (T4) and end to end against a real uvicorn on port 0 in a thread (T17), because Starlette's
  `TestClient` never returns from an endless stream.
- **D12 — no sessions.** hw-service has no auth by design: it binds loopback only and core-api is its only client
  (ARCHITECTURE §2). CLAUDE.md's "role check + reject without a session" rule is for core-api routes; here the
  loopback guard (T16, AC6) is the access control. **No `config.access`, no session tests in this milestone.**
- **D13 — `pnpm dev`.** `pnpm run "/^dev:/"` runs `dev:apps` (the old `pnpm -r --parallel --if-present dev`) and
  `dev:hw` (uvicorn `--reload` on 127.0.0.1:8081, fake mode) in parallel.
- **D14 — Python 3.11** pinned in `services/hw/.python-version` (Pi OS Bookworm ships 3.11). uv downloads it on Arch.
- **D15 — httpx** stays the test client (D-13). Starlette 1.x warns that `TestClient` prefers `httpx2`; that one
  warning is filtered in `pyproject.toml`.

## File map

| File | Create/Modify | Responsibility |
|---|---|---|
| `services/hw/.gitkeep` | Delete | placeholder from M01 |
| `services/hw/pyproject.toml` | Create | uv project, deps, ruff (`ANN`), pytest config |
| `services/hw/.python-version` | Create | `3.11` |
| `services/hw/uv.lock` | Create (generated by `uv sync`) | locked deps |
| `services/hw/app/__init__.py`, `app/modules/__init__.py`, `app/transports/__init__.py`, `tests/__init__.py` | Create (empty) | packages |
| `services/hw/app/config.py` | Create | `Settings` (`HW_` env), node list, coordinator, fake knobs |
| `package.json` | Modify | `hw:lint`, `hw:test`, `hw:check` (in `verify`); `dev`, `dev:apps`, `dev:hw` |
| `services/hw/app/contracts.py` | Create | shared contract models, `ack_error`, `guard` |
| `services/hw/app/events.py` | Create | `EventBus`, slow-subscriber drop, `heartbeat`, `event_stream` |
| `services/hw/app/fake_support.py` | Create | `scaled()`, `FakeTasks` |
| `services/hw/app/modules/<m>/{__init__,schemas,service,driver_fake,driver_real,router}.py` × 8 | Create | one capability each (lights, hdmi, projection_screen, audio, projector_power, ir, sensors, zigbee_status) |
| `services/hw/app/snapshot.py` | Create | `HwSnapshot`, `HwSnapshotEvent`, `HwEvent` union |
| `services/hw/app/registry.py` | Create | `HW_MODE` + `HW_DRIVERS`, builds services, health, snapshot, routers, IR→projector wiring |
| `services/hw/app/main.py` | Create | `create_app`, lifespan, `/v1/health`, `/v1/snapshot`, `/v1/events`, loopback guard |
| `services/hw/app/transports/mqtt.py` | Create | `[ASSUMED]` placeholder |
| `services/hw/tests/helpers.py` | Create | `make_settings`, `next_event`, `drain`, `http_client` |
| `services/hw/tests/test_{config,contracts,events,fake_support,lights,hdmi,projection_screen,audio,projector_power,ir,sensors,zigbee_status,contract_fixtures,registry,main,events_http}.py` | Create | tests |

## Tasks

### T1 — hw project scaffold and settings
- [x] done

**Files:** delete `services/hw/.gitkeep`; create `services/hw/pyproject.toml`, `services/hw/.python-version`,
`services/hw/uv.lock` (generated), `services/hw/app/__init__.py`, `services/hw/app/config.py`,
`services/hw/tests/__init__.py`, `services/hw/tests/test_config.py`

**Context:** ARCHITECTURE §1 (layout), §7.1 (`config.py`), D-18 (ruff incl. `ANN`, no mypy), CLAUDE.md Python rules
(no hardcoded names/ports in drivers; env prefix `HW_`). Node list and coordinator defaults = `fixtures/hw/response.snapshot.json`.
`[tool.uv] package = false`: the service is not installed as a package; pytest finds `app` via `pythonpath = ["."]`.

**Do:**
1. Run `git rm -q services/hw/.gitkeep`.
2. Create `services/hw/pyproject.toml`:
```toml
[project]
name = "eduscope-hw"
version = "0.0.0"
description = "Eduscope Central hw-service: FastAPI on 127.0.0.1 only (ARCHITECTURE §7)"
requires-python = ">=3.11"
dependencies = [
    "fastapi>=0.143",
    "uvicorn>=0.54",
    "pydantic>=2.14",
    "pydantic-settings>=2.15",
    "sse-starlette>=3.5",
]

[dependency-groups]
dev = [
    "pytest>=9.1",
    "pytest-asyncio>=1.4",
    "httpx>=0.28",
    "ruff>=0.17",
]

[tool.uv]
package = false

[tool.ruff]
target-version = "py311"
line-length = 100

[tool.ruff.lint]
select = ["E", "F", "W", "I", "B", "UP", "ANN", "ASYNC", "RUF"]

[tool.pytest.ini_options]
testpaths = ["tests"]
pythonpath = ["."]
asyncio_mode = "auto"
asyncio_default_fixture_loop_scope = "function"
addopts = "--strict-markers"
markers = ["hardware: needs the real room hardware; runs only on the Pi (pytest -m hardware)"]
# Starlette 1.x prefers httpx2 for TestClient; httpx (D-13) still works.
filterwarnings = ["ignore:Using `httpx` with `starlette.testclient` is deprecated"]
```
3. Create `services/hw/.python-version`:
```text
3.11
```
4. Create empty `services/hw/app/__init__.py` and empty `services/hw/tests/__init__.py`.
5. Create `services/hw/app/config.py`:
```python
"""hw-service settings (ARCHITECTURE §7.1). Env prefix `HW_`, optional `.env` in services/hw.

Every friendly name, node and coordinator detail lives here, never in a driver.
"""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field
from pydantic_settings import BaseSettings, SettingsConfigDict

DriverKind = Literal["fake", "real"]


class ZigbeeNodeConfig(BaseModel):
    """One paired Zigbee device. The fake reports these; real drivers will read the bridge."""

    model_config = ConfigDict(extra="forbid")

    ieee: str
    friendly_name: str
    model: str
    role: Literal["router", "end_device"]
    power_source: Literal["mains", "battery"]
    lqi: int | None = Field(ge=0, le=255)
    battery_pct: int | None = Field(ge=0, le=100)


class CoordinatorConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")

    model: str
    chipset: str
    firmware: str
    channel: int = Field(ge=11, le=26)
    tx_power_dbm: float
    port: str
    antenna: str


# R-101 as in screenshot 02 and fixtures/hw/response.snapshot.json. [ASSUMED] until intake.
DEFAULT_NODES = [
    ZigbeeNodeConfig(
        ieee="0xa4c1380f2b9e0001",
        friendly_name="r101_lights",
        model="ZBM5-2C-86W",
        role="router",
        power_source="mains",
        lqi=214,
        battery_pct=None,
    ),
    ZigbeeNodeConfig(
        ieee="0xa4c1380f2b9e0002",
        friendly_name="r101_proj_plug",
        model="S60ZBTPG",
        role="router",
        power_source="mains",
        lqi=231,
        battery_pct=None,
    ),
    ZigbeeNodeConfig(
        ieee="0x00124b0029b70003",
        friendly_name="r101_temp",
        model="SNZB-02P",
        role="end_device",
        power_source="battery",
        lqi=168,
        battery_pct=98,
    ),
    ZigbeeNodeConfig(
        ieee="0x00124b0029b70004",
        friendly_name="r101_motion",
        model="SNZB-03P",
        role="end_device",
        power_source="battery",
        lqi=142,
        battery_pct=91,
    ),
    ZigbeeNodeConfig(
        ieee="0x00124b0029b70005",
        friendly_name="r101_door",
        model="SNZB-04PR2",
        role="end_device",
        power_source="battery",
        lqi=155,
        battery_pct=87,
    ),
]

DEFAULT_COORDINATOR = CoordinatorConfig(
    model="ZG-808Z",
    chipset="CC2652P1",
    firmware="Z-Stack 3.x.0",
    channel=25,
    tx_power_dbm=20,
    port="zigbee-coord",
    antenna="SMA, external",
)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="HW_", env_file=".env", extra="ignore")

    mode: DriverKind = "fake"
    # Per-module override, e.g. "lights=real,ir=fake" (D-19). Parsed by app/registry.py.
    drivers: str = ""
    # Checked by app/main.py: must be a loopback address (hw-service never listens on the LAN).
    host: str = "127.0.0.1"
    heartbeat_s: float = Field(default=5.0, gt=0)
    # Events buffered per SSE subscriber; a subscriber that falls this far behind is dropped.
    subscriber_queue: int = Field(default=256, ge=1)

    # Friendly names [ASSUMED] (ARCHITECTURE §7.1)
    lights_node: str = "r101_lights"
    proj_plug_node: str = "r101_proj_plug"
    ir_node: str = "r101_ir"
    temp_node: str = "r101_temp"
    motion_node: str = "r101_motion"
    door_node: str = "r101_door"

    zigbee_nodes: list[ZigbeeNodeConfig] = Field(default_factory=lambda: list(DEFAULT_NODES))
    coordinator: CoordinatorConfig = DEFAULT_COORDINATOR

    # Fake drivers only
    # Divides simulated durations (ramps, IR learn, screen travel, permit join). 60 = 60x faster.
    fake_time_scale: float = Field(default=1.0, gt=0)
    fake_seed: int = 101
    # Seconds between periodic power and climate readings (not scaled).
    fake_report_interval_s: float = Field(default=10.0, gt=0)
    fake_energy_kwh_total: float = Field(default=412.67, ge=0)
    # IR codes the fake projector reacts to. The on code equals fixtures/hw/request.ir.send.json.
    fake_projector_on_code: str = "C/8hRgHrBkYBgAMH"
    fake_projector_off_code: str = "C/8hRgHrBkYBgAMP"
```
6. Run `uv sync --directory services/hw` (creates `.venv` and `uv.lock`; downloads Python 3.11 if needed).

**Test:** create `services/hw/tests/test_config.py`:
```python
import pytest
from pydantic import ValidationError

from app.config import Settings


def test_defaults_are_fake_on_loopback() -> None:
    settings = Settings(_env_file=None)
    assert settings.mode == "fake"
    assert settings.host == "127.0.0.1"
    assert settings.heartbeat_s == 5.0
    assert settings.fake_time_scale == 1.0
    assert [node.friendly_name for node in settings.zigbee_nodes] == [
        "r101_lights",
        "r101_proj_plug",
        "r101_temp",
        "r101_motion",
        "r101_door",
    ]
    assert settings.coordinator.model == "ZG-808Z"


def test_reads_hw_prefixed_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("HW_MODE", "real")
    monkeypatch.setenv("HW_DRIVERS", "lights=fake")
    monkeypatch.setenv("HW_FAKE_TIME_SCALE", "60")
    monkeypatch.setenv("HW_TEMP_NODE", "r102_temp")
    settings = Settings(_env_file=None)
    assert settings.mode == "real"
    assert settings.drivers == "lights=fake"
    assert settings.fake_time_scale == 60.0
    assert settings.temp_node == "r102_temp"


def test_ignores_unprefixed_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("MODE", "real")
    assert Settings(_env_file=None).mode == "fake"


def test_node_list_comes_from_json_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv(
        "HW_ZIGBEE_NODES",
        '[{"ieee":"0x01","friendly_name":"r102_lights","model":"ZBM5-2C-86W",'
        '"role":"router","power_source":"mains","lqi":200,"battery_pct":null}]',
    )
    nodes = Settings(_env_file=None).zigbee_nodes
    assert [node.friendly_name for node in nodes] == ["r102_lights"]


def test_rejects_bad_values() -> None:
    with pytest.raises(ValidationError):
        Settings(_env_file=None, mode="simulated")
    with pytest.raises(ValidationError):
        Settings(_env_file=None, fake_time_scale=0)
```

**Verify:** `uv run --directory services/hw pytest tests/test_config.py -q` → `5 passed`.
`uv run --directory services/hw ruff check . && uv run --directory services/hw ruff format --check .` → `All checks
passed!` and `… files already formatted`. `pnpm verify` → green (hw:check is still the M01 no-op until T2).

**Commit:** `git add services/hw docs/plans/PLAN-M07-hw-service-skeleton.md && git commit -m "chore(hw): uv project and settings"`

---

### T2 — Root `hw:*` scripts run ruff and pytest inside `pnpm verify`
- [x] done

**Files:** `package.json`

**Context:** ARCHITECTURE §8 ("The one command"): `hw:check = ruff check && ruff format --check && pytest -m "not
hardware"`. `verify` already ends with `pnpm hw:check`; only the three `hw:*` scripts change.

**Do:**
1. In `package.json` replace:
```json
    "hw:check": "node -e \"console.log('hw:check: no-op until M07 (ruff + pytest)')\"",
    "hw:lint": "node -e \"console.log('hw:lint: no-op until M07')\"",
    "hw:test": "node -e \"console.log('hw:test: no-op until M07')\"",
```
with:
```json
    "hw:check": "pnpm hw:lint && pnpm hw:test",
    "hw:lint": "uv run --directory services/hw ruff check . && uv run --directory services/hw ruff format --check .",
    "hw:test": "uv run --directory services/hw pytest -m \"not hardware\"",
```

**Verify:** `pnpm hw:check` → ruff `All checks passed!`, `… files already formatted`, pytest `5 passed`.
`pnpm verify` → exit 0 and the output now ends with the pytest summary.

**Commit:** `git commit -am "chore: wire hw ruff and pytest into pnpm verify"`

---

### T3 — Shared contract models (`app/contracts.py`)
- [x] done

**Files:** `services/hw/app/contracts.py`, `services/hw/tests/test_contracts.py`

**Context:** mirrors `packages/contracts/src/hw/common.ts` (`HwModule`, `HwDriverKind`, `HwErrorCode`, `HwError`,
`HwAck`, `HwHealth`) and `data.ts` (`HwErrorData`, `HwHeartbeatData`); D2, D3, D4. `guard()` is how every service
calls its driver: a `NotImplementedError` (intake stub) or any other exception becomes a `transport` ack.

**Do:**
1. Create `services/hw/app/contracts.py`:
```python
"""Shared hw contract pieces. Mirrors packages/contracts/src/hw/common.ts and the hw parts of
packages/contracts/src/common.ts (Level, Timestamp). Field names are identical to zod.
"""

import logging
from collections.abc import Awaitable
from datetime import UTC, datetime
from typing import Annotated, Literal

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field

logger = logging.getLogger("hw")

INTAKE_PENDING = "hardware intake pending"


def utc_now() -> datetime:
    return datetime.now(UTC)


class HwModel(BaseModel):
    """Base of every contract model: unknown fields are rejected, like zod strictObject."""

    model_config = ConfigDict(extra="forbid")


Timestamp = AwareDatetime
Level = Annotated[int, Field(ge=0, le=100)]

HwModule = Literal[
    "lights",
    "projector_power",
    "ir",
    "hdmi",
    "projection_screen",
    "audio",
    "sensors",
    "zigbee_status",
]
HwDriverKind = Literal["fake", "real"]
HwErrorCode = Literal["device_offline", "timeout", "transport", "invalid"]


class HwError(HwModel):
    code: HwErrorCode
    message: str


class HwAckOk(HwModel):
    ok: Literal[True]


class HwAckError(HwModel):
    ok: Literal[False]
    error: HwError


# "Accepted by the transport", not "state changed". State changes arrive only as events.
HwAck = Annotated[HwAckOk | HwAckError, Field(discriminator="ok")]

ACK_OK = HwAckOk(ok=True)


def ack_error(code: HwErrorCode, message: str) -> HwAckError:
    return HwAckError(ok=False, error=HwError(code=code, message=message))


class HwHealthModules(HwModel):
    lights: HwDriverKind
    projector_power: HwDriverKind
    ir: HwDriverKind
    hdmi: HwDriverKind
    projection_screen: HwDriverKind
    audio: HwDriverKind
    sensors: HwDriverKind
    zigbee_status: HwDriverKind


class HwHealth(HwModel):
    ok: bool
    mode: HwDriverKind
    modules: HwHealthModules


class HwEnvelope(HwModel):
    """Base of every SSE event `{type, at, data}`. Subclasses narrow `type` and add `data`."""

    type: str
    at: Timestamp = Field(default_factory=utc_now)


class HwErrorData(HwModel):
    module: HwModule
    code: HwErrorCode
    message: str


class HwHeartbeatData(HwModel):
    pass


class HwErrorEvent(HwEnvelope):
    type: Literal["hw.error"] = "hw.error"
    data: HwErrorData


class HwHeartbeatEvent(HwEnvelope):
    type: Literal["heartbeat"] = "heartbeat"
    data: HwHeartbeatData = Field(default_factory=HwHeartbeatData)


async def guard(module: HwModule, command: Awaitable[HwAck]) -> HwAck:
    """Await a driver command; a driver exception becomes a `transport` ack instead of a 500."""
    try:
        return await command
    except NotImplementedError as exc:
        return ack_error("transport", f"{module}: {exc}")
    except Exception as exc:
        logger.exception("%s driver failed", module)
        return ack_error("transport", f"{module}: {type(exc).__name__}: {exc}")
```

**Test:** create `services/hw/tests/test_contracts.py`:
```python
from datetime import UTC

import pytest
from pydantic import TypeAdapter, ValidationError

from app.contracts import (
    ACK_OK,
    HwAck,
    HwAckError,
    HwAckOk,
    HwError,
    HwHeartbeatEvent,
    ack_error,
    guard,
)

ack = TypeAdapter(HwAck)


def test_ack_parses_both_variants() -> None:
    assert ack.validate_python({"ok": True}) == HwAckOk(ok=True)
    parsed = ack.validate_python({"ok": False, "error": {"code": "timeout", "message": "late"}})
    assert parsed == HwAckError(ok=False, error=HwError(code="timeout", message="late"))


def test_models_reject_unknown_fields() -> None:
    with pytest.raises(ValidationError):
        ack.validate_python({"ok": True, "extra": 1})


def test_ack_error_builds_the_wire_shape() -> None:
    assert ack_error("device_offline", "r101_lights is offline").model_dump() == {
        "ok": False,
        "error": {"code": "device_offline", "message": "r101_lights is offline"},
    }


def test_envelope_stamps_aware_utc_time() -> None:
    event = HwHeartbeatEvent()
    assert event.at.tzinfo is UTC
    dumped = event.model_dump(mode="json")
    assert dumped["type"] == "heartbeat"
    assert dumped["data"] == {}
    assert dumped["at"].endswith("Z")


async def test_guard_passes_acks_through() -> None:
    async def ok() -> HwAckOk:
        return ACK_OK

    assert await guard("lights", ok()) == ACK_OK


async def test_guard_turns_intake_stub_into_transport_error() -> None:
    async def stub() -> HwAckOk:
        raise NotImplementedError("hardware intake pending")

    assert await guard("lights", stub()) == ack_error(
        "transport", "lights: hardware intake pending"
    )


async def test_guard_turns_driver_crash_into_transport_error() -> None:
    async def broken() -> HwAckOk:
        raise RuntimeError("serial port gone")

    assert await guard("hdmi", broken()) == ack_error(
        "transport", "hdmi: RuntimeError: serial port gone"
    )
```

**Verify:** `uv run --directory services/hw pytest tests/test_contracts.py -q` → `7 passed`; `pnpm verify` green.

**Commit:** `git add services/hw docs/plans/PLAN-M07-hw-service-skeleton.md && git commit -m "feat(hw): shared contract models and driver guard"`

---

### T4 — Event bus, heartbeat and the SSE generator (`app/events.py`)
- [x] done

**Files:** `services/hw/app/events.py`, `services/hw/tests/helpers.py`, `services/hw/tests/test_events.py`

**Context:** ARCHITECTURE §3.4 (first event is always `snapshot`; SSE `event:` = `type`; `heartbeat` every 5 s), §7.1
(per-subscriber bounded queue; a slow subscriber is dropped and must reconnect). `HW_SUBSCRIBER_QUEUE` (default 256)
is the queue size. Dropping = empty the queue and put `None`, which ends that client's stream. `tests/helpers.py` is
the shared test toolbox used by every later test file (D11).

**Do:**
1. Create `services/hw/app/events.py`:
```python
"""In-process event bus and the SSE stream behind GET /v1/events (ARCHITECTURE §3.4, §7.1)."""

import asyncio
from collections.abc import AsyncIterator, Callable

from sse_starlette import ServerSentEvent

from app.contracts import HwEnvelope, HwHeartbeatEvent, logger


class Subscription:
    """One SSE client. `None` in the queue means "you were dropped, close the stream"."""

    def __init__(self, maxsize: int) -> None:
        self.queue: asyncio.Queue[HwEnvelope | None] = asyncio.Queue(maxsize=maxsize)


class EventBus:
    def __init__(self, queue_size: int) -> None:
        self._queue_size = queue_size
        self._subscribers: set[Subscription] = set()

    @property
    def subscriber_count(self) -> int:
        return len(self._subscribers)

    def subscribe(self) -> Subscription:
        sub = Subscription(self._queue_size)
        self._subscribers.add(sub)
        return sub

    def unsubscribe(self, sub: Subscription) -> None:
        self._subscribers.discard(sub)

    def publish(self, event: HwEnvelope) -> None:
        for sub in list(self._subscribers):
            try:
                sub.queue.put_nowait(event)
            except asyncio.QueueFull:
                self._drop(sub)

    def _drop(self, sub: Subscription) -> None:
        """A slow subscriber is disconnected; its client reconnects and gets a fresh snapshot."""
        self._subscribers.discard(sub)
        while not sub.queue.empty():
            sub.queue.get_nowait()
        sub.queue.put_nowait(None)
        logger.warning("events: dropped a slow subscriber (%d queued)", self._queue_size)


async def heartbeat(bus: EventBus, interval_s: float) -> None:
    """Publishes `heartbeat` every `interval_s` until cancelled (lifespan task)."""
    while True:
        await asyncio.sleep(interval_s)
        bus.publish(HwHeartbeatEvent())


def to_sse(event: HwEnvelope) -> ServerSentEvent:
    return ServerSentEvent(event=event.type, data=event.model_dump_json())


async def event_stream(
    bus: EventBus, snapshot: Callable[[], HwEnvelope]
) -> AsyncIterator[ServerSentEvent]:
    """`snapshot` first, then every bus event, until the client leaves or is dropped.

    Subscribing and building the snapshot happen without an `await` in between, so no event can
    fall between the snapshot and the first queued event.
    """
    sub = bus.subscribe()
    try:
        yield to_sse(snapshot())
        while True:
            event = await sub.queue.get()
            if event is None:
                return
            yield to_sse(event)
    finally:
        bus.unsubscribe(sub)
```
2. Create `services/hw/tests/helpers.py`:
```python
"""Shared test helpers: settings without env/.env surprises, event waiting, an in-process client."""

import asyncio
from typing import TypeVar

import httpx
from fastapi import APIRouter, FastAPI

from app.config import Settings
from app.contracts import HwEnvelope
from app.events import Subscription

E = TypeVar("E", bound=HwEnvelope)


def make_settings(**overrides: object) -> Settings:
    """Fast fake time (1000x), periodic readings and heartbeat effectively off unless overridden."""
    values: dict[str, object] = {
        "mode": "fake",
        "drivers": "",
        "host": "127.0.0.1",
        "fake_time_scale": 1000.0,
        "fake_report_interval_s": 3600.0,
        "heartbeat_s": 3600.0,
        **overrides,
    }
    return Settings(_env_file=None, **values)


async def next_event(sub: Subscription, cls: type[E], within: float = 1.0) -> E:
    """The next queued event of type `cls` (others are skipped)."""
    async with asyncio.timeout(within):
        while True:
            event = await sub.queue.get()
            assert event is not None, "subscription was dropped"
            if isinstance(event, cls):
                return event


def drain(sub: Subscription) -> list[HwEnvelope]:
    """Everything queued right now, without waiting."""
    events: list[HwEnvelope] = []
    while not sub.queue.empty():
        event = sub.queue.get_nowait()
        if event is not None:
            events.append(event)
    return events


def http_client(*routers: APIRouter) -> httpx.AsyncClient:
    """An in-process client for just these routers (no lifespan: start services yourself)."""
    app = FastAPI()
    for router in routers:
        app.include_router(router)
    return httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://hw")
```

**Test:** create `services/hw/tests/test_events.py`:
```python
import asyncio
from typing import Literal

from app.contracts import HwEnvelope, HwHeartbeatEvent
from app.events import EventBus, event_stream, heartbeat, to_sse
from tests.helpers import next_event


class FakeSnapshotEvent(HwEnvelope):
    type: Literal["snapshot"] = "snapshot"


def test_publish_reaches_every_subscriber() -> None:
    bus = EventBus(8)
    first, second = bus.subscribe(), bus.subscribe()
    event = HwHeartbeatEvent()
    bus.publish(event)
    assert first.queue.get_nowait() is event
    assert second.queue.get_nowait() is event


def test_unsubscribe_stops_delivery() -> None:
    bus = EventBus(8)
    sub = bus.subscribe()
    bus.unsubscribe(sub)
    bus.publish(HwHeartbeatEvent())
    assert sub.queue.empty()
    assert bus.subscriber_count == 0


def test_slow_subscriber_is_dropped_others_keep_going() -> None:
    bus = EventBus(2)
    slow, fast = bus.subscribe(), bus.subscribe()
    for _ in range(2):
        bus.publish(HwHeartbeatEvent())
    fast.queue.get_nowait()
    fast.queue.get_nowait()
    bus.publish(HwHeartbeatEvent())  # slow is full → dropped
    assert bus.subscriber_count == 1
    assert slow.queue.get_nowait() is None
    assert slow.queue.empty()
    assert isinstance(fast.queue.get_nowait(), HwHeartbeatEvent)


async def test_heartbeat_publishes_on_its_interval() -> None:
    bus = EventBus(8)
    sub = bus.subscribe()
    task = asyncio.create_task(heartbeat(bus, 0.01))
    try:
        await next_event(sub, HwHeartbeatEvent)
        await next_event(sub, HwHeartbeatEvent)
    finally:
        task.cancel()


def test_to_sse_uses_type_as_event_name() -> None:
    event = HwHeartbeatEvent()
    sse = to_sse(event)
    assert sse.event == "heartbeat"
    assert sse.data == event.model_dump_json()


async def test_stream_sends_snapshot_first_then_bus_events() -> None:
    bus = EventBus(8)
    stream = event_stream(bus, FakeSnapshotEvent)
    first = await anext(stream)
    assert first.event == "snapshot"
    assert bus.subscriber_count == 1
    bus.publish(HwHeartbeatEvent())
    second = await anext(stream)
    assert second.event == "heartbeat"
    await stream.aclose()
    assert bus.subscriber_count == 0


async def test_stream_ends_when_its_subscriber_is_dropped() -> None:
    bus = EventBus(1)
    stream = event_stream(bus, FakeSnapshotEvent)
    await anext(stream)
    bus.publish(HwHeartbeatEvent())
    bus.publish(HwHeartbeatEvent())  # queue of 1 overflows → dropped
    assert [item async for item in stream] == []
    assert bus.subscriber_count == 0
```

**Verify:** `uv run --directory services/hw pytest tests/test_events.py -q` → `7 passed`; `pnpm verify` green.

**Commit:** `git add services/hw docs/plans/PLAN-M07-hw-service-skeleton.md && git commit -m "feat(hw): event bus with bounded subscriber queues and heartbeat"`

---

### T5 — Fake-driver support: scaled time and owned tasks
- [x] done

**Files:** `services/hw/app/fake_support.py`, `services/hw/tests/test_fake_support.py`

**Context:** D6. Fake drivers with timers (projector ramp + periodic readings, screen travel, sensors, permit join)
own their asyncio tasks through `FakeTasks` and cancel them in `stop()`, so the lifespan shuts down cleanly.

**Do:**
1. Create `services/hw/app/fake_support.py`:
```python
"""Helpers shared by the fake drivers: scaled time and owned background tasks."""

import asyncio
from collections.abc import Coroutine
from typing import Any

from app.config import Settings


def scaled(settings: Settings, seconds: float) -> float:
    """A simulated duration in real seconds (`HW_FAKE_TIME_SCALE=60` makes 60 s take 1 s)."""
    return seconds / settings.fake_time_scale


class FakeTasks:
    """Background tasks owned by one fake driver; `cancel_all()` runs on driver stop."""

    def __init__(self) -> None:
        self._tasks: set[asyncio.Task[None]] = set()

    def spawn(self, coro: Coroutine[Any, Any, None]) -> asyncio.Task[None]:
        task = asyncio.create_task(coro)
        self._tasks.add(task)
        task.add_done_callback(self._tasks.discard)
        return task

    async def cancel_all(self) -> None:
        tasks = list(self._tasks)
        for task in tasks:
            task.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)
```

**Test:** create `services/hw/tests/test_fake_support.py`:
```python
import asyncio

from app.fake_support import FakeTasks, scaled
from tests.helpers import make_settings


def test_scaled_divides_by_the_time_scale() -> None:
    assert scaled(make_settings(fake_time_scale=60.0), 120.0) == 2.0
    assert scaled(make_settings(fake_time_scale=1.0), 3.0) == 3.0


async def test_cancel_all_stops_running_tasks() -> None:
    tasks = FakeTasks()
    task = tasks.spawn(asyncio.sleep(60))
    await tasks.cancel_all()
    assert task.cancelled()


async def test_finished_tasks_are_forgotten() -> None:
    tasks = FakeTasks()
    await tasks.spawn(asyncio.sleep(0))
    await tasks.cancel_all()  # nothing left to cancel, must not raise
```

**Verify:** `uv run --directory services/hw pytest tests/test_fake_support.py -q` → `3 passed`; `pnpm verify` green.

**Commit:** `git add services/hw docs/plans/PLAN-M07-hw-service-skeleton.md && git commit -m "feat(hw): fake driver time scale and task helpers"`

---

### T6 — `lights` module (set gang, `lights.state`, by-hand route)
- [x] done

**Files:** `services/hw/app/modules/__init__.py` (empty), `services/hw/app/modules/lights/{__init__,schemas,service,driver_real,driver_fake,router}.py`,
`services/hw/tests/test_lights.py`

**Context:** ARCHITECTURE §3.4 (`POST /v1/lights/set` → `HwAck`; event `lights.state {gang, on}`), §7.1 module
pattern, §7.2 row `lights` (`[ASSUMED]` ZBM5-2C-86W). zod: `HwLightsSetRequest`, `HwLightsStateData`, snapshot
`lights: {front, rear}` (nullable). D1, D4, D8, D10 (`by_hand`, used by M08 AC2 with no body). This is the
reference module: T7–T13 follow exactly the same shape.

**Do:**
1. Create empty `services/hw/app/modules/__init__.py` and empty `services/hw/app/modules/lights/__init__.py`.
2. Create `services/hw/app/modules/lights/schemas.py`:
```python
"""lights contract. Mirrors packages/contracts/src/hw (HwLightsSetRequest, HwLightsStateData)."""

from typing import Literal

from app.contracts import HwEnvelope, HwModel

LightGang = Literal["front", "rear"]


class HwLightsSetRequest(HwModel):
    gang: LightGang
    on: bool


class HwLightsStateData(HwModel):
    gang: LightGang
    on: bool


class HwLightsStateEvent(HwEnvelope):
    type: Literal["lights.state"] = "lights.state"
    data: HwLightsStateData


class HwLightsSnapshot(HwModel):
    """HwSnapshot.lights. None = not reported yet."""

    front: bool | None
    rear: bool | None
```
3. Create `services/hw/app/modules/lights/service.py`:
```python
"""lights: two wall-switch gangs (ARCHITECTURE §7.2)."""

from collections.abc import Callable
from typing import Protocol

from app.contracts import HwAck, HwDriverKind, guard
from app.events import EventBus
from app.modules.lights.schemas import HwLightsSetRequest, HwLightsSnapshot, HwLightsStateEvent

LightsEmit = Callable[[HwLightsStateEvent], None]


class LightsDriver(Protocol):
    kind: HwDriverKind

    async def start(self, emit: LightsEmit) -> None: ...

    async def stop(self) -> None: ...

    async def set(self, request: HwLightsSetRequest) -> HwAck: ...


class LightsService:
    def __init__(self, driver: LightsDriver, bus: EventBus) -> None:
        self.driver = driver
        self._bus = bus
        self._state = HwLightsSnapshot(front=None, rear=None)

    async def start(self) -> None:
        await self.driver.start(self._on_event)

    async def stop(self) -> None:
        await self.driver.stop()

    def snapshot(self) -> HwLightsSnapshot:
        return self._state.model_copy()

    async def set(self, request: HwLightsSetRequest) -> HwAck:
        return await guard("lights", self.driver.set(request))

    def _on_event(self, event: HwLightsStateEvent) -> None:
        self._state = self._state.model_copy(update={event.data.gang: event.data.on})
        self._bus.publish(event)
```
4. Create `services/hw/app/modules/lights/driver_real.py`:
```python
"""Real lights driver: stub until hardware intake.

[ASSUMED] ZBM5-2C-86W via zigbee2mqtt `state_l1` / `state_l2` (ARCHITECTURE §7.2).
"""

from app.config import Settings
from app.contracts import INTAKE_PENDING, HwAck, HwDriverKind
from app.modules.lights.schemas import HwLightsSetRequest
from app.modules.lights.service import LightsEmit


class RealLightsDriver:
    kind: HwDriverKind = "real"

    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    async def start(self, emit: LightsEmit) -> None:
        """Nothing to start before intake; the module reports nothing (snapshot stays null)."""

    async def stop(self) -> None:
        """Nothing to stop."""

    async def set(self, request: HwLightsSetRequest) -> HwAck:
        raise NotImplementedError(INTAKE_PENDING)
```
5. Create `services/hw/app/modules/lights/driver_fake.py`:
```python
"""Fake lights: in-memory gangs that echo every change as `lights.state`."""

from fastapi import APIRouter

from app.config import Settings
from app.contracts import ACK_OK, HwAck, HwAckOk, HwDriverKind, HwModel
from app.modules.lights.schemas import (
    HwLightsSetRequest,
    HwLightsStateData,
    HwLightsStateEvent,
    LightGang,
)
from app.modules.lights.service import LightsEmit


class FakeLightsDriver:
    kind: HwDriverKind = "fake"

    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._on: dict[LightGang, bool] = {"front": True, "rear": False}  # screenshot 01
        self._emit: LightsEmit | None = None

    async def start(self, emit: LightsEmit) -> None:
        self._emit = emit
        self._report("front")
        self._report("rear")

    async def stop(self) -> None:
        self._emit = None

    async def set(self, request: HwLightsSetRequest) -> HwAck:
        self._on[request.gang] = request.on
        self._report(request.gang)
        return ACK_OK

    def by_hand(self, gang: LightGang, on: bool | None) -> None:
        """Someone used the wall switch: no command, just a state event."""
        self._on[gang] = (not self._on[gang]) if on is None else on
        self._report(gang)

    def _report(self, gang: LightGang) -> None:
        if self._emit is not None:
            self._emit(HwLightsStateEvent(data=HwLightsStateData(gang=gang, on=self._on[gang])))


class FakeByHandRequest(HwModel):
    gang: LightGang = "rear"
    on: bool | None = None  # None = flip the gang


def build_fake_router(driver: FakeLightsDriver) -> APIRouter:
    router = APIRouter(prefix="/v1/_fake/lights", tags=["fake"])

    @router.post("/by_hand")
    async def by_hand(body: FakeByHandRequest | None = None) -> HwAckOk:
        request = body or FakeByHandRequest()
        driver.by_hand(request.gang, request.on)
        return ACK_OK

    return router
```
6. Create `services/hw/app/modules/lights/router.py`:
```python
from fastapi import APIRouter

from app.contracts import HwAck
from app.modules.lights.schemas import HwLightsSetRequest
from app.modules.lights.service import LightsService


def build_router(service: LightsService) -> APIRouter:
    router = APIRouter(prefix="/v1/lights", tags=["lights"])

    @router.post("/set")
    async def set_gang(body: HwLightsSetRequest) -> HwAck:
        return await service.set(body)

    return router
```

**Test:** create `services/hw/tests/test_lights.py`:
```python
from app.contracts import ACK_OK, ack_error
from app.events import EventBus, Subscription
from app.modules.lights.driver_fake import FakeLightsDriver, build_fake_router
from app.modules.lights.driver_real import RealLightsDriver
from app.modules.lights.router import build_router
from app.modules.lights.schemas import (
    HwLightsSetRequest,
    HwLightsSnapshot,
    HwLightsStateData,
    HwLightsStateEvent,
)
from app.modules.lights.service import LightsService
from tests.helpers import drain, http_client, make_settings, next_event


async def start_fake() -> tuple[LightsService, FakeLightsDriver, Subscription]:
    bus = EventBus(64)
    sub = bus.subscribe()
    driver = FakeLightsDriver(make_settings())
    service = LightsService(driver, bus)
    await service.start()
    return service, driver, sub


async def test_fake_reports_both_gangs_on_start() -> None:
    service, _, sub = await start_fake()
    assert [e.data for e in drain(sub) if isinstance(e, HwLightsStateEvent)] == [
        HwLightsStateData(gang="front", on=True),
        HwLightsStateData(gang="rear", on=False),
    ]
    assert service.snapshot() == HwLightsSnapshot(front=True, rear=False)


async def test_set_is_acked_and_echoed_as_state() -> None:
    service, _, sub = await start_fake()
    drain(sub)
    assert await service.set(HwLightsSetRequest(gang="rear", on=True)) == ACK_OK
    event = await next_event(sub, HwLightsStateEvent)
    assert event.data == HwLightsStateData(gang="rear", on=True)
    assert service.snapshot() == HwLightsSnapshot(front=True, rear=True)


async def test_by_hand_flips_a_gang_without_a_command() -> None:
    service, driver, sub = await start_fake()
    drain(sub)
    driver.by_hand("front", None)
    assert (await next_event(sub, HwLightsStateEvent)).data == HwLightsStateData(
        gang="front", on=False
    )
    driver.by_hand("front", False)  # explicit value, no flip
    assert (await next_event(sub, HwLightsStateEvent)).data.on is False
    assert service.snapshot().front is False


async def test_real_driver_answers_transport_error_and_reports_nothing() -> None:
    service = LightsService(RealLightsDriver(make_settings()), EventBus(8))
    await service.start()
    ack = await service.set(HwLightsSetRequest(gang="rear", on=True))
    assert ack == ack_error("transport", "lights: hardware intake pending")
    assert service.snapshot() == HwLightsSnapshot(front=None, rear=None)


async def test_routes() -> None:
    service, driver, _ = await start_fake()
    async with http_client(build_router(service), build_fake_router(driver)) as http:
        ok = await http.post("/v1/lights/set", json={"gang": "rear", "on": True})
        assert ok.status_code == 200
        assert ok.json() == {"ok": True}
        assert (await http.post("/v1/lights/set", json={"gang": "middle"})).status_code == 422
        by_hand = await http.post("/v1/_fake/lights/by_hand")  # no body: flip rear
        assert by_hand.json() == {"ok": True}
    assert service.snapshot() == HwLightsSnapshot(front=True, rear=False)
```

**Verify:** `uv run --directory services/hw pytest tests/test_lights.py -q` → `5 passed`; `pnpm verify` green.
**[ON PI]** not applicable: `RealLightsDriver` is an intake stub (Hxx writes it and its Pi check).

**Commit:** `git add services/hw docs/plans/PLAN-M07-hw-service-skeleton.md && git commit -m "feat(hw): lights module with fake driver"`

---

### T7 — `hdmi` module (select input, `hdmi.state`)
- [x] done

**Files:** `services/hw/app/modules/hdmi/{__init__,schemas,service,driver_real,driver_fake,router}.py`, `services/hw/tests/test_hdmi.py`

**Context:** §3.4 `POST /v1/hdmi/select {input: podium_pc|smart_board}`; event `hdmi.state {input}`; §7.2 (`[ASSUMED]`
serial, read-back unknown Q1). Same shape as T6. No simulation route (D10).

**Do:**
1. Create empty `services/hw/app/modules/hdmi/__init__.py`.
2. Create `services/hw/app/modules/hdmi/schemas.py`:
```python
"""hdmi contract. Mirrors packages/contracts/src/hw (HwHdmiSelectRequest, HwHdmiStateData)."""

from typing import Literal

from app.contracts import HwEnvelope, HwModel

HdmiInput = Literal["podium_pc", "smart_board"]


class HwHdmiSelectRequest(HwModel):
    input: HdmiInput


class HwHdmiStateData(HwModel):
    input: HdmiInput


class HwHdmiStateEvent(HwEnvelope):
    type: Literal["hdmi.state"] = "hdmi.state"
    data: HwHdmiStateData


class HwHdmiSnapshot(HwModel):
    """HwSnapshot.hdmi. None = not reported yet."""

    input: HdmiInput | None
```
3. Create `services/hw/app/modules/hdmi/service.py`:
```python
"""hdmi: the projector's input switch (ARCHITECTURE §7.2)."""

from collections.abc import Callable
from typing import Protocol

from app.contracts import HwAck, HwDriverKind, guard
from app.events import EventBus
from app.modules.hdmi.schemas import HwHdmiSelectRequest, HwHdmiSnapshot, HwHdmiStateEvent

HdmiEmit = Callable[[HwHdmiStateEvent], None]


class HdmiDriver(Protocol):
    kind: HwDriverKind

    async def start(self, emit: HdmiEmit) -> None: ...

    async def stop(self) -> None: ...

    async def select(self, request: HwHdmiSelectRequest) -> HwAck: ...


class HdmiService:
    def __init__(self, driver: HdmiDriver, bus: EventBus) -> None:
        self.driver = driver
        self._bus = bus
        self._state = HwHdmiSnapshot(input=None)

    async def start(self) -> None:
        await self.driver.start(self._on_event)

    async def stop(self) -> None:
        await self.driver.stop()

    def snapshot(self) -> HwHdmiSnapshot:
        return self._state.model_copy()

    async def select(self, request: HwHdmiSelectRequest) -> HwAck:
        return await guard("hdmi", self.driver.select(request))

    def _on_event(self, event: HwHdmiStateEvent) -> None:
        self._state = HwHdmiSnapshot(input=event.data.input)
        self._bus.publish(event)
```
4. Create `services/hw/app/modules/hdmi/driver_real.py`:
```python
"""Real HDMI switch driver: stub until hardware intake.

[ASSUMED] Model and read-back unknown (Q1); serial (ARCHITECTURE §7.2).
"""

from app.config import Settings
from app.contracts import INTAKE_PENDING, HwAck, HwDriverKind
from app.modules.hdmi.schemas import HwHdmiSelectRequest
from app.modules.hdmi.service import HdmiEmit


class RealHdmiDriver:
    kind: HwDriverKind = "real"

    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    async def start(self, emit: HdmiEmit) -> None:
        """Nothing to start before intake; the module reports nothing (snapshot stays null)."""

    async def stop(self) -> None:
        """Nothing to stop."""

    async def select(self, request: HwHdmiSelectRequest) -> HwAck:
        raise NotImplementedError(INTAKE_PENDING)
```
5. Create `services/hw/app/modules/hdmi/driver_fake.py`:
```python
"""Fake HDMI switch: echoes every selection as `hdmi.state`. No simulation routes."""

from app.config import Settings
from app.contracts import ACK_OK, HwAck, HwDriverKind
from app.modules.hdmi.schemas import (
    HdmiInput,
    HwHdmiSelectRequest,
    HwHdmiStateData,
    HwHdmiStateEvent,
)
from app.modules.hdmi.service import HdmiEmit


class FakeHdmiDriver:
    kind: HwDriverKind = "fake"

    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._input: HdmiInput = "podium_pc"  # screenshot 01
        self._emit: HdmiEmit | None = None

    async def start(self, emit: HdmiEmit) -> None:
        self._emit = emit
        self._report()

    async def stop(self) -> None:
        self._emit = None

    async def select(self, request: HwHdmiSelectRequest) -> HwAck:
        self._input = request.input
        self._report()
        return ACK_OK

    def _report(self) -> None:
        if self._emit is not None:
            self._emit(HwHdmiStateEvent(data=HwHdmiStateData(input=self._input)))
```
6. Create `services/hw/app/modules/hdmi/router.py`:
```python
from fastapi import APIRouter

from app.contracts import HwAck
from app.modules.hdmi.schemas import HwHdmiSelectRequest
from app.modules.hdmi.service import HdmiService


def build_router(service: HdmiService) -> APIRouter:
    router = APIRouter(prefix="/v1/hdmi", tags=["hdmi"])

    @router.post("/select")
    async def select(body: HwHdmiSelectRequest) -> HwAck:
        return await service.select(body)

    return router
```

**Test:** create `services/hw/tests/test_hdmi.py`:
```python
from app.contracts import ACK_OK, ack_error
from app.events import EventBus, Subscription
from app.modules.hdmi.driver_fake import FakeHdmiDriver
from app.modules.hdmi.driver_real import RealHdmiDriver
from app.modules.hdmi.router import build_router
from app.modules.hdmi.schemas import HwHdmiSelectRequest, HwHdmiSnapshot, HwHdmiStateEvent
from app.modules.hdmi.service import HdmiService
from tests.helpers import drain, http_client, make_settings, next_event


async def start_fake() -> tuple[HdmiService, Subscription]:
    bus = EventBus(64)
    sub = bus.subscribe()
    service = HdmiService(FakeHdmiDriver(make_settings()), bus)
    await service.start()
    return service, sub


async def test_fake_starts_on_podium_pc() -> None:
    service, _ = await start_fake()
    assert service.snapshot() == HwHdmiSnapshot(input="podium_pc")


async def test_select_is_echoed_as_state() -> None:
    service, sub = await start_fake()
    drain(sub)
    assert await service.select(HwHdmiSelectRequest(input="smart_board")) == ACK_OK
    assert (await next_event(sub, HwHdmiStateEvent)).data.input == "smart_board"
    assert service.snapshot() == HwHdmiSnapshot(input="smart_board")


async def test_real_driver_answers_transport_error() -> None:
    service = HdmiService(RealHdmiDriver(make_settings()), EventBus(8))
    await service.start()
    ack = await service.select(HwHdmiSelectRequest(input="smart_board"))
    assert ack == ack_error("transport", "hdmi: hardware intake pending")
    assert service.snapshot() == HwHdmiSnapshot(input=None)


async def test_route() -> None:
    service, _ = await start_fake()
    async with http_client(build_router(service)) as http:
        ok = await http.post("/v1/hdmi/select", json={"input": "smart_board"})
        assert ok.json() == {"ok": True}
        assert (await http.post("/v1/hdmi/select", json={"input": "vga"})).status_code == 422
```

**Verify:** `uv run --directory services/hw pytest tests/test_hdmi.py -q` → `4 passed`; `pnpm verify` green.

**Commit:** `git add services/hw docs/plans/PLAN-M07-hw-service-skeleton.md && git commit -m "feat(hw): hdmi module with fake driver"`

---

### T8 — `projection_screen` module (raise/lower, `projection_screen.state`)
- [x] done

**Files:** `services/hw/app/modules/projection_screen/{__init__,schemas,service,driver_real,driver_fake,router}.py`,
`services/hw/tests/test_projection_screen.py`

**Context:** §3.4 `POST /v1/projection_screen/move {to: raise|lower}`; event `projection_screen.state {position:
raised|lowered|moving|unknown}`; snapshot position is never null ("unknown" until reported). §7.2 (`[ASSUMED]` relay or
IR, position source unknown Q2). D10: `moving`, then the end position after `TRAVEL_S` = 3 s scaled.

**Do:**
1. Create empty `services/hw/app/modules/projection_screen/__init__.py`.
2. Create `services/hw/app/modules/projection_screen/schemas.py`:
```python
"""projection_screen contract. Mirrors packages/contracts/src/hw (HwProjectionScreenMoveRequest,
HwScreenStateData, HwScreenPosition)."""

from typing import Literal

from app.contracts import HwEnvelope, HwModel

HwScreenPosition = Literal["raised", "lowered", "moving", "unknown"]


class HwProjectionScreenMoveRequest(HwModel):
    to: Literal["raise", "lower"]


class HwScreenStateData(HwModel):
    position: HwScreenPosition


class HwProjectionScreenStateEvent(HwEnvelope):
    type: Literal["projection_screen.state"] = "projection_screen.state"
    data: HwScreenStateData


class HwProjectionScreenSnapshot(HwModel):
    """HwSnapshot.projection_screen. "unknown" = not reported yet."""

    position: HwScreenPosition
```
3. Create `services/hw/app/modules/projection_screen/service.py`:
```python
"""projection_screen: motorised screen, raise/lower (ARCHITECTURE §7.2)."""

from collections.abc import Callable
from typing import Protocol

from app.contracts import HwAck, HwDriverKind, guard
from app.events import EventBus
from app.modules.projection_screen.schemas import (
    HwProjectionScreenMoveRequest,
    HwProjectionScreenSnapshot,
    HwProjectionScreenStateEvent,
)

ScreenEmit = Callable[[HwProjectionScreenStateEvent], None]


class ProjectionScreenDriver(Protocol):
    kind: HwDriverKind

    async def start(self, emit: ScreenEmit) -> None: ...

    async def stop(self) -> None: ...

    async def move(self, request: HwProjectionScreenMoveRequest) -> HwAck: ...


class ProjectionScreenService:
    def __init__(self, driver: ProjectionScreenDriver, bus: EventBus) -> None:
        self.driver = driver
        self._bus = bus
        self._state = HwProjectionScreenSnapshot(position="unknown")

    async def start(self) -> None:
        await self.driver.start(self._on_event)

    async def stop(self) -> None:
        await self.driver.stop()

    def snapshot(self) -> HwProjectionScreenSnapshot:
        return self._state.model_copy()

    async def move(self, request: HwProjectionScreenMoveRequest) -> HwAck:
        return await guard("projection_screen", self.driver.move(request))

    def _on_event(self, event: HwProjectionScreenStateEvent) -> None:
        self._state = HwProjectionScreenSnapshot(position=event.data.position)
        self._bus.publish(event)
```
4. Create `services/hw/app/modules/projection_screen/driver_real.py`:
```python
"""Real projection screen driver: stub until hardware intake.

[ASSUMED] Relay or IR; position source unknown (Q2) (ARCHITECTURE §7.2).
"""

from app.config import Settings
from app.contracts import INTAKE_PENDING, HwAck, HwDriverKind
from app.modules.projection_screen.schemas import HwProjectionScreenMoveRequest
from app.modules.projection_screen.service import ScreenEmit


class RealProjectionScreenDriver:
    kind: HwDriverKind = "real"

    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    async def start(self, emit: ScreenEmit) -> None:
        """Nothing to start before intake; the position stays "unknown"."""

    async def stop(self) -> None:
        """Nothing to stop."""

    async def move(self, request: HwProjectionScreenMoveRequest) -> HwAck:
        raise NotImplementedError(INTAKE_PENDING)
```
5. Create `services/hw/app/modules/projection_screen/driver_fake.py`:
```python
"""Fake projection screen: "moving", then the end position after TRAVEL_S (scaled)."""

import asyncio

from app.config import Settings
from app.contracts import ACK_OK, HwAck, HwDriverKind
from app.fake_support import FakeTasks, scaled
from app.modules.projection_screen.schemas import (
    HwProjectionScreenMoveRequest,
    HwProjectionScreenStateEvent,
    HwScreenPosition,
    HwScreenStateData,
)
from app.modules.projection_screen.service import ScreenEmit

TRAVEL_S = 3.0  # [ASSUMED] short enough for the 5 s screen command timeout (Q12)


class FakeProjectionScreenDriver:
    kind: HwDriverKind = "fake"

    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._position: HwScreenPosition = "lowered"  # screenshot 01
        self._emit: ScreenEmit | None = None
        self._tasks = FakeTasks()
        self._travel: asyncio.Task[None] | None = None

    async def start(self, emit: ScreenEmit) -> None:
        self._emit = emit
        self._report()

    async def stop(self) -> None:
        await self._tasks.cancel_all()
        self._emit = None

    async def move(self, request: HwProjectionScreenMoveRequest) -> HwAck:
        target: HwScreenPosition = "raised" if request.to == "raise" else "lowered"
        if self._travel is not None:
            self._travel.cancel()  # last write wins: a new move replaces the one in progress
        self._position = "moving"
        self._report()
        self._travel = self._tasks.spawn(self._arrive(target))
        return ACK_OK

    async def _arrive(self, target: HwScreenPosition) -> None:
        await asyncio.sleep(scaled(self._settings, TRAVEL_S))
        self._position = target
        self._travel = None
        self._report()

    def _report(self) -> None:
        if self._emit is not None:
            self._emit(
                HwProjectionScreenStateEvent(data=HwScreenStateData(position=self._position))
            )
```
6. Create `services/hw/app/modules/projection_screen/router.py`:
```python
from fastapi import APIRouter

from app.contracts import HwAck
from app.modules.projection_screen.schemas import HwProjectionScreenMoveRequest
from app.modules.projection_screen.service import ProjectionScreenService


def build_router(service: ProjectionScreenService) -> APIRouter:
    router = APIRouter(prefix="/v1/projection_screen", tags=["projection_screen"])

    @router.post("/move")
    async def move(body: HwProjectionScreenMoveRequest) -> HwAck:
        return await service.move(body)

    return router
```

**Test:** create `services/hw/tests/test_projection_screen.py`:
```python
import asyncio

from app.contracts import ACK_OK, ack_error
from app.events import EventBus, Subscription
from app.modules.projection_screen.driver_fake import FakeProjectionScreenDriver
from app.modules.projection_screen.driver_real import RealProjectionScreenDriver
from app.modules.projection_screen.router import build_router
from app.modules.projection_screen.schemas import (
    HwProjectionScreenMoveRequest,
    HwProjectionScreenSnapshot,
    HwProjectionScreenStateEvent,
)
from app.modules.projection_screen.service import ProjectionScreenService
from tests.helpers import drain, http_client, make_settings, next_event


async def start_fake() -> tuple[ProjectionScreenService, Subscription]:
    bus = EventBus(64)
    sub = bus.subscribe()
    service = ProjectionScreenService(FakeProjectionScreenDriver(make_settings()), bus)
    await service.start()
    return service, sub


async def positions(sub: Subscription, count: int) -> list[str]:
    return [
        (await next_event(sub, HwProjectionScreenStateEvent)).data.position for _ in range(count)
    ]


async def test_fake_starts_lowered() -> None:
    service, _ = await start_fake()
    assert service.snapshot() == HwProjectionScreenSnapshot(position="lowered")


async def test_move_reports_moving_then_the_end_position() -> None:
    service, sub = await start_fake()
    drain(sub)
    assert await service.move(HwProjectionScreenMoveRequest(to="raise")) == ACK_OK
    assert await positions(sub, 2) == ["moving", "raised"]
    assert service.snapshot().position == "raised"
    await service.stop()


async def test_a_new_move_replaces_the_one_in_progress() -> None:
    service, sub = await start_fake()
    drain(sub)
    await service.move(HwProjectionScreenMoveRequest(to="raise"))
    await service.move(HwProjectionScreenMoveRequest(to="lower"))
    assert await positions(sub, 3) == ["moving", "moving", "lowered"]
    await asyncio.sleep(0.02)  # the cancelled "raise" never arrives
    assert drain(sub) == []
    await service.stop()


async def test_real_driver_answers_transport_error() -> None:
    service = ProjectionScreenService(RealProjectionScreenDriver(make_settings()), EventBus(8))
    await service.start()
    ack = await service.move(HwProjectionScreenMoveRequest(to="raise"))
    assert ack == ack_error("transport", "projection_screen: hardware intake pending")
    assert service.snapshot() == HwProjectionScreenSnapshot(position="unknown")


async def test_route() -> None:
    service, _ = await start_fake()
    async with http_client(build_router(service)) as http:
        ok = await http.post("/v1/projection_screen/move", json={"to": "lower"})
        assert ok.json() == {"ok": True}
        bad = await http.post("/v1/projection_screen/move", json={"to": "up"})
        assert bad.status_code == 422
    await service.stop()
```

**Verify:** `uv run --directory services/hw pytest tests/test_projection_screen.py -q` → `5 passed`; `pnpm verify` green.

**Commit:** `git add services/hw docs/plans/PLAN-M07-hw-service-skeleton.md && git commit -m "feat(hw): projection screen module with fake driver"`

---

### T9 — `audio` module (level and mute per channel, `audio.state`)
- [x] done

**Files:** `services/hw/app/modules/audio/{__init__,schemas,service,driver_real,driver_fake,router}.py`, `services/hw/tests/test_audio.py`

**Context:** §3.4 `POST /v1/audio/level {channel: mic|pc, level 0–100}` and `POST /v1/audio/mute {channel, muted}`;
event `audio.state {channel, level, muted}` (a level change keeps `muted`, a mute keeps `level`; R9 save/restore is
core-api's job). §7.2 (`[ASSUMED]` ALSA `amixer`, Q8). No simulation route.

**Do:**
1. Create empty `services/hw/app/modules/audio/__init__.py`.
2. Create `services/hw/app/modules/audio/schemas.py`:
```python
"""audio contract. Mirrors packages/contracts/src/hw (HwAudioLevelRequest, HwAudioMuteRequest,
HwAudioStateData, HwAudioChannelState)."""

from typing import Literal

from app.contracts import HwEnvelope, HwModel, Level

AudioChannel = Literal["mic", "pc"]


class HwAudioLevelRequest(HwModel):
    channel: AudioChannel
    level: Level


class HwAudioMuteRequest(HwModel):
    channel: AudioChannel
    muted: bool


class HwAudioStateData(HwModel):
    channel: AudioChannel
    level: Level
    muted: bool


class HwAudioStateEvent(HwEnvelope):
    type: Literal["audio.state"] = "audio.state"
    data: HwAudioStateData


class HwAudioChannelState(HwModel):
    level: Level
    muted: bool


class HwAudioSnapshot(HwModel):
    """HwSnapshot.audio. None = channel not reported yet."""

    mic: HwAudioChannelState | None
    pc: HwAudioChannelState | None
```
3. Create `services/hw/app/modules/audio/service.py`:
```python
"""audio: mic and PC channels on the room mixer (ARCHITECTURE §7.2)."""

from collections.abc import Callable
from typing import Protocol

from app.contracts import HwAck, HwDriverKind, guard
from app.events import EventBus
from app.modules.audio.schemas import (
    HwAudioChannelState,
    HwAudioLevelRequest,
    HwAudioMuteRequest,
    HwAudioSnapshot,
    HwAudioStateEvent,
)

AudioEmit = Callable[[HwAudioStateEvent], None]


class AudioDriver(Protocol):
    kind: HwDriverKind

    async def start(self, emit: AudioEmit) -> None: ...

    async def stop(self) -> None: ...

    async def level(self, request: HwAudioLevelRequest) -> HwAck: ...

    async def mute(self, request: HwAudioMuteRequest) -> HwAck: ...


class AudioService:
    def __init__(self, driver: AudioDriver, bus: EventBus) -> None:
        self.driver = driver
        self._bus = bus
        self._state = HwAudioSnapshot(mic=None, pc=None)

    async def start(self) -> None:
        await self.driver.start(self._on_event)

    async def stop(self) -> None:
        await self.driver.stop()

    def snapshot(self) -> HwAudioSnapshot:
        return self._state.model_copy()

    async def level(self, request: HwAudioLevelRequest) -> HwAck:
        return await guard("audio", self.driver.level(request))

    async def mute(self, request: HwAudioMuteRequest) -> HwAck:
        return await guard("audio", self.driver.mute(request))

    def _on_event(self, event: HwAudioStateEvent) -> None:
        channel = HwAudioChannelState(level=event.data.level, muted=event.data.muted)
        self._state = self._state.model_copy(update={event.data.channel: channel})
        self._bus.publish(event)
```
4. Create `services/hw/app/modules/audio/driver_real.py`:
```python
"""Real audio driver: stub until hardware intake.

[ASSUMED] ALSA mixer on the Pi via `amixer` (Q8) (ARCHITECTURE §7.2).
"""

from app.config import Settings
from app.contracts import INTAKE_PENDING, HwAck, HwDriverKind
from app.modules.audio.schemas import HwAudioLevelRequest, HwAudioMuteRequest
from app.modules.audio.service import AudioEmit


class RealAudioDriver:
    kind: HwDriverKind = "real"

    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    async def start(self, emit: AudioEmit) -> None:
        """Nothing to start before intake; the module reports nothing (snapshot stays null)."""

    async def stop(self) -> None:
        """Nothing to stop."""

    async def level(self, request: HwAudioLevelRequest) -> HwAck:
        raise NotImplementedError(INTAKE_PENDING)

    async def mute(self, request: HwAudioMuteRequest) -> HwAck:
        raise NotImplementedError(INTAKE_PENDING)
```
5. Create `services/hw/app/modules/audio/driver_fake.py`:
```python
"""Fake mixer: echoes every level/mute change as `audio.state`. No simulation routes."""

from app.config import Settings
from app.contracts import ACK_OK, HwAck, HwDriverKind
from app.modules.audio.schemas import (
    AudioChannel,
    HwAudioChannelState,
    HwAudioLevelRequest,
    HwAudioMuteRequest,
    HwAudioStateData,
    HwAudioStateEvent,
)
from app.modules.audio.service import AudioEmit


class FakeAudioDriver:
    kind: HwDriverKind = "fake"

    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._channels: dict[AudioChannel, HwAudioChannelState] = {  # screenshot 01
            "mic": HwAudioChannelState(level=62, muted=False),
            "pc": HwAudioChannelState(level=38, muted=False),
        }
        self._emit: AudioEmit | None = None

    async def start(self, emit: AudioEmit) -> None:
        self._emit = emit
        self._report("mic")
        self._report("pc")

    async def stop(self) -> None:
        self._emit = None

    async def level(self, request: HwAudioLevelRequest) -> HwAck:
        current = self._channels[request.channel]
        self._channels[request.channel] = current.model_copy(update={"level": request.level})
        self._report(request.channel)
        return ACK_OK

    async def mute(self, request: HwAudioMuteRequest) -> HwAck:
        current = self._channels[request.channel]
        self._channels[request.channel] = current.model_copy(update={"muted": request.muted})
        self._report(request.channel)
        return ACK_OK

    def _report(self, channel: AudioChannel) -> None:
        if self._emit is not None:
            state = self._channels[channel]
            data = HwAudioStateData(channel=channel, level=state.level, muted=state.muted)
            self._emit(HwAudioStateEvent(data=data))
```
6. Create `services/hw/app/modules/audio/router.py`:
```python
from fastapi import APIRouter

from app.contracts import HwAck
from app.modules.audio.schemas import HwAudioLevelRequest, HwAudioMuteRequest
from app.modules.audio.service import AudioService


def build_router(service: AudioService) -> APIRouter:
    router = APIRouter(prefix="/v1/audio", tags=["audio"])

    @router.post("/level")
    async def level(body: HwAudioLevelRequest) -> HwAck:
        return await service.level(body)

    @router.post("/mute")
    async def mute(body: HwAudioMuteRequest) -> HwAck:
        return await service.mute(body)

    return router
```

**Test:** create `services/hw/tests/test_audio.py`:
```python
from app.contracts import ACK_OK, ack_error
from app.events import EventBus, Subscription
from app.modules.audio.driver_fake import FakeAudioDriver
from app.modules.audio.driver_real import RealAudioDriver
from app.modules.audio.router import build_router
from app.modules.audio.schemas import (
    HwAudioChannelState,
    HwAudioLevelRequest,
    HwAudioMuteRequest,
    HwAudioSnapshot,
    HwAudioStateData,
    HwAudioStateEvent,
)
from app.modules.audio.service import AudioService
from tests.helpers import drain, http_client, make_settings, next_event


async def start_fake() -> tuple[AudioService, Subscription]:
    bus = EventBus(64)
    sub = bus.subscribe()
    service = AudioService(FakeAudioDriver(make_settings()), bus)
    await service.start()
    return service, sub


async def test_fake_starts_with_screenshot_levels() -> None:
    service, _ = await start_fake()
    assert service.snapshot() == HwAudioSnapshot(
        mic=HwAudioChannelState(level=62, muted=False),
        pc=HwAudioChannelState(level=38, muted=False),
    )


async def test_level_keeps_mute_and_mute_keeps_level() -> None:
    service, sub = await start_fake()
    drain(sub)
    assert await service.mute(HwAudioMuteRequest(channel="pc", muted=True)) == ACK_OK
    assert (await next_event(sub, HwAudioStateEvent)).data == HwAudioStateData(
        channel="pc", level=38, muted=True
    )
    assert await service.level(HwAudioLevelRequest(channel="pc", level=50)) == ACK_OK
    assert (await next_event(sub, HwAudioStateEvent)).data == HwAudioStateData(
        channel="pc", level=50, muted=True
    )
    assert service.snapshot().pc == HwAudioChannelState(level=50, muted=True)
    assert service.snapshot().mic == HwAudioChannelState(level=62, muted=False)


async def test_real_driver_answers_transport_error() -> None:
    service = AudioService(RealAudioDriver(make_settings()), EventBus(8))
    await service.start()
    ack = await service.level(HwAudioLevelRequest(channel="mic", level=10))
    assert ack == ack_error("transport", "audio: hardware intake pending")
    assert service.snapshot() == HwAudioSnapshot(mic=None, pc=None)


async def test_routes() -> None:
    service, _ = await start_fake()
    async with http_client(build_router(service)) as http:
        level = await http.post("/v1/audio/level", json={"channel": "mic", "level": 70})
        assert level.json() == {"ok": True}
        mute = await http.post("/v1/audio/mute", json={"channel": "mic", "muted": True})
        assert mute.json() == {"ok": True}
        too_loud = await http.post("/v1/audio/level", json={"channel": "mic", "level": 101})
        assert too_loud.status_code == 422
    assert service.snapshot().mic == HwAudioChannelState(level=70, muted=True)
```

**Verify:** `uv run --directory services/hw pytest tests/test_audio.py -q` → `4 passed`; `pnpm verify` green.

**Commit:** `git add services/hw docs/plans/PLAN-M07-hw-service-skeleton.md && git commit -m "feat(hw): audio module with fake driver"`

---

### T10 — `projector_power` module (relay, power meter, IR-driven ramp, meter-offline route)
- [x] done

**Files:** `services/hw/app/modules/projector_power/{__init__,schemas,service,driver_real,driver_fake,router}.py`,
`services/hw/tests/test_projector_power.py`

**Context:** §3.4 `POST /v1/projector_power/relay {on}`; events `projector_power.relay {on}` and
`projector_power.reading {watts, volts, energy_kwh_total}`; snapshot `{relay, reading: HwPowerSample|null}`. SPEC R1
(>50 W running, <5 W standby, between = warming/cooling), S1.E13 (`287 W`), S2.E12 (`231 V`). D6, D7, D10
(`meter_offline`). hw reports raw watts only; core-api derives phases (D-06). `ir_received(code)` is called by the
fake IR driver once T15 wires them; here it is tested directly.

**Do:**
1. Create empty `services/hw/app/modules/projector_power/__init__.py`.
2. Create `services/hw/app/modules/projector_power/schemas.py`:
```python
"""projector_power contract. Mirrors packages/contracts/src/hw (HwProjectorPowerRelayRequest,
HwRelayStateData, HwPowerReadingData, HwPowerSample)."""

from typing import Annotated, Literal

from pydantic import Field

from app.contracts import HwEnvelope, HwModel, Timestamp

NonNegative = Annotated[float, Field(ge=0)]


class HwProjectorPowerRelayRequest(HwModel):
    on: bool


class HwRelayStateData(HwModel):
    on: bool


class HwPowerReadingData(HwModel):
    watts: NonNegative
    volts: NonNegative
    energy_kwh_total: NonNegative  # core-api derives kwh_today


class HwPowerSample(HwModel):
    at: Timestamp
    watts: NonNegative
    volts: NonNegative
    energy_kwh_total: NonNegative


class HwProjectorPowerRelayEvent(HwEnvelope):
    type: Literal["projector_power.relay"] = "projector_power.relay"
    data: HwRelayStateData


class HwProjectorPowerReadingEvent(HwEnvelope):
    type: Literal["projector_power.reading"] = "projector_power.reading"
    data: HwPowerReadingData


class HwProjectorPowerSnapshot(HwModel):
    """HwSnapshot.projector_power. None = not reported yet."""

    relay: bool | None
    reading: HwPowerSample | None
```
3. Create `services/hw/app/modules/projector_power/service.py`:
```python
"""projector_power: the smart plug in front of the projector, relay + power meter
(ARCHITECTURE §7.2). hw reports raw watts; core-api derives the projector state (R1)."""

from collections.abc import Callable
from typing import Protocol

from app.contracts import HwAck, HwDriverKind, guard
from app.events import EventBus
from app.modules.projector_power.schemas import (
    HwPowerSample,
    HwProjectorPowerReadingEvent,
    HwProjectorPowerRelayEvent,
    HwProjectorPowerRelayRequest,
    HwProjectorPowerSnapshot,
)

ProjectorPowerEvent = HwProjectorPowerRelayEvent | HwProjectorPowerReadingEvent
ProjectorPowerEmit = Callable[[ProjectorPowerEvent], None]


class ProjectorPowerDriver(Protocol):
    kind: HwDriverKind

    async def start(self, emit: ProjectorPowerEmit) -> None: ...

    async def stop(self) -> None: ...

    async def relay(self, request: HwProjectorPowerRelayRequest) -> HwAck: ...


class ProjectorPowerService:
    def __init__(self, driver: ProjectorPowerDriver, bus: EventBus) -> None:
        self.driver = driver
        self._bus = bus
        self._state = HwProjectorPowerSnapshot(relay=None, reading=None)

    async def start(self) -> None:
        await self.driver.start(self._on_event)

    async def stop(self) -> None:
        await self.driver.stop()

    def snapshot(self) -> HwProjectorPowerSnapshot:
        return self._state.model_copy()

    async def relay(self, request: HwProjectorPowerRelayRequest) -> HwAck:
        return await guard("projector_power", self.driver.relay(request))

    def _on_event(self, event: ProjectorPowerEvent) -> None:
        if isinstance(event, HwProjectorPowerRelayEvent):
            self._state = self._state.model_copy(update={"relay": event.data.on})
        else:
            sample = HwPowerSample(at=event.at, **event.data.model_dump())
            self._state = self._state.model_copy(update={"reading": sample})
        self._bus.publish(event)
```
4. Create `services/hw/app/modules/projector_power/driver_real.py`:
```python
"""Real projector plug driver: stub until hardware intake.

[ASSUMED] S60ZBTPG via zigbee2mqtt (power, voltage, energy) (ARCHITECTURE §7.2).
"""

from app.config import Settings
from app.contracts import INTAKE_PENDING, HwAck, HwDriverKind
from app.modules.projector_power.schemas import HwProjectorPowerRelayRequest
from app.modules.projector_power.service import ProjectorPowerEmit


class RealProjectorPowerDriver:
    kind: HwDriverKind = "real"

    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    async def start(self, emit: ProjectorPowerEmit) -> None:
        """Nothing to start before intake; the module reports nothing (snapshot stays null)."""

    async def stop(self) -> None:
        """Nothing to stop."""

    async def relay(self, request: HwProjectorPowerRelayRequest) -> HwAck:
        raise NotImplementedError(INTAKE_PENDING)
```
5. Create `services/hw/app/modules/projector_power/driver_fake.py`:
```python
"""Fake projector plug: relay echo, a power meter and a projector that reacts to IR codes.

The fake IR driver calls `ir_received(code)` for every code it sends (wired in app/registry.py).
`HW_FAKE_PROJECTOR_ON_CODE` starts the warm-up ramp, `HW_FAKE_PROJECTOR_OFF_CODE` the cool-down.
"""

import asyncio
from typing import Literal

from fastapi import APIRouter

from app.config import Settings
from app.contracts import ACK_OK, HwAck, HwAckOk, HwDriverKind, HwModel, ack_error
from app.fake_support import FakeTasks, scaled
from app.modules.projector_power.schemas import (
    HwPowerReadingData,
    HwProjectorPowerReadingEvent,
    HwProjectorPowerRelayEvent,
    HwProjectorPowerRelayRequest,
    HwRelayStateData,
)
from app.modules.projector_power.service import ProjectorPowerEmit

# [ASSUMED] projector draw profile. R1: >50 W running, <5 W standby, between = transition.
STANDBY_W = 3.0
RUNNING_W = 287.0
VOLTS = 231.0
STEP_S = 10.0  # simulated seconds between ramp steps
WARM_UP_W = (12.0, 24.0, 36.0, 48.0, 160.0, RUNNING_W)
COOL_DOWN_W = (120.0, 45.0, 38.0, 30.0, 22.0, 14.0, 6.0, STANDBY_W)

Phase = Literal["off", "standby", "warming_up", "running", "cooling_down"]
WARMS_FROM: tuple[Phase, ...] = ("standby", "cooling_down")
COOLS_FROM: tuple[Phase, ...] = ("running", "warming_up")


class FakeProjectorPowerDriver:
    kind: HwDriverKind = "fake"

    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._relay = True
        self._phase: Phase = "standby"
        self._watts = STANDBY_W
        self._energy = settings.fake_energy_kwh_total
        self._meter_online = True
        self._emit: ProjectorPowerEmit | None = None
        self._tasks = FakeTasks()
        self._ramp: asyncio.Task[None] | None = None

    async def start(self, emit: ProjectorPowerEmit) -> None:
        self._emit = emit
        self._emit(HwProjectorPowerRelayEvent(data=HwRelayStateData(on=self._relay)))
        self._report_reading()
        self._tasks.spawn(self._periodic())

    async def stop(self) -> None:
        await self._tasks.cancel_all()
        self._emit = None

    async def relay(self, request: HwProjectorPowerRelayRequest) -> HwAck:
        if not self._meter_online:
            return ack_error("device_offline", f"{self._settings.proj_plug_node} is offline")
        self._relay = request.on
        self._cancel_ramp()
        self._phase = "standby" if request.on else "off"
        self._watts = STANDBY_W if request.on else 0.0
        if self._emit is not None:
            self._emit(HwProjectorPowerRelayEvent(data=HwRelayStateData(on=self._relay)))
        self._report_reading()
        return ACK_OK

    def ir_received(self, code: str) -> None:
        """The projector saw an IR code. Without mains (relay off) it ignores everything."""
        if code == self._settings.fake_projector_on_code and self._phase in WARMS_FROM:
            self._run_ramp("warming_up", WARM_UP_W, "running")
        elif code == self._settings.fake_projector_off_code and self._phase in COOLS_FROM:
            self._run_ramp("cooling_down", COOL_DOWN_W, "standby")

    def set_meter_online(self, online: bool) -> None:
        """Offline = no readings and relay commands fail with `device_offline`."""
        self._meter_online = online
        if online:
            self._report_reading()

    def _run_ramp(self, during: Phase, steps: tuple[float, ...], after: Phase) -> None:
        self._cancel_ramp()
        self._phase = during
        self._ramp = self._tasks.spawn(self._ramp_steps(steps, after))

    async def _ramp_steps(self, steps: tuple[float, ...], after: Phase) -> None:
        for watts in steps:
            await asyncio.sleep(scaled(self._settings, STEP_S))
            self._watts = watts
            self._report_reading()
        self._phase = after
        self._ramp = None

    def _cancel_ramp(self) -> None:
        if self._ramp is not None:
            self._ramp.cancel()
            self._ramp = None

    async def _periodic(self) -> None:
        interval = self._settings.fake_report_interval_s
        while True:
            await asyncio.sleep(interval)
            simulated_s = interval * self._settings.fake_time_scale
            self._energy += self._watts * simulated_s / 3_600_000  # W·s → kWh
            self._report_reading()

    def _report_reading(self) -> None:
        if self._emit is None or not self._meter_online:
            return
        energy = round(self._energy, 4)
        data = HwPowerReadingData(watts=self._watts, volts=VOLTS, energy_kwh_total=energy)
        self._emit(HwProjectorPowerReadingEvent(data=data))


class FakeOnlineRequest(HwModel):
    online: bool = False


def build_fake_router(driver: FakeProjectorPowerDriver) -> APIRouter:
    router = APIRouter(prefix="/v1/_fake/projector_power", tags=["fake"])

    @router.post("/meter_offline")
    async def meter_offline(body: FakeOnlineRequest | None = None) -> HwAckOk:
        driver.set_meter_online((body or FakeOnlineRequest()).online)
        return ACK_OK

    return router
```
6. Create `services/hw/app/modules/projector_power/router.py`:
```python
from fastapi import APIRouter

from app.contracts import HwAck
from app.modules.projector_power.schemas import HwProjectorPowerRelayRequest
from app.modules.projector_power.service import ProjectorPowerService


def build_router(service: ProjectorPowerService) -> APIRouter:
    router = APIRouter(prefix="/v1/projector_power", tags=["projector_power"])

    @router.post("/relay")
    async def relay(body: HwProjectorPowerRelayRequest) -> HwAck:
        return await service.relay(body)

    return router
```

**Test:** create `services/hw/tests/test_projector_power.py`:
```python
import asyncio

from app.config import Settings
from app.contracts import ACK_OK, ack_error
from app.events import EventBus, Subscription
from app.modules.projector_power.driver_fake import (
    COOL_DOWN_W,
    STANDBY_W,
    WARM_UP_W,
    FakeProjectorPowerDriver,
    build_fake_router,
)
from app.modules.projector_power.driver_real import RealProjectorPowerDriver
from app.modules.projector_power.router import build_router
from app.modules.projector_power.schemas import (
    HwProjectorPowerReadingEvent,
    HwProjectorPowerRelayEvent,
    HwProjectorPowerRelayRequest,
    HwProjectorPowerSnapshot,
)
from app.modules.projector_power.service import ProjectorPowerService
from tests.helpers import drain, http_client, make_settings, next_event

ON_CODE = "C/8hRgHrBkYBgAMH"
OFF_CODE = "C/8hRgHrBkYBgAMP"


async def start_fake(
    settings: Settings | None = None,
) -> tuple[ProjectorPowerService, FakeProjectorPowerDriver, Subscription]:
    bus = EventBus(64)
    sub = bus.subscribe()
    driver = FakeProjectorPowerDriver(settings or make_settings())
    service = ProjectorPowerService(driver, bus)
    await service.start()
    return service, driver, sub


async def watts(sub: Subscription, count: int) -> list[float]:
    return [(await next_event(sub, HwProjectorPowerReadingEvent)).data.watts for _ in range(count)]


async def test_fake_starts_in_standby_with_mains_on() -> None:
    service, _, _ = await start_fake()
    snapshot = service.snapshot()
    assert snapshot.relay is True
    assert snapshot.reading is not None
    assert snapshot.reading.watts == STANDBY_W
    assert snapshot.reading.volts == 231.0
    assert snapshot.reading.energy_kwh_total == 412.67
    await service.stop()


async def test_power_on_code_ramps_through_warm_up_to_running() -> None:
    service, driver, sub = await start_fake()
    drain(sub)
    driver.ir_received(ON_CODE)
    assert await watts(sub, len(WARM_UP_W)) == list(WARM_UP_W)
    assert WARM_UP_W[:4] == (12.0, 24.0, 36.0, 48.0)  # R1 "warming up": between 5 and 50 W
    assert WARM_UP_W[-1] == 287.0
    await service.stop()


async def test_power_off_code_cools_down_to_standby() -> None:
    service, driver, sub = await start_fake()
    driver.ir_received(ON_CODE)
    await watts(sub, 1 + len(WARM_UP_W))  # start reading + warm-up
    driver.ir_received(OFF_CODE)
    assert await watts(sub, len(COOL_DOWN_W)) == list(COOL_DOWN_W)
    assert service.snapshot().reading is not None
    await service.stop()


async def test_unknown_codes_and_repeats_are_ignored() -> None:
    service, driver, sub = await start_fake()
    drain(sub)
    driver.ir_received("SOME/OTHER/CODE")
    driver.ir_received(OFF_CODE)  # already in standby
    await asyncio.sleep(0.05)
    assert drain(sub) == []
    await service.stop()


async def test_relay_off_cuts_power_and_the_projector_ignores_ir() -> None:
    service, driver, sub = await start_fake()
    drain(sub)
    assert await service.relay(HwProjectorPowerRelayRequest(on=False)) == ACK_OK
    assert (await next_event(sub, HwProjectorPowerRelayEvent)).data.on is False
    assert await watts(sub, 1) == [0.0]
    driver.ir_received(ON_CODE)
    await asyncio.sleep(0.05)
    assert drain(sub) == []
    await service.relay(HwProjectorPowerRelayRequest(on=True))
    assert await watts(sub, 1) == [STANDBY_W]
    assert service.snapshot().relay is True
    await service.stop()


async def test_meter_offline_stops_readings_and_fails_relay() -> None:
    service, driver, sub = await start_fake(make_settings(fake_time_scale=100000.0))
    drain(sub)
    driver.set_meter_online(False)
    driver.ir_received(ON_CODE)
    await asyncio.sleep(0.1)
    assert drain(sub) == []
    ack = await service.relay(HwProjectorPowerRelayRequest(on=False))
    assert ack == ack_error("device_offline", "r101_proj_plug is offline")
    driver.set_meter_online(True)
    assert await watts(sub, 1) == [287.0]  # the ramp kept going while unreported
    await service.stop()


async def test_periodic_readings_accumulate_energy() -> None:
    # 3 W for 0.01 s x 360000 = 1 simulated hour → +0.003 kWh per reading
    settings = make_settings(fake_report_interval_s=0.01, fake_time_scale=360000.0)
    service, _, sub = await start_fake(settings)
    drain(sub)
    reading = await next_event(sub, HwProjectorPowerReadingEvent)
    assert reading.data.energy_kwh_total == 412.673
    await service.stop()


async def test_real_driver_answers_transport_error() -> None:
    service = ProjectorPowerService(RealProjectorPowerDriver(make_settings()), EventBus(8))
    await service.start()
    ack = await service.relay(HwProjectorPowerRelayRequest(on=True))
    assert ack == ack_error("transport", "projector_power: hardware intake pending")
    assert service.snapshot() == HwProjectorPowerSnapshot(relay=None, reading=None)


async def test_routes() -> None:
    service, driver, _ = await start_fake()
    async with http_client(build_router(service), build_fake_router(driver)) as http:
        ok = await http.post("/v1/projector_power/relay", json={"on": False})
        assert ok.json() == {"ok": True}
        assert (await http.post("/v1/projector_power/relay", json={})).status_code == 422
        assert (await http.post("/v1/_fake/projector_power/meter_offline")).json() == {"ok": True}
        offline = await http.post("/v1/projector_power/relay", json={"on": True})
        assert offline.json()["error"]["code"] == "device_offline"
        back = await http.post("/v1/_fake/projector_power/meter_offline", json={"online": True})
        assert back.json() == {"ok": True}
    assert service.snapshot().relay is False
    await service.stop()
```

**Verify:** `uv run --directory services/hw pytest tests/test_projector_power.py -q` → `9 passed`; `pnpm verify` green.

**Commit:** `git add services/hw docs/plans/PLAN-M07-hw-service-skeleton.md && git commit -m "feat(hw): projector power module with fake draw ramp"`

---

### T11 — `ir` module (send, learn, cancel, `ir.blaster`, `ir.learn`, blaster-offline route)
- [x] done

**Files:** `services/hw/app/modules/ir/{__init__,schemas,service,driver_real,driver_fake,router}.py`, `services/hw/tests/test_ir.py`

**Context:** §3.4 `POST /v1/ir/send {transport, code_format: "tuya", code}` → `HwAck`; `POST /v1/ir/learn
{transport, timeout_s 1–60}` blocks and answers `HwIrLearnResult` (`captured` | `timeout` | `cancelled`); `POST
/v1/ir/learn/cancel` (no body) → `HwAck`; events `ir.blaster {online, lqi}` and `ir.learn {status}`. ARCHITECTURE
§6.9 (core-api's learn flow: 20 s window, codes never compared as text), SPEC H21, H25, S3.E10 (`LQI 196`). §7.2
(`[ASSUMED]` ZS06 via zigbee2mqtt; `ir_mcu` = ESP32 serial). D4 (learn failure → `timeout` + `hw.error`), D9, D10.
The fake treats both transports alike.

**Do:**
1. Create empty `services/hw/app/modules/ir/__init__.py`.
2. Create `services/hw/app/modules/ir/schemas.py`:
```python
"""ir contract. Mirrors packages/contracts/src/hw (HwIrSendRequest, HwIrLearnRequest,
HwIrLearnResult, HwIrBlasterData, HwIrLearnStateData)."""

from typing import Annotated, Literal

from pydantic import Field

from app.contracts import HwEnvelope, HwModel

IrTransport = Literal["ir_zs06", "ir_mcu"]
IrCode = Annotated[str, Field(min_length=1)]  # opaque Tuya base64 [ASSUMED]
IrLearnStatus = Literal["listening", "captured", "timeout", "cancelled"]


class HwIrSendRequest(HwModel):
    transport: IrTransport
    code_format: Literal["tuya"]
    code: IrCode


class HwIrLearnRequest(HwModel):
    """Blocks up to timeout_s. POST /v1/ir/learn/cancel has no body."""

    transport: IrTransport
    timeout_s: int = Field(ge=1, le=60)


class HwIrLearnCaptured(HwModel):
    status: Literal["captured"]
    code_format: Literal["tuya"]
    code: IrCode


class HwIrLearnTimeout(HwModel):
    status: Literal["timeout"]


class HwIrLearnCancelled(HwModel):
    status: Literal["cancelled"]


HwIrLearnResult = Annotated[
    HwIrLearnCaptured | HwIrLearnTimeout | HwIrLearnCancelled, Field(discriminator="status")
]


class HwIrBlasterData(HwModel):
    online: bool
    lqi: int | None = Field(ge=0, le=255)


class HwIrLearnStateData(HwModel):
    status: IrLearnStatus


class HwIrBlasterEvent(HwEnvelope):
    type: Literal["ir.blaster"] = "ir.blaster"
    data: HwIrBlasterData


class HwIrLearnEvent(HwEnvelope):
    type: Literal["ir.learn"] = "ir.learn"
    data: HwIrLearnStateData


class HwIrSnapshot(HwModel):
    """HwSnapshot.ir. None = blaster not reported yet."""

    blaster: HwIrBlasterData | None
```
3. Create `services/hw/app/modules/ir/service.py`:
```python
"""ir: send and learn Tuya IR codes through the blaster (ARCHITECTURE §7.2, §6.9)."""

from collections.abc import Callable
from typing import Protocol

from app.contracts import HwAck, HwDriverKind, HwErrorData, HwErrorEvent, guard, logger
from app.events import EventBus
from app.modules.ir.schemas import (
    HwIrBlasterEvent,
    HwIrLearnEvent,
    HwIrLearnRequest,
    HwIrLearnResult,
    HwIrLearnTimeout,
    HwIrSendRequest,
    HwIrSnapshot,
)

IrEvent = HwIrBlasterEvent | HwIrLearnEvent
IrEmit = Callable[[IrEvent], None]


class IrDriver(Protocol):
    kind: HwDriverKind

    async def start(self, emit: IrEmit) -> None: ...

    async def stop(self) -> None: ...

    async def send(self, request: HwIrSendRequest) -> HwAck: ...

    async def learn(self, request: HwIrLearnRequest) -> HwIrLearnResult: ...

    async def cancel_learn(self) -> HwAck: ...


class IrService:
    def __init__(self, driver: IrDriver, bus: EventBus) -> None:
        self.driver = driver
        self._bus = bus
        self._state = HwIrSnapshot(blaster=None)

    async def start(self) -> None:
        await self.driver.start(self._on_event)

    async def stop(self) -> None:
        await self.driver.stop()

    def snapshot(self) -> HwIrSnapshot:
        return self._state.model_copy()

    async def send(self, request: HwIrSendRequest) -> HwAck:
        return await guard("ir", self.driver.send(request))

    async def learn(self, request: HwIrLearnRequest) -> HwIrLearnResult:
        """The learn response has no error variant: a driver failure is reported as `hw.error`
        and answered with `timeout` (nothing was captured, the old code stays untouched)."""
        try:
            return await self.driver.learn(request)
        except Exception as exc:
            logger.warning("ir learn failed: %s", exc)
            data = HwErrorData(module="ir", code="transport", message=f"ir: {exc}")
            self._bus.publish(HwErrorEvent(data=data))
            return HwIrLearnTimeout(status="timeout")

    async def cancel_learn(self) -> HwAck:
        return await guard("ir", self.driver.cancel_learn())

    def _on_event(self, event: IrEvent) -> None:
        if isinstance(event, HwIrBlasterEvent):
            self._state = HwIrSnapshot(blaster=event.data)
        self._bus.publish(event)
```
4. Create `services/hw/app/modules/ir/driver_real.py`:
```python
"""Real IR driver: stub until hardware intake.

[ASSUMED] ZS06 via zigbee2mqtt `ir_code_to_send` / `learn_ir_code`; `ir_mcu` = ESP32 on GPIO 16/17
via serial (ARCHITECTURE §7.2).
"""

from app.config import Settings
from app.contracts import INTAKE_PENDING, HwAck, HwDriverKind
from app.modules.ir.schemas import HwIrLearnRequest, HwIrLearnResult, HwIrSendRequest
from app.modules.ir.service import IrEmit


class RealIrDriver:
    kind: HwDriverKind = "real"

    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    async def start(self, emit: IrEmit) -> None:
        """Nothing to start before intake; the module reports nothing (snapshot stays null)."""

    async def stop(self) -> None:
        """Nothing to stop."""

    async def send(self, request: HwIrSendRequest) -> HwAck:
        raise NotImplementedError(INTAKE_PENDING)

    async def learn(self, request: HwIrLearnRequest) -> HwIrLearnResult:
        raise NotImplementedError(INTAKE_PENDING)

    async def cancel_learn(self) -> HwAck:
        raise NotImplementedError(INTAKE_PENDING)
```
5. Create `services/hw/app/modules/ir/driver_fake.py`:
```python
"""Fake IR blaster. Sent codes go to listeners (the fake projector); learning "captures" a
random opaque code after LEARN_CAPTURE_S (scaled), seeded by HW_FAKE_SEED."""

import asyncio
import base64
import random
from collections.abc import Callable

from fastapi import APIRouter

from app.config import Settings
from app.contracts import ACK_OK, HwAck, HwAckOk, HwDriverKind, HwModel, ack_error
from app.fake_support import scaled
from app.modules.ir.schemas import (
    HwIrBlasterData,
    HwIrBlasterEvent,
    HwIrLearnCancelled,
    HwIrLearnCaptured,
    HwIrLearnEvent,
    HwIrLearnRequest,
    HwIrLearnResult,
    HwIrLearnStateData,
    HwIrLearnTimeout,
    HwIrSendRequest,
    IrLearnStatus,
)
from app.modules.ir.service import IrEmit

BLASTER_LQI = 196  # screenshot 03
LEARN_CAPTURE_S = 3.0  # simulated seconds until the fake "receives" a remote press

CodeListener = Callable[[str], None]


class FakeIrDriver:
    kind: HwDriverKind = "fake"

    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._rng = random.Random(settings.fake_seed)
        self._online = True
        self._listeners: list[CodeListener] = []
        self._learn_cancel: asyncio.Event | None = None
        self._emit: IrEmit | None = None

    def add_listener(self, listener: CodeListener) -> None:
        self._listeners.append(listener)

    async def start(self, emit: IrEmit) -> None:
        self._emit = emit
        self._report_blaster()

    async def stop(self) -> None:
        if self._learn_cancel is not None:
            self._learn_cancel.set()
        self._emit = None

    async def send(self, request: HwIrSendRequest) -> HwAck:
        if not self._online:
            return ack_error("device_offline", f"{self._settings.ir_node} is offline")
        for listener in self._listeners:
            listener(request.code)
        return ACK_OK

    async def learn(self, request: HwIrLearnRequest) -> HwIrLearnResult:
        """One capture at a time: a new learn cancels the one in progress. Offline or a timeout
        shorter than LEARN_CAPTURE_S ends in `timeout`."""
        if self._learn_cancel is not None:
            self._learn_cancel.set()
        cancel = asyncio.Event()
        self._learn_cancel = cancel
        self._report_learn("listening")
        captures = self._online and LEARN_CAPTURE_S <= request.timeout_s
        wait_s = LEARN_CAPTURE_S if captures else request.timeout_s
        result: HwIrLearnResult
        try:
            await asyncio.wait_for(cancel.wait(), timeout=scaled(self._settings, wait_s))
            result = HwIrLearnCancelled(status="cancelled")
        except TimeoutError:
            if captures:
                code = base64.b64encode(self._rng.randbytes(12)).decode()
                result = HwIrLearnCaptured(status="captured", code_format="tuya", code=code)
            else:
                result = HwIrLearnTimeout(status="timeout")
        finally:
            if self._learn_cancel is cancel:
                self._learn_cancel = None
        self._report_learn(result.status)
        return result

    async def cancel_learn(self) -> HwAck:
        if self._learn_cancel is not None:
            self._learn_cancel.set()
        return ACK_OK

    def set_online(self, online: bool) -> None:
        self._online = online
        self._report_blaster()

    def _report_blaster(self) -> None:
        if self._emit is not None:
            lqi = BLASTER_LQI if self._online else None
            self._emit(HwIrBlasterEvent(data=HwIrBlasterData(online=self._online, lqi=lqi)))

    def _report_learn(self, status: IrLearnStatus) -> None:
        if self._emit is not None:
            self._emit(HwIrLearnEvent(data=HwIrLearnStateData(status=status)))


class FakeOnlineRequest(HwModel):
    online: bool = False


def build_fake_router(driver: FakeIrDriver) -> APIRouter:
    router = APIRouter(prefix="/v1/_fake/ir", tags=["fake"])

    @router.post("/blaster_offline")
    async def blaster_offline(body: FakeOnlineRequest | None = None) -> HwAckOk:
        driver.set_online((body or FakeOnlineRequest()).online)
        return ACK_OK

    return router
```
6. Create `services/hw/app/modules/ir/router.py`:
```python
from fastapi import APIRouter

from app.contracts import HwAck
from app.modules.ir.schemas import HwIrLearnRequest, HwIrLearnResult, HwIrSendRequest
from app.modules.ir.service import IrService


def build_router(service: IrService) -> APIRouter:
    router = APIRouter(prefix="/v1/ir", tags=["ir"])

    @router.post("/send")
    async def send(body: HwIrSendRequest) -> HwAck:
        return await service.send(body)

    @router.post("/learn")
    async def learn(body: HwIrLearnRequest) -> HwIrLearnResult:
        return await service.learn(body)

    @router.post("/learn/cancel")
    async def cancel_learn() -> HwAck:
        return await service.cancel_learn()

    return router
```

**Test:** create `services/hw/tests/test_ir.py`:
```python
import asyncio

from app.contracts import ACK_OK, HwErrorEvent, ack_error
from app.events import EventBus, Subscription
from app.modules.ir.driver_fake import FakeIrDriver, build_fake_router
from app.modules.ir.driver_real import RealIrDriver
from app.modules.ir.router import build_router
from app.modules.ir.schemas import (
    HwIrBlasterData,
    HwIrLearnCancelled,
    HwIrLearnCaptured,
    HwIrLearnEvent,
    HwIrLearnRequest,
    HwIrLearnTimeout,
    HwIrSendRequest,
    HwIrSnapshot,
)
from app.modules.ir.service import IrService
from tests.helpers import http_client, make_settings, next_event

SEND = HwIrSendRequest(transport="ir_zs06", code_format="tuya", code="C/8hRgHrBkYBgAMH")
LEARN = HwIrLearnRequest(transport="ir_zs06", timeout_s=20)


async def start_fake(time_scale: float = 1000.0) -> tuple[IrService, FakeIrDriver, Subscription]:
    bus = EventBus(64)
    sub = bus.subscribe()
    driver = FakeIrDriver(make_settings(fake_time_scale=time_scale))
    service = IrService(driver, bus)
    await service.start()
    return service, driver, sub


async def learn_statuses(sub: Subscription, count: int) -> list[str]:
    return [(await next_event(sub, HwIrLearnEvent)).data.status for _ in range(count)]


async def test_fake_blaster_starts_online() -> None:
    service, _, _ = await start_fake()
    assert service.snapshot() == HwIrSnapshot(blaster=HwIrBlasterData(online=True, lqi=196))


async def test_send_passes_the_code_to_listeners() -> None:
    service, driver, _ = await start_fake()
    seen: list[str] = []
    driver.add_listener(seen.append)
    assert await service.send(SEND) == ACK_OK
    assert seen == ["C/8hRgHrBkYBgAMH"]


async def test_offline_blaster_refuses_to_send() -> None:
    service, driver, _ = await start_fake()
    driver.set_online(False)
    assert await service.send(SEND) == ack_error("device_offline", "r101_ir is offline")
    assert service.snapshot() == HwIrSnapshot(blaster=HwIrBlasterData(online=False, lqi=None))


async def test_learn_captures_a_seeded_code() -> None:
    service, _, sub = await start_fake()
    result = await service.learn(LEARN)
    assert isinstance(result, HwIrLearnCaptured)
    assert result.code_format == "tuya"
    assert result.code != ""
    assert await learn_statuses(sub, 2) == ["listening", "captured"]
    again, _, _ = await start_fake()  # same HW_FAKE_SEED → same first code
    assert await again.learn(LEARN) == result


async def test_learn_times_out_when_shorter_than_a_capture() -> None:
    service, _, sub = await start_fake()
    result = await service.learn(HwIrLearnRequest(transport="ir_zs06", timeout_s=2))
    assert result == HwIrLearnTimeout(status="timeout")
    assert await learn_statuses(sub, 2) == ["listening", "timeout"]


async def test_learn_times_out_while_the_blaster_is_offline() -> None:
    service, driver, _ = await start_fake()
    driver.set_online(False)
    assert await service.learn(LEARN) == HwIrLearnTimeout(status="timeout")


async def test_cancel_ends_a_learn_in_progress() -> None:
    service, _, sub = await start_fake(time_scale=1.0)  # capture would take 3 real seconds
    learning = asyncio.create_task(service.learn(LEARN))
    assert await learn_statuses(sub, 1) == ["listening"]
    assert await service.cancel_learn() == ACK_OK
    assert await asyncio.wait_for(learning, 1) == HwIrLearnCancelled(status="cancelled")
    assert await learn_statuses(sub, 1) == ["cancelled"]


async def test_real_driver_errors_become_transport_and_timeout() -> None:
    bus = EventBus(8)
    sub = bus.subscribe()
    service = IrService(RealIrDriver(make_settings()), bus)
    await service.start()
    assert await service.send(SEND) == ack_error("transport", "ir: hardware intake pending")
    assert await service.learn(LEARN) == HwIrLearnTimeout(status="timeout")
    error = await next_event(sub, HwErrorEvent)
    assert error.data.module == "ir"
    assert error.data.code == "transport"
    assert service.snapshot() == HwIrSnapshot(blaster=None)


async def test_routes() -> None:
    service, driver, _ = await start_fake()
    async with http_client(build_router(service), build_fake_router(driver)) as http:
        send = await http.post("/v1/ir/send", json=SEND.model_dump())
        assert send.json() == {"ok": True}
        learn = await http.post("/v1/ir/learn", json={"transport": "ir_zs06", "timeout_s": 20})
        assert learn.json()["status"] == "captured"
        assert (await http.post("/v1/ir/learn/cancel")).json() == {"ok": True}
        bad = await http.post("/v1/ir/learn", json={"transport": "ir_zs06", "timeout_s": 61})
        assert bad.status_code == 422
        assert (await http.post("/v1/_fake/ir/blaster_offline")).json() == {"ok": True}
    assert service.snapshot().blaster == HwIrBlasterData(online=False, lqi=None)
```

**Verify:** `uv run --directory services/hw pytest tests/test_ir.py -q` → `9 passed` (one test waits ~0 s; none waits
the 3 real seconds); `pnpm verify` green.

**Commit:** `git add services/hw docs/plans/PLAN-M07-hw-service-skeleton.md && git commit -m "feat(hw): ir module with fake send and learn"`

---

### T12 — `sensors` module (periodic climate, event sensors, sensor-value route)
- [x] done

**Files:** `services/hw/app/modules/sensors/{__init__,schemas,service,driver_real,driver_fake,router}.py`, `services/hw/tests/test_sensors.py`

**Context:** §3.4 event `sensors.reading {node, kind, value}` (discriminated on `kind`: temperature number, humidity
int 0–100, occupancy detected|clear, contact open|closed); snapshot `sensors: HwSensorSample[]` = latest per (node,
kind). No commands, so `build_router` returns an empty router (kept for the module pattern). Node names come from
`HW_TEMP_NODE` / `HW_MOTION_NODE` / `HW_DOOR_NODE`. Climate drifts ±0.3 °C / ±2 % around 26.4 / 61 every
`HW_FAKE_REPORT_INTERVAL_S`, seeded by `HW_FAKE_SEED`.

**Do:**
1. Create empty `services/hw/app/modules/sensors/__init__.py`.
2. Create `services/hw/app/modules/sensors/schemas.py`:
```python
"""sensors contract. Mirrors packages/contracts/src/hw (HwSensorReadingData, HwSensorSample)."""

from typing import Annotated, Literal

from pydantic import Field

from app.contracts import HwEnvelope, HwModel, Timestamp


class HwTemperatureReading(HwModel):
    node: str
    kind: Literal["temperature"]
    value: float


class HwHumidityReading(HwModel):
    node: str
    kind: Literal["humidity"]
    value: int = Field(ge=0, le=100)


class HwOccupancyReading(HwModel):
    node: str
    kind: Literal["occupancy"]
    value: Literal["detected", "clear"]


class HwContactReading(HwModel):
    node: str
    kind: Literal["contact"]
    value: Literal["open", "closed"]


HwSensorReadingData = Annotated[
    HwTemperatureReading | HwHumidityReading | HwOccupancyReading | HwContactReading,
    Field(discriminator="kind"),
]


class HwSensorSample(HwModel):
    at: Timestamp
    reading: HwSensorReadingData


class HwSensorsReadingEvent(HwEnvelope):
    type: Literal["sensors.reading"] = "sensors.reading"
    data: HwSensorReadingData
```
3. Create `services/hw/app/modules/sensors/service.py`:
```python
"""sensors: Zigbee climate, motion and door sensors; read-only (ARCHITECTURE §7.2)."""

from collections.abc import Callable
from typing import Protocol

from app.contracts import HwDriverKind
from app.events import EventBus
from app.modules.sensors.schemas import HwSensorSample, HwSensorsReadingEvent

SensorsEmit = Callable[[HwSensorsReadingEvent], None]


class SensorsDriver(Protocol):
    kind: HwDriverKind

    async def start(self, emit: SensorsEmit) -> None: ...

    async def stop(self) -> None: ...


class SensorsService:
    def __init__(self, driver: SensorsDriver, bus: EventBus) -> None:
        self.driver = driver
        self._bus = bus
        self._latest: dict[tuple[str, str], HwSensorSample] = {}

    async def start(self) -> None:
        await self.driver.start(self._on_event)

    async def stop(self) -> None:
        await self.driver.stop()

    def snapshot(self) -> list[HwSensorSample]:
        """Latest reading per (node, kind), in first-reported order."""
        return list(self._latest.values())

    def _on_event(self, event: HwSensorsReadingEvent) -> None:
        key = (event.data.node, event.data.kind)
        self._latest[key] = HwSensorSample(at=event.at, reading=event.data)
        self._bus.publish(event)
```
4. Create `services/hw/app/modules/sensors/driver_real.py`:
```python
"""Real sensors driver: stub until hardware intake.

[ASSUMED] SNZB-02P / SNZB-03P / SNZB-04PR2 via zigbee2mqtt (ARCHITECTURE §7.2).
"""

from app.config import Settings
from app.contracts import HwDriverKind
from app.modules.sensors.service import SensorsEmit


class RealSensorsDriver:
    kind: HwDriverKind = "real"

    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    async def start(self, emit: SensorsEmit) -> None:
        """Nothing to start before intake; no readings are reported."""

    async def stop(self) -> None:
        """Nothing to stop."""
```
5. Create `services/hw/app/modules/sensors/driver_fake.py`:
```python
"""Fake sensors: climate every HW_FAKE_REPORT_INTERVAL_S (seeded drift), motion and door only
when `/v1/_fake/sensors/value` says so."""

import asyncio
import random

from fastapi import APIRouter

from app.config import Settings
from app.contracts import ACK_OK, HwAckOk, HwDriverKind
from app.fake_support import FakeTasks
from app.modules.sensors.schemas import (
    HwContactReading,
    HwHumidityReading,
    HwOccupancyReading,
    HwSensorReadingData,
    HwSensorsReadingEvent,
    HwTemperatureReading,
)
from app.modules.sensors.service import SensorsEmit

# Screenshot 01 values; the fake drifts around them.
BASE_TEMPERATURE_C = 26.4
BASE_HUMIDITY_PCT = 61


class FakeSensorsDriver:
    kind: HwDriverKind = "fake"

    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._rng = random.Random(settings.fake_seed)
        self._emit: SensorsEmit | None = None
        self._tasks = FakeTasks()

    async def start(self, emit: SensorsEmit) -> None:
        self._emit = emit
        cfg = self._settings
        self.report(
            HwTemperatureReading(node=cfg.temp_node, kind="temperature", value=BASE_TEMPERATURE_C)
        )
        self.report(HwHumidityReading(node=cfg.temp_node, kind="humidity", value=BASE_HUMIDITY_PCT))
        self.report(HwOccupancyReading(node=cfg.motion_node, kind="occupancy", value="detected"))
        self.report(HwContactReading(node=cfg.door_node, kind="contact", value="closed"))
        self._tasks.spawn(self._periodic())

    async def stop(self) -> None:
        await self._tasks.cancel_all()
        self._emit = None

    def report(self, reading: HwSensorReadingData) -> None:
        if self._emit is not None:
            self._emit(HwSensorsReadingEvent(data=reading))

    async def _periodic(self) -> None:
        node = self._settings.temp_node
        while True:
            await asyncio.sleep(self._settings.fake_report_interval_s)
            temperature = round(BASE_TEMPERATURE_C + self._rng.uniform(-0.3, 0.3), 1)
            humidity = BASE_HUMIDITY_PCT + self._rng.randint(-2, 2)
            self.report(HwTemperatureReading(node=node, kind="temperature", value=temperature))
            self.report(HwHumidityReading(node=node, kind="humidity", value=humidity))


def build_fake_router(driver: FakeSensorsDriver) -> APIRouter:
    router = APIRouter(prefix="/v1/_fake/sensors", tags=["fake"])

    @router.post("/value")
    async def value(body: HwSensorReadingData) -> HwAckOk:
        driver.report(body)
        return ACK_OK

    return router
```
6. Create `services/hw/app/modules/sensors/router.py`:
```python
from fastapi import APIRouter

from app.modules.sensors.service import SensorsService


def build_router(service: SensorsService) -> APIRouter:
    """Sensors have no commands; readings arrive only on GET /v1/events."""
    return APIRouter(prefix="/v1/sensors", tags=["sensors"])
```

**Test:** create `services/hw/tests/test_sensors.py`:
```python
from app.events import EventBus, Subscription
from app.modules.sensors.driver_fake import FakeSensorsDriver, build_fake_router
from app.modules.sensors.driver_real import RealSensorsDriver
from app.modules.sensors.router import build_router
from app.modules.sensors.schemas import HwContactReading, HwSensorsReadingEvent
from app.modules.sensors.service import SensorsService
from tests.helpers import drain, http_client, make_settings, next_event


async def start_fake(
    interval_s: float = 3600.0,
) -> tuple[SensorsService, FakeSensorsDriver, Subscription]:
    bus = EventBus(64)
    sub = bus.subscribe()
    driver = FakeSensorsDriver(make_settings(fake_report_interval_s=interval_s))
    service = SensorsService(driver, bus)
    await service.start()
    return service, driver, sub


async def test_fake_reports_every_sensor_on_start() -> None:
    service, _, _ = await start_fake()
    assert [(s.reading.node, s.reading.kind, s.reading.value) for s in service.snapshot()] == [
        ("r101_temp", "temperature", 26.4),
        ("r101_temp", "humidity", 61),
        ("r101_motion", "occupancy", "detected"),
        ("r101_door", "contact", "closed"),
    ]
    await service.stop()


async def test_climate_readings_repeat_with_seeded_drift() -> None:
    service, _, sub = await start_fake(interval_s=0.01)
    drain(sub)
    first = await next_event(sub, HwSensorsReadingEvent)
    second = await next_event(sub, HwSensorsReadingEvent)
    assert (first.data.kind, second.data.kind) == ("temperature", "humidity")
    assert 26.1 <= first.data.value <= 26.7
    assert 59 <= second.data.value <= 63
    await service.stop()
    again, _, sub2 = await start_fake(interval_s=0.01)  # same seed → same first values
    drain(sub2)
    assert (await next_event(sub2, HwSensorsReadingEvent)).data == first.data
    await again.stop()


async def test_snapshot_keeps_the_latest_reading_per_node_and_kind() -> None:
    service, driver, _ = await start_fake()
    driver.report(HwContactReading(node="r101_door", kind="contact", value="open"))
    contacts = [s.reading for s in service.snapshot() if s.reading.kind == "contact"]
    assert contacts == [HwContactReading(node="r101_door", kind="contact", value="open")]
    assert len(service.snapshot()) == 4
    await service.stop()


async def test_real_driver_reports_nothing() -> None:
    service = SensorsService(RealSensorsDriver(make_settings()), EventBus(8))
    await service.start()
    assert service.snapshot() == []


async def test_fake_value_route() -> None:
    service, driver, sub = await start_fake()
    drain(sub)
    async with http_client(build_router(service), build_fake_router(driver)) as http:
        ok = await http.post(
            "/v1/_fake/sensors/value",
            json={"node": "r101_motion", "kind": "occupancy", "value": "clear"},
        )
        assert ok.json() == {"ok": True}
        bad = await http.post(
            "/v1/_fake/sensors/value",
            json={"node": "r101_motion", "kind": "occupancy", "value": "open"},
        )
        assert bad.status_code == 422
    assert (await next_event(sub, HwSensorsReadingEvent)).data.value == "clear"
    await service.stop()
```

**Verify:** `uv run --directory services/hw pytest tests/test_sensors.py -q` → `5 passed`; `pnpm verify` green.

**Commit:** `git add services/hw docs/plans/PLAN-M07-hw-service-skeleton.md && git commit -m "feat(hw): sensors module with fake readings"`

---

### T13 — `zigbee_status` module (permit join, nodes, coordinator, offline routes)
- [x] done

**Files:** `services/hw/app/modules/zigbee_status/{__init__,schemas,service,driver_real,driver_fake,router}.py`,
`services/hw/tests/test_zigbee_status.py`

**Context:** §3.4 `POST /v1/zigbee_status/permit_join {seconds 0–254}`; events `zigbee.node`, `zigbee.coordinator`,
`zigbee.mesh {joining_until}` (note: module `zigbee_status`, event prefix `zigbee.`); snapshot `zigbee: {coordinator,
nodes, joining_until}`. Counts are derived by core-api. Nodes and coordinator come from `HW_ZIGBEE_NODES` /
`HW_COORDINATOR` (T1). SPEC S2.E21 (permit joining opens for 4 min = 240 s). D10 (`node_offline`,
`coordinator_offline`).

**Do:**
1. Create empty `services/hw/app/modules/zigbee_status/__init__.py`.
2. Create `services/hw/app/modules/zigbee_status/schemas.py`:
```python
"""zigbee_status contract. Mirrors packages/contracts/src/hw (HwZigbeeStatusPermitJoinRequest,
HwZigbeeNode, HwCoordinator, HwMeshData). Events are named `zigbee.*`."""

from typing import Literal

from pydantic import Field

from app.contracts import HwEnvelope, HwModel, Timestamp


class HwZigbeeStatusPermitJoinRequest(HwModel):
    seconds: int = Field(ge=0, le=254)  # 0 closes joining


class HwZigbeeNode(HwModel):
    ieee: str
    friendly_name: str
    model: str
    role: Literal["router", "end_device"]
    power_source: Literal["mains", "battery"]
    lqi: int | None = Field(ge=0, le=255)
    battery_pct: int | None = Field(ge=0, le=100)
    last_seen: Timestamp | None
    online: bool


class HwCoordinator(HwModel):
    model: str
    chipset: str
    firmware: str
    channel: int = Field(ge=11, le=26)
    tx_power_dbm: float
    port: str
    antenna: str
    status: Literal["online", "offline", "starting"]


class HwMeshData(HwModel):
    """Counts are derived by core-api from the node list."""

    joining_until: Timestamp | None


class HwZigbeeNodeEvent(HwEnvelope):
    type: Literal["zigbee.node"] = "zigbee.node"
    data: HwZigbeeNode


class HwZigbeeCoordinatorEvent(HwEnvelope):
    type: Literal["zigbee.coordinator"] = "zigbee.coordinator"
    data: HwCoordinator


class HwZigbeeMeshEvent(HwEnvelope):
    type: Literal["zigbee.mesh"] = "zigbee.mesh"
    data: HwMeshData


class HwZigbeeSnapshot(HwModel):
    """HwSnapshot.zigbee."""

    coordinator: HwCoordinator | None
    nodes: list[HwZigbeeNode]
    joining_until: Timestamp | None
```
3. Create `services/hw/app/modules/zigbee_status/service.py`:
```python
"""zigbee_status: coordinator, paired nodes and permit-join (ARCHITECTURE §7.2)."""

from collections.abc import Callable
from datetime import datetime
from typing import Protocol

from app.contracts import HwAck, HwDriverKind, guard
from app.events import EventBus
from app.modules.zigbee_status.schemas import (
    HwCoordinator,
    HwZigbeeCoordinatorEvent,
    HwZigbeeMeshEvent,
    HwZigbeeNode,
    HwZigbeeNodeEvent,
    HwZigbeeSnapshot,
    HwZigbeeStatusPermitJoinRequest,
)

ZigbeeEvent = HwZigbeeNodeEvent | HwZigbeeCoordinatorEvent | HwZigbeeMeshEvent
ZigbeeEmit = Callable[[ZigbeeEvent], None]


class ZigbeeStatusDriver(Protocol):
    kind: HwDriverKind

    async def start(self, emit: ZigbeeEmit) -> None: ...

    async def stop(self) -> None: ...

    async def permit_join(self, request: HwZigbeeStatusPermitJoinRequest) -> HwAck: ...


class ZigbeeStatusService:
    def __init__(self, driver: ZigbeeStatusDriver, bus: EventBus) -> None:
        self.driver = driver
        self._bus = bus
        self._coordinator: HwCoordinator | None = None
        self._nodes: dict[str, HwZigbeeNode] = {}  # by ieee, first-reported order
        self._joining_until: datetime | None = None

    async def start(self) -> None:
        await self.driver.start(self._on_event)

    async def stop(self) -> None:
        await self.driver.stop()

    def snapshot(self) -> HwZigbeeSnapshot:
        return HwZigbeeSnapshot(
            coordinator=self._coordinator,
            nodes=list(self._nodes.values()),
            joining_until=self._joining_until,
        )

    async def permit_join(self, request: HwZigbeeStatusPermitJoinRequest) -> HwAck:
        return await guard("zigbee_status", self.driver.permit_join(request))

    def _on_event(self, event: ZigbeeEvent) -> None:
        if isinstance(event, HwZigbeeNodeEvent):
            self._nodes[event.data.ieee] = event.data
        elif isinstance(event, HwZigbeeCoordinatorEvent):
            self._coordinator = event.data
        else:
            self._joining_until = event.data.joining_until
        self._bus.publish(event)
```
4. Create `services/hw/app/modules/zigbee_status/driver_real.py`:
```python
"""Real zigbee_status driver: stub until hardware intake.

[ASSUMED] zigbee2mqtt `bridge/*` topics; ZG-808Z coordinator (ARCHITECTURE §7.2).
"""

from app.config import Settings
from app.contracts import INTAKE_PENDING, HwAck, HwDriverKind
from app.modules.zigbee_status.schemas import HwZigbeeStatusPermitJoinRequest
from app.modules.zigbee_status.service import ZigbeeEmit


class RealZigbeeStatusDriver:
    kind: HwDriverKind = "real"

    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    async def start(self, emit: ZigbeeEmit) -> None:
        """Nothing to start before intake; coordinator stays null and the node list empty."""

    async def stop(self) -> None:
        """Nothing to stop."""

    async def permit_join(self, request: HwZigbeeStatusPermitJoinRequest) -> HwAck:
        raise NotImplementedError(INTAKE_PENDING)
```
5. Create `services/hw/app/modules/zigbee_status/driver_fake.py`:
```python
"""Fake Zigbee bridge: coordinator and nodes from config (HW_COORDINATOR, HW_ZIGBEE_NODES);
permit join opens the mesh and closes it again after `seconds` (scaled)."""

import asyncio
from datetime import datetime, timedelta

from fastapi import APIRouter

from app.config import Settings
from app.contracts import (
    ACK_OK,
    HwAck,
    HwAckError,
    HwAckOk,
    HwDriverKind,
    HwModel,
    ack_error,
    utc_now,
)
from app.fake_support import FakeTasks, scaled
from app.modules.zigbee_status.schemas import (
    HwCoordinator,
    HwMeshData,
    HwZigbeeCoordinatorEvent,
    HwZigbeeMeshEvent,
    HwZigbeeNode,
    HwZigbeeNodeEvent,
    HwZigbeeStatusPermitJoinRequest,
)
from app.modules.zigbee_status.service import ZigbeeEmit


class FakeZigbeeStatusDriver:
    kind: HwDriverKind = "fake"

    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._coordinator = HwCoordinator(**settings.coordinator.model_dump(), status="online")
        now = utc_now()
        self._nodes = {
            node.friendly_name: HwZigbeeNode(**node.model_dump(), last_seen=now, online=True)
            for node in settings.zigbee_nodes
        }
        self._emit: ZigbeeEmit | None = None
        self._tasks = FakeTasks()
        self._closer: asyncio.Task[None] | None = None

    async def start(self, emit: ZigbeeEmit) -> None:
        self._emit = emit
        emit(HwZigbeeCoordinatorEvent(data=self._coordinator))
        for node in self._nodes.values():
            emit(HwZigbeeNodeEvent(data=node))
        emit(HwZigbeeMeshEvent(data=HwMeshData(joining_until=None)))

    async def stop(self) -> None:
        await self._tasks.cancel_all()
        self._emit = None

    async def permit_join(self, request: HwZigbeeStatusPermitJoinRequest) -> HwAck:
        if self._coordinator.status != "online":
            return ack_error("device_offline", "Zigbee coordinator is offline")
        if self._closer is not None:
            self._closer.cancel()
            self._closer = None
        if request.seconds == 0:
            self._report_mesh(None)
            return ACK_OK
        duration_s = scaled(self._settings, request.seconds)
        self._report_mesh(utc_now() + timedelta(seconds=duration_s))
        self._closer = self._tasks.spawn(self._close_after(duration_s))
        return ACK_OK

    def set_node_online(self, friendly_name: str, online: bool) -> HwAckOk | HwAckError:
        node = self._nodes.get(friendly_name)
        if node is None:
            return ack_error("invalid", f"Unknown Zigbee node {friendly_name}")
        update = {"online": True, "last_seen": utc_now()} if online else {"online": False}
        self._nodes[friendly_name] = node.model_copy(update=update)
        if self._emit is not None:
            self._emit(HwZigbeeNodeEvent(data=self._nodes[friendly_name]))
        return ACK_OK

    def set_coordinator_online(self, online: bool) -> None:
        status = "online" if online else "offline"
        self._coordinator = self._coordinator.model_copy(update={"status": status})
        if self._emit is not None:
            self._emit(HwZigbeeCoordinatorEvent(data=self._coordinator))

    async def _close_after(self, duration_s: float) -> None:
        await asyncio.sleep(duration_s)
        self._closer = None
        self._report_mesh(None)

    def _report_mesh(self, joining_until: datetime | None) -> None:
        if self._emit is not None:
            self._emit(HwZigbeeMeshEvent(data=HwMeshData(joining_until=joining_until)))


class FakeNodeOnlineRequest(HwModel):
    friendly_name: str
    online: bool = False


class FakeOnlineRequest(HwModel):
    online: bool = False


def build_fake_router(driver: FakeZigbeeStatusDriver) -> APIRouter:
    router = APIRouter(prefix="/v1/_fake/zigbee_status", tags=["fake"])

    @router.post("/node_offline")
    async def node_offline(body: FakeNodeOnlineRequest) -> HwAckOk | HwAckError:
        return driver.set_node_online(body.friendly_name, body.online)

    @router.post("/coordinator_offline")
    async def coordinator_offline(body: FakeOnlineRequest | None = None) -> HwAckOk:
        driver.set_coordinator_online((body or FakeOnlineRequest()).online)
        return ACK_OK

    return router
```
6. Create `services/hw/app/modules/zigbee_status/router.py`:
```python
from fastapi import APIRouter

from app.contracts import HwAck
from app.modules.zigbee_status.schemas import HwZigbeeStatusPermitJoinRequest
from app.modules.zigbee_status.service import ZigbeeStatusService


def build_router(service: ZigbeeStatusService) -> APIRouter:
    router = APIRouter(prefix="/v1/zigbee_status", tags=["zigbee_status"])

    @router.post("/permit_join")
    async def permit_join(body: HwZigbeeStatusPermitJoinRequest) -> HwAck:
        return await service.permit_join(body)

    return router
```

**Test:** create `services/hw/tests/test_zigbee_status.py`:
```python
from datetime import timedelta

from app.config import ZigbeeNodeConfig
from app.contracts import ACK_OK, ack_error, utc_now
from app.events import EventBus, Subscription
from app.modules.zigbee_status.driver_fake import FakeZigbeeStatusDriver, build_fake_router
from app.modules.zigbee_status.driver_real import RealZigbeeStatusDriver
from app.modules.zigbee_status.router import build_router
from app.modules.zigbee_status.schemas import (
    HwZigbeeMeshEvent,
    HwZigbeeNodeEvent,
    HwZigbeeSnapshot,
    HwZigbeeStatusPermitJoinRequest,
)
from app.modules.zigbee_status.service import ZigbeeStatusService
from tests.helpers import drain, http_client, make_settings, next_event


async def start_fake(
    **overrides: object,
) -> tuple[ZigbeeStatusService, FakeZigbeeStatusDriver, Subscription]:
    bus = EventBus(64)
    sub = bus.subscribe()
    driver = FakeZigbeeStatusDriver(make_settings(**overrides))
    service = ZigbeeStatusService(driver, bus)
    await service.start()
    return service, driver, sub


async def test_fake_reports_coordinator_and_configured_nodes() -> None:
    service, _, _ = await start_fake()
    snapshot = service.snapshot()
    assert snapshot.coordinator is not None
    assert snapshot.coordinator.status == "online"
    assert snapshot.coordinator.channel == 25
    assert [n.friendly_name for n in snapshot.nodes] == [
        "r101_lights",
        "r101_proj_plug",
        "r101_temp",
        "r101_motion",
        "r101_door",
    ]
    assert all(n.online and n.last_seen is not None for n in snapshot.nodes)
    assert snapshot.joining_until is None


async def test_nodes_come_from_config() -> None:
    node = ZigbeeNodeConfig(
        ieee="0x01",
        friendly_name="r102_lights",
        model="ZBM5-2C-86W",
        role="router",
        power_source="mains",
        lqi=200,
        battery_pct=None,
    )
    service, _, _ = await start_fake(zigbee_nodes=[node])
    assert [n.friendly_name for n in service.snapshot().nodes] == ["r102_lights"]


async def test_permit_join_opens_then_closes_the_mesh() -> None:
    service, _, sub = await start_fake()
    drain(sub)
    before = utc_now()
    assert await service.permit_join(HwZigbeeStatusPermitJoinRequest(seconds=240)) == ACK_OK
    opened = await next_event(sub, HwZigbeeMeshEvent)
    assert opened.data.joining_until is not None
    assert before < opened.data.joining_until <= before + timedelta(seconds=1)  # 240 s / 1000
    assert service.snapshot().joining_until == opened.data.joining_until
    closed = await next_event(sub, HwZigbeeMeshEvent)
    assert closed.data.joining_until is None
    await service.stop()


async def test_permit_join_zero_closes_immediately() -> None:
    service, _, sub = await start_fake(fake_time_scale=1.0)
    await service.permit_join(HwZigbeeStatusPermitJoinRequest(seconds=240))
    drain(sub)
    await service.permit_join(HwZigbeeStatusPermitJoinRequest(seconds=0))
    assert (await next_event(sub, HwZigbeeMeshEvent)).data.joining_until is None
    await service.stop()


async def test_coordinator_offline_refuses_permit_join() -> None:
    service, driver, _ = await start_fake()
    driver.set_coordinator_online(False)
    snapshot = service.snapshot()
    assert snapshot.coordinator is not None
    assert snapshot.coordinator.status == "offline"
    ack = await service.permit_join(HwZigbeeStatusPermitJoinRequest(seconds=60))
    assert ack == ack_error("device_offline", "Zigbee coordinator is offline")


async def test_node_offline_and_back() -> None:
    service, driver, sub = await start_fake()
    drain(sub)
    assert driver.set_node_online("r101_door", False) == ACK_OK
    offline = await next_event(sub, HwZigbeeNodeEvent)
    assert (offline.data.friendly_name, offline.data.online) == ("r101_door", False)
    assert driver.set_node_online("r101_door", True) == ACK_OK
    assert (await next_event(sub, HwZigbeeNodeEvent)).data.online is True
    assert driver.set_node_online("r101_nope", False) == ack_error(
        "invalid", "Unknown Zigbee node r101_nope"
    )
    assert len(service.snapshot().nodes) == 5


async def test_real_driver_answers_transport_error() -> None:
    service = ZigbeeStatusService(RealZigbeeStatusDriver(make_settings()), EventBus(8))
    await service.start()
    ack = await service.permit_join(HwZigbeeStatusPermitJoinRequest(seconds=60))
    assert ack == ack_error("transport", "zigbee_status: hardware intake pending")
    assert service.snapshot() == HwZigbeeSnapshot(coordinator=None, nodes=[], joining_until=None)


async def test_routes() -> None:
    service, driver, _ = await start_fake()
    async with http_client(build_router(service), build_fake_router(driver)) as http:
        ok = await http.post("/v1/zigbee_status/permit_join", json={"seconds": 240})
        assert ok.json() == {"ok": True}
        bad = await http.post("/v1/zigbee_status/permit_join", json={"seconds": 255})
        assert bad.status_code == 422
        node = await http.post(
            "/v1/_fake/zigbee_status/node_offline", json={"friendly_name": "r101_temp"}
        )
        assert node.json() == {"ok": True}
        unknown = await http.post(
            "/v1/_fake/zigbee_status/node_offline", json={"friendly_name": "r101_nope"}
        )
        assert unknown.json()["error"]["code"] == "invalid"
        coordinator = await http.post("/v1/_fake/zigbee_status/coordinator_offline")
        assert coordinator.json() == {"ok": True}
    snapshot = service.snapshot()
    assert snapshot.coordinator is not None
    assert snapshot.coordinator.status == "offline"
    assert [n.online for n in snapshot.nodes if n.friendly_name == "r101_temp"] == [False]
    await service.stop()
```

**Verify:** `uv run --directory services/hw pytest tests/test_zigbee_status.py -q` → `8 passed`; `pnpm verify` green.

**Commit:** `git add services/hw docs/plans/PLAN-M07-hw-service-skeleton.md && git commit -m "feat(hw): zigbee status module with fake bridge"`

---

### T14 — `HwSnapshot` / `HwEvent` and the contract-fixture round trip
- [x] done

**Files:** `services/hw/app/snapshot.py`, `services/hw/tests/test_contract_fixtures.py`

**Context:** zod `hw/snapshot.ts` (`HwSnapshot`) and `hw/events.ts` (`HwEvent`, 15 types). ARCHITECTURE §3.4
"Keeping pydantic in sync" step 3; `packages/contracts/fixtures/README.md` (file name → schema rule, model names equal
zod names). The fixtures live at `<repo>/packages/contracts/fixtures/hw`, i.e. `parents[3]` of the test file (the
milestone's "../../packages/…" is relative to `services/hw`, not to the test file). Each fixture is parsed with
`TypeAdapter(model).validate_python`, dumped with `mode="json"` and compared with the raw JSON (`287 == 287.0` in
Python, timestamps keep their `Z`). An unknown field fails because every model forbids extras — AC8.

**Do:**
1. Create `services/hw/app/snapshot.py`:
```python
"""HwSnapshot and the HwEvent union. Mirrors packages/contracts/src/hw/snapshot.ts and events.ts.

Lives apart from app/contracts.py because it needs every module's schemas.
"""

from typing import Annotated, Literal

from pydantic import Field

from app.contracts import HwEnvelope, HwErrorEvent, HwHeartbeatEvent, HwModel
from app.modules.audio.schemas import HwAudioSnapshot, HwAudioStateEvent
from app.modules.hdmi.schemas import HwHdmiSnapshot, HwHdmiStateEvent
from app.modules.ir.schemas import HwIrBlasterEvent, HwIrLearnEvent, HwIrSnapshot
from app.modules.lights.schemas import HwLightsSnapshot, HwLightsStateEvent
from app.modules.projection_screen.schemas import (
    HwProjectionScreenSnapshot,
    HwProjectionScreenStateEvent,
)
from app.modules.projector_power.schemas import (
    HwProjectorPowerReadingEvent,
    HwProjectorPowerRelayEvent,
    HwProjectorPowerSnapshot,
)
from app.modules.sensors.schemas import HwSensorSample, HwSensorsReadingEvent
from app.modules.zigbee_status.schemas import (
    HwZigbeeCoordinatorEvent,
    HwZigbeeMeshEvent,
    HwZigbeeNodeEvent,
    HwZigbeeSnapshot,
)


class HwSnapshot(HwModel):
    """GET /v1/snapshot and the first SSE event. null = not known yet."""

    lights: HwLightsSnapshot
    projector_power: HwProjectorPowerSnapshot
    hdmi: HwHdmiSnapshot
    projection_screen: HwProjectionScreenSnapshot
    audio: HwAudioSnapshot
    sensors: list[HwSensorSample]  # latest reading per (node, kind)
    zigbee: HwZigbeeSnapshot
    ir: HwIrSnapshot


class HwSnapshotEvent(HwEnvelope):
    type: Literal["snapshot"] = "snapshot"
    data: HwSnapshot


# One SSE event from GET /v1/events. SSE `event:` equals `type`.
HwEvent = Annotated[
    HwSnapshotEvent
    | HwLightsStateEvent
    | HwProjectorPowerRelayEvent
    | HwProjectorPowerReadingEvent
    | HwHdmiStateEvent
    | HwProjectionScreenStateEvent
    | HwAudioStateEvent
    | HwSensorsReadingEvent
    | HwZigbeeNodeEvent
    | HwZigbeeCoordinatorEvent
    | HwZigbeeMeshEvent
    | HwIrBlasterEvent
    | HwIrLearnEvent
    | HwErrorEvent
    | HwHeartbeatEvent,
    Field(discriminator="type"),
]
```

**Test:** create `services/hw/tests/test_contract_fixtures.py`:
```python
"""Every packages/contracts/fixtures/hw/*.json parses with its pydantic model and round-trips
unchanged (ARCHITECTURE §3.4). File name → model rule: packages/contracts/fixtures/README.md."""

import json
from pathlib import Path
from types import ModuleType

import pytest
from pydantic import TypeAdapter

from app import contracts, snapshot
from app.modules.audio import schemas as audio
from app.modules.hdmi import schemas as hdmi
from app.modules.ir import schemas as ir
from app.modules.lights import schemas as lights
from app.modules.projection_screen import schemas as projection_screen
from app.modules.projector_power import schemas as projector_power
from app.modules.sensors import schemas as sensors
from app.modules.zigbee_status import schemas as zigbee_status

FIXTURES = Path(__file__).resolve().parents[3] / "packages" / "contracts" / "fixtures" / "hw"
SCHEMA_MODULES: tuple[ModuleType, ...] = (
    contracts,
    snapshot,
    lights,
    projector_power,
    ir,
    hdmi,
    projection_screen,
    audio,
    sensors,
    zigbee_status,
)


def pascal(part: str) -> str:
    return "".join(word.capitalize() for word in part.split("_"))


def schema_for(file_name: str) -> tuple[str, str | None]:
    """(schema name, expected event type or None) for a fixture file name."""
    parts = file_name.removesuffix(".json").split(".")
    match parts:
        case ["event", *event_type] if event_type:
            return "HwEvent", ".".join(event_type)
        case ["request", module, action]:
            return f"Hw{pascal(module)}{pascal(action)}Request", None
        case ["response", name] | ["response", name, _]:
            return f"Hw{pascal(name)}", None
    raise ValueError(f"{file_name} does not follow the fixture naming rule")


def find_schema(name: str) -> object:
    for module in SCHEMA_MODULES:
        if hasattr(module, name):
            return getattr(module, name)
    raise LookupError(f"no pydantic model named {name} (zod and pydantic names must match)")


FIXTURE_FILES = sorted(FIXTURES.glob("*.json"))


def test_naming_rule_examples() -> None:
    assert schema_for("event.lights.state.json") == ("HwEvent", "lights.state")
    assert schema_for("request.zigbee_status.permit_join.json") == (
        "HwZigbeeStatusPermitJoinRequest",
        None,
    )
    assert schema_for("response.ack.error.json") == ("HwAck", None)
    assert schema_for("response.ir_learn_result.timeout.json") == ("HwIrLearnResult", None)


def test_fixture_directory_is_found() -> None:
    assert len(FIXTURE_FILES) >= 31, f"expected the M01 fixtures in {FIXTURES}"


@pytest.mark.parametrize("path", FIXTURE_FILES, ids=lambda path: path.name)
def test_fixture_round_trips(path: Path) -> None:
    name, event_type = schema_for(path.name)
    adapter: TypeAdapter[object] = TypeAdapter(find_schema(name))
    raw = json.loads(path.read_text())
    parsed = adapter.validate_python(raw)
    assert adapter.dump_python(parsed, mode="json") == raw
    if event_type is not None:
        assert raw["type"] == event_type
```

**Verify:** `uv run --directory services/hw pytest tests/test_contract_fixtures.py -q` → `33 passed` (31 fixtures + 2
rule tests). `pnpm verify` green.

**Commit:** `git add services/hw docs/plans/PLAN-M07-hw-service-skeleton.md && git commit -m "test(hw): pydantic models round-trip every hw contract fixture"`

---

### T15 — Registry: `HW_MODE`, `HW_DRIVERS`, fake routes, IR → projector wiring
- [x] done

**Files:** `services/hw/app/registry.py`, `services/hw/tests/test_registry.py`

**Context:** ARCHITECTURE §7.1 (`registry.py` picks fake/real per module; `HW_DRIVERS="lights=real,ir=fake"`), D-19,
D1 (fake routers only for fake drivers), D7 (the fake blaster feeds the fake projector only when both are fake). A
typo in `HW_DRIVERS` raises `ValueError` whose message starts with `HW_DRIVERS:` (T16 turns it into an exit).

**Do:**
1. Create `services/hw/app/registry.py`:
```python
"""Builds every capability service with its fake or real driver (ARCHITECTURE §7.1, D-19).

`HW_MODE` picks the default; `HW_DRIVERS="lights=real,ir=fake"` overrides single modules.
"""

from dataclasses import dataclass, field
from typing import get_args

from fastapi import APIRouter

from app.config import Settings
from app.contracts import HwDriverKind, HwHealth, HwHealthModules, HwModule
from app.events import EventBus
from app.modules.audio import driver_fake as audio_fake
from app.modules.audio import router as audio_router
from app.modules.audio.driver_real import RealAudioDriver
from app.modules.audio.service import AudioService
from app.modules.hdmi import router as hdmi_router
from app.modules.hdmi.driver_fake import FakeHdmiDriver
from app.modules.hdmi.driver_real import RealHdmiDriver
from app.modules.hdmi.service import HdmiService
from app.modules.ir import driver_fake as ir_fake
from app.modules.ir import router as ir_router
from app.modules.ir.driver_real import RealIrDriver
from app.modules.ir.service import IrService
from app.modules.lights import driver_fake as lights_fake
from app.modules.lights import router as lights_router
from app.modules.lights.driver_real import RealLightsDriver
from app.modules.lights.service import LightsService
from app.modules.projection_screen import router as screen_router
from app.modules.projection_screen.driver_fake import FakeProjectionScreenDriver
from app.modules.projection_screen.driver_real import RealProjectionScreenDriver
from app.modules.projection_screen.service import ProjectionScreenService
from app.modules.projector_power import driver_fake as power_fake
from app.modules.projector_power import router as power_router
from app.modules.projector_power.driver_real import RealProjectorPowerDriver
from app.modules.projector_power.service import ProjectorPowerService
from app.modules.sensors import driver_fake as sensors_fake
from app.modules.sensors import router as sensors_router
from app.modules.sensors.driver_real import RealSensorsDriver
from app.modules.sensors.service import SensorsService
from app.modules.zigbee_status import driver_fake as zigbee_fake
from app.modules.zigbee_status import router as zigbee_router
from app.modules.zigbee_status.driver_real import RealZigbeeStatusDriver
from app.modules.zigbee_status.service import ZigbeeStatusService
from app.snapshot import HwSnapshot, HwSnapshotEvent

MODULES: tuple[HwModule, ...] = get_args(HwModule)


def parse_driver_overrides(raw: str) -> dict[HwModule, HwDriverKind]:
    """ "lights=real, ir=fake" → {"lights": "real", "ir": "fake"}. Raises ValueError on typos."""
    overrides: dict[HwModule, HwDriverKind] = {}
    for item in raw.split(","):
        if not item.strip():
            continue
        name, _, kind = (part.strip() for part in item.partition("="))
        module = next((m for m in MODULES if m == name), None)
        driver = next((k for k in get_args(HwDriverKind) if k == kind), None)
        if module is None or driver is None:
            raise ValueError(
                f"HW_DRIVERS: bad entry {item.strip()!r}; expected <module>=fake|real with "
                f"<module> one of {', '.join(MODULES)}"
            )
        overrides[module] = driver
    return overrides


def driver_kinds(settings: Settings) -> dict[HwModule, HwDriverKind]:
    overrides = parse_driver_overrides(settings.drivers)
    return {module: overrides.get(module, settings.mode) for module in MODULES}


@dataclass
class Registry:
    settings: Settings
    lights: LightsService
    projector_power: ProjectorPowerService
    ir: IrService
    hdmi: HdmiService
    projection_screen: ProjectionScreenService
    audio: AudioService
    sensors: SensorsService
    zigbee_status: ZigbeeStatusService
    fake_routers: list[APIRouter] = field(default_factory=list)

    def routers(self) -> list[APIRouter]:
        return [
            lights_router.build_router(self.lights),
            power_router.build_router(self.projector_power),
            ir_router.build_router(self.ir),
            hdmi_router.build_router(self.hdmi),
            screen_router.build_router(self.projection_screen),
            audio_router.build_router(self.audio),
            sensors_router.build_router(self.sensors),
            zigbee_router.build_router(self.zigbee_status),
            *self.fake_routers,
        ]

    async def start(self) -> None:
        await self.lights.start()
        await self.projector_power.start()
        await self.ir.start()
        await self.hdmi.start()
        await self.projection_screen.start()
        await self.audio.start()
        await self.sensors.start()
        await self.zigbee_status.start()

    async def stop(self) -> None:
        await self.zigbee_status.stop()
        await self.sensors.stop()
        await self.audio.stop()
        await self.projection_screen.stop()
        await self.hdmi.stop()
        await self.ir.stop()
        await self.projector_power.stop()
        await self.lights.stop()

    def health(self) -> HwHealth:
        modules = HwHealthModules(
            lights=self.lights.driver.kind,
            projector_power=self.projector_power.driver.kind,
            ir=self.ir.driver.kind,
            hdmi=self.hdmi.driver.kind,
            projection_screen=self.projection_screen.driver.kind,
            audio=self.audio.driver.kind,
            sensors=self.sensors.driver.kind,
            zigbee_status=self.zigbee_status.driver.kind,
        )
        return HwHealth(ok=True, mode=self.settings.mode, modules=modules)

    def snapshot(self) -> HwSnapshot:
        return HwSnapshot(
            lights=self.lights.snapshot(),
            projector_power=self.projector_power.snapshot(),
            hdmi=self.hdmi.snapshot(),
            projection_screen=self.projection_screen.snapshot(),
            audio=self.audio.snapshot(),
            sensors=self.sensors.snapshot(),
            zigbee=self.zigbee_status.snapshot(),
            ir=self.ir.snapshot(),
        )

    def snapshot_event(self) -> HwSnapshotEvent:
        return HwSnapshotEvent(data=self.snapshot())


def build_registry(settings: Settings, bus: EventBus) -> Registry:
    kinds = driver_kinds(settings)
    fake_routers: list[APIRouter] = []

    lights_fake_driver: lights_fake.FakeLightsDriver | None = None
    if kinds["lights"] == "fake":
        lights_fake_driver = lights_fake.FakeLightsDriver(settings)
        fake_routers.append(lights_fake.build_fake_router(lights_fake_driver))
    lights = LightsService(lights_fake_driver or RealLightsDriver(settings), bus)

    power_fake_driver: power_fake.FakeProjectorPowerDriver | None = None
    if kinds["projector_power"] == "fake":
        power_fake_driver = power_fake.FakeProjectorPowerDriver(settings)
        fake_routers.append(power_fake.build_fake_router(power_fake_driver))
    projector_power = ProjectorPowerService(
        power_fake_driver or RealProjectorPowerDriver(settings), bus
    )

    ir_fake_driver: ir_fake.FakeIrDriver | None = None
    if kinds["ir"] == "fake":
        ir_fake_driver = ir_fake.FakeIrDriver(settings)
        fake_routers.append(ir_fake.build_fake_router(ir_fake_driver))
        if power_fake_driver is not None:
            # The fake projector "sees" every code the fake blaster sends.
            ir_fake_driver.add_listener(power_fake_driver.ir_received)
    ir = IrService(ir_fake_driver or RealIrDriver(settings), bus)

    hdmi = HdmiService(
        FakeHdmiDriver(settings) if kinds["hdmi"] == "fake" else RealHdmiDriver(settings), bus
    )
    projection_screen = ProjectionScreenService(
        FakeProjectionScreenDriver(settings)
        if kinds["projection_screen"] == "fake"
        else RealProjectionScreenDriver(settings),
        bus,
    )
    audio = AudioService(
        audio_fake.FakeAudioDriver(settings)
        if kinds["audio"] == "fake"
        else RealAudioDriver(settings),
        bus,
    )

    sensors_fake_driver: sensors_fake.FakeSensorsDriver | None = None
    if kinds["sensors"] == "fake":
        sensors_fake_driver = sensors_fake.FakeSensorsDriver(settings)
        fake_routers.append(sensors_fake.build_fake_router(sensors_fake_driver))
    sensors = SensorsService(sensors_fake_driver or RealSensorsDriver(settings), bus)

    zigbee_fake_driver: zigbee_fake.FakeZigbeeStatusDriver | None = None
    if kinds["zigbee_status"] == "fake":
        zigbee_fake_driver = zigbee_fake.FakeZigbeeStatusDriver(settings)
        fake_routers.append(zigbee_fake.build_fake_router(zigbee_fake_driver))
    zigbee_status = ZigbeeStatusService(zigbee_fake_driver or RealZigbeeStatusDriver(settings), bus)

    return Registry(
        settings=settings,
        lights=lights,
        projector_power=projector_power,
        ir=ir,
        hdmi=hdmi,
        projection_screen=projection_screen,
        audio=audio,
        sensors=sensors,
        zigbee_status=zigbee_status,
        fake_routers=fake_routers,
    )
```

**Test:** create `services/hw/tests/test_registry.py`:
```python
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

**Verify:** `uv run --directory services/hw pytest tests/test_registry.py -q` → `12 passed`; `pnpm verify` green.

**Commit:** `git add services/hw docs/plans/PLAN-M07-hw-service-skeleton.md && git commit -m "feat(hw): driver registry with per-module overrides"`

---

### T16 — `app/main.py`: `create_app`, lifespan, health, snapshot, events, loopback guard
- [x] done

**Files:** `services/hw/app/main.py`, `services/hw/tests/test_main.py`

**Context:** ARCHITECTURE §3.4 (`GET /v1/health`, `GET /v1/snapshot`, `GET /v1/events`), §7.1 ("`main.py` refuses to
start if `HW_HOST` is not a loopback address"). `require_loopback` accepts `localhost` and any loopback IP
(127.0.0.0/8, `::1`); anything else raises `SystemExit("HW_HOST must be a loopback address (127.0.0.1), got
'<host>'")`; uvicorn prints just that line and exits with status 1 (AC6). A bad `HW_DRIVERS` exits the same way. The
lifespan starts every service (fake drivers report their initial state), runs `heartbeat` every `HW_HEARTBEAT_S`,
and on shutdown cancels the heartbeat and stops every service. `app.state.bus` / `app.state.registry` are set for
debugging and tests. `app = create_app()` at module level is what `uvicorn app.main:app` loads.

**Do:**
1. Create `services/hw/app/main.py`:
```python
"""hw-service entry point: `uv run uvicorn app.main:app --host 127.0.0.1 --port 8081`."""

import asyncio
import ipaddress
import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager, suppress

from fastapi import FastAPI
from sse_starlette import EventSourceResponse

from app.config import Settings
from app.contracts import HwHealth
from app.events import EventBus, event_stream, heartbeat
from app.registry import build_registry
from app.snapshot import HwSnapshot


def require_loopback(host: str) -> None:
    """hw-service is core-api's private backend and never listens on the LAN."""
    try:
        loopback = host == "localhost" or ipaddress.ip_address(host).is_loopback
    except ValueError:
        loopback = False
    if not loopback:
        raise SystemExit(f"HW_HOST must be a loopback address (127.0.0.1), got {host!r}")


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or Settings()
    require_loopback(settings.host)
    logging.basicConfig(level=logging.INFO)
    bus = EventBus(settings.subscriber_queue)
    try:
        registry = build_registry(settings, bus)
    except ValueError as exc:
        raise SystemExit(str(exc)) from exc

    @asynccontextmanager
    async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
        await registry.start()
        beat = asyncio.create_task(heartbeat(bus, settings.heartbeat_s))
        try:
            yield
        finally:
            beat.cancel()
            with suppress(asyncio.CancelledError):
                await beat
            await registry.stop()

    app = FastAPI(title="Eduscope hw-service", version="0.0.0", lifespan=lifespan)
    app.state.bus = bus
    app.state.registry = registry
    for router in registry.routers():
        app.include_router(router)

    @app.get("/v1/health")
    async def health() -> HwHealth:
        return registry.health()

    @app.get("/v1/snapshot")
    async def snapshot() -> HwSnapshot:
        return registry.snapshot()

    @app.get("/v1/events")
    async def events() -> EventSourceResponse:
        return EventSourceResponse(event_stream(bus, registry.snapshot_event))

    return app


app = create_app()
```

**Test:** create `services/hw/tests/test_main.py`:
```python
import json
from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import create_app, require_loopback
from tests.helpers import make_settings

FIXTURES = Path(__file__).resolve().parents[3] / "packages" / "contracts" / "fixtures" / "hw"


@pytest.fixture
def client() -> Iterator[TestClient]:
    with TestClient(create_app(make_settings())) as http:
        yield http


@pytest.mark.parametrize("host", ["127.0.0.1", "127.0.0.2", "::1", "localhost"])
def test_loopback_hosts_are_accepted(host: str) -> None:
    require_loopback(host)


@pytest.mark.parametrize("host", ["0.0.0.0", "192.168.1.20", "::", "r-101.local"])
def test_other_hosts_refuse_to_start(host: str) -> None:
    with pytest.raises(SystemExit, match="HW_HOST must be a loopback address"):
        create_app(make_settings(host=host))


def test_bad_driver_override_refuses_to_start() -> None:
    with pytest.raises(SystemExit, match="HW_DRIVERS"):
        create_app(make_settings(drivers="lights=on"))


def test_health_in_fake_mode_matches_the_contract_fixture(client: TestClient) -> None:
    expected = json.loads((FIXTURES / "response.health.json").read_text())
    assert client.get("/v1/health").json() == expected


def test_snapshot_has_every_module(client: TestClient) -> None:
    body = client.get("/v1/snapshot").json()
    assert body["lights"] == {"front": True, "rear": False}
    assert body["hdmi"] == {"input": "podium_pc"}
    assert body["projection_screen"] == {"position": "lowered"}
    assert body["ir"]["blaster"] == {"online": True, "lqi": 196}
    assert len(body["zigbee"]["nodes"]) == 5
    assert len(body["sensors"]) == 4


def test_commands_change_the_snapshot(client: TestClient) -> None:
    ack = client.post("/v1/lights/set", json={"gang": "rear", "on": True})
    assert ack.status_code == 200
    assert ack.json() == {"ok": True}
    assert client.get("/v1/snapshot").json()["lights"]["rear"] is True


def test_invalid_body_is_422(client: TestClient) -> None:
    assert client.post("/v1/lights/set", json={"gang": "middle"}).status_code == 422


def test_real_lights_answer_transport_error_without_crashing() -> None:
    with TestClient(create_app(make_settings(drivers="lights=real"))) as http:
        assert http.get("/v1/health").json()["modules"]["lights"] == "real"
        ack = http.post("/v1/lights/set", json={"gang": "rear", "on": True})
        assert ack.status_code == 200
        assert ack.json() == {
            "ok": False,
            "error": {"code": "transport", "message": "lights: hardware intake pending"},
        }
        assert http.get("/v1/snapshot").json()["lights"] == {"front": None, "rear": None}


def test_real_mode_has_no_fake_routes() -> None:
    with TestClient(create_app(make_settings(mode="real"))) as http:
        assert http.get("/v1/health").json()["mode"] == "real"
        assert http.post("/v1/_fake/lights/by_hand").status_code == 404
```

**Verify:** `uv run --directory services/hw pytest tests/test_main.py -q` → `15 passed`; `pnpm verify` green. Then
`uv run --directory services/hw uvicorn app.main:app --port 8081` starts (`Application startup complete.`) and
`curl -s 127.0.0.1:8081/v1/health` prints the AC1 JSON; stop it with Ctrl+C (clean shutdown, no traceback).

**Commit:** `git add services/hw docs/plans/PLAN-M07-hw-service-skeleton.md && git commit -m "feat(hw): app factory with health, snapshot, events and loopback guard"`

---

### T17 — `GET /v1/events` end to end over real HTTP
- [x] done

**Files:** `services/hw/tests/test_events_http.py`

**Context:** D11. `TestClient` buffers the whole response, so an endless SSE stream never returns; this test runs the
app in uvicorn on an ephemeral port (`port=0`) in a daemon thread, streams with `httpx`, parses `event:`/`data:` lines
and validates **every frame** against `HwEvent`. Covers AC2 (snapshot first, heartbeats, sensor readings) and AC3
(a command's echo shows up on the stream).

**Test:** create `services/hw/tests/test_events_http.py`:
```python
"""GET /v1/events end to end against a real uvicorn (TestClient cannot read an endless stream)."""

import json
import threading
import time
from collections.abc import Iterator

import httpx
import pytest
import uvicorn
from pydantic import TypeAdapter

from app.main import create_app
from app.snapshot import HwEvent
from tests.helpers import make_settings

hw_event: TypeAdapter[HwEvent] = TypeAdapter(HwEvent)


@pytest.fixture
def base_url() -> Iterator[str]:
    app = create_app(make_settings(heartbeat_s=0.2, fake_report_interval_s=0.1))
    server = uvicorn.Server(uvicorn.Config(app, host="127.0.0.1", port=0, log_level="warning"))
    thread = threading.Thread(target=server.run, daemon=True)
    thread.start()
    deadline = time.monotonic() + 5
    while not server.started:
        assert time.monotonic() < deadline, "uvicorn did not start"
        time.sleep(0.01)
    port = server.servers[0].sockets[0].getsockname()[1]
    yield f"http://127.0.0.1:{port}"
    server.should_exit = True
    thread.join(5)


def read_events(lines: Iterator[str]) -> Iterator[tuple[str, dict[str, object]]]:
    """(SSE event name, parsed data) per event; comment lines (pings) are skipped."""
    name = ""
    for line in lines:
        if line.startswith("event: "):
            name = line.removeprefix("event: ")
        elif line.startswith("data: "):
            yield name, json.loads(line.removeprefix("data: "))


def test_stream_starts_with_snapshot_then_heartbeats_and_readings(base_url: str) -> None:
    seen: list[str] = []
    with httpx.stream("GET", f"{base_url}/v1/events", timeout=5) as response:
        assert response.headers["content-type"].startswith("text/event-stream")
        for name, data in read_events(response.iter_lines()):
            assert data["type"] == name
            hw_event.validate_python(data)  # every frame matches the contract
            seen.append(name)
            if "heartbeat" in seen and "sensors.reading" in seen:
                break
    assert seen[0] == "snapshot"


def test_command_shows_up_on_the_stream(base_url: str) -> None:
    with httpx.stream("GET", f"{base_url}/v1/events", timeout=5) as response:
        events = read_events(response.iter_lines())
        assert next(events)[0] == "snapshot"
        ack = httpx.post(f"{base_url}/v1/lights/set", json={"gang": "rear", "on": True})
        assert ack.json() == {"ok": True}
        for name, data in events:
            if name == "lights.state":
                assert data["data"] == {"gang": "rear", "on": True}
                break
```

**Verify:** `uv run --directory services/hw pytest tests/test_events_http.py -q` → `2 passed` in about 1 s;
`pnpm verify` green.

**Commit:** `git add services/hw docs/plans/PLAN-M07-hw-service-skeleton.md && git commit -m "test(hw): event stream end to end over http"`

---

### T18 — `transports/mqtt.py` placeholder
- [x] done

**Files:** `services/hw/app/transports/__init__.py` (empty), `services/hw/app/transports/mqtt.py`

**Context:** milestone Out of scope: "`transports/mqtt.py` is an empty placeholder module with the `[ASSUMED]` note".
ARCHITECTURE §7.1/§7.3. No MQTT dependency is added (`aiomqtt` arrives with the first real zigbee driver).

**Do:**
1. Create empty `services/hw/app/transports/__init__.py`.
2. Create `services/hw/app/transports/mqtt.py`:
```python
"""Shared zigbee2mqtt client for the real zigbee drivers. [ASSUMED] (ARCHITECTURE §7.1, §7.3)

Placeholder: hardware intake confirms whether Zigbee runs through zigbee2mqtt + mosquitto on the
Pi (localhost only). Until then nothing imports this module and no MQTT library is installed.
"""
```

**Verify:** `pnpm verify` green (no new tests: the module has no code).

**Commit:** `git add services/hw docs/plans/PLAN-M07-hw-service-skeleton.md && git commit -m "chore(hw): mqtt transport placeholder"`

---

### T19 — `pnpm dev` also starts hw-service (fake)
- [ ] done

**Files:** `package.json`

**Context:** milestone Scope ("`pnpm dev` starts hw-service alongside the kiosk"), ARCHITECTURE §2 (dev: hw on
`:8081`, `HW_MODE=fake`), D13. pnpm runs every root script matching the regex in parallel; do **not** add
`--parallel` to `pnpm run "/…/"` (that switches to recursive mode and fails with `ERR_PNPM_RECURSIVE_RUN_NO_SCRIPT`).

**Do:**
1. In `package.json` replace:
```json
    "dev": "pnpm -r --parallel --if-present dev",
```
with:
```json
    "dev": "pnpm run \"/^dev:/\"",
    "dev:apps": "pnpm -r --parallel --if-present dev",
    "dev:hw": "uv run --directory services/hw uvicorn app.main:app --host 127.0.0.1 --port 8081 --reload",
```

**Verify:** run `pnpm dev` (with nothing else on :5173 / :8081). Output shows lines prefixed `dev:hw:` ending in
`Application startup complete.` and `dev:apps:` lines with the kiosk's Vite URL. In a second terminal
`curl -s 127.0.0.1:8081/v1/health` → the AC1 JSON and `curl -s -o /dev/null -w '%{http_code}\n' localhost:5173` → `200`.
Ctrl+C stops both. `pnpm verify` green.

**Commit:** `git commit -am "chore: pnpm dev starts the fake hw-service"`

---

### T20 — Acceptance walk-through (M07 criteria)
- [ ] done

**Files:** `docs/plans/PLAN-M07-hw-service-skeleton.md` (tick boxes only)

**Context:** every acceptance criterion of M07, in order. Run from the repo root. "Terminal A/B" = two terminals.
Start fresh each time with Ctrl+C on the server. Write the observed result next to each item in your report.

**Do:**
1. **AC1.** Terminal A: `uv run --directory services/hw uvicorn app.main:app --port 8081`. Terminal B:
   `curl -s 127.0.0.1:8081/v1/health` → exactly
   `{"ok":true,"mode":"fake","modules":{"lights":"fake","projector_power":"fake","ir":"fake","hdmi":"fake","projection_screen":"fake","audio":"fake","sensors":"fake","zigbee_status":"fake"}}`.
   (Automated twin: `tests/test_main.py::test_health_in_fake_mode_matches_the_contract_fixture`.)
2. **AC2.** Keep A running but restart it as
   `HW_FAKE_REPORT_INTERVAL_S=3 uv run --directory services/hw uvicorn app.main:app --port 8081` (default interval is
   10 s; 3 s makes the check quick). Terminal B: `curl -N 127.0.0.1:8081/v1/events` → first block is `event: snapshot`,
   then `event: heartbeat` every 5 s and `event: sensors.reading` (temperature + humidity for `r101_temp`) every 3 s
   (plus `projector_power.reading`). (Automated twin: `tests/test_events_http.py`.)
3. **AC3.** With B's stream open, Terminal C:
   `curl -XPOST 127.0.0.1:8081/v1/lights/set -d '{"gang":"rear","on":true}' -H 'content-type: application/json'` →
   `{"ok":true}`; B shows `event: lights.state` with `"data":{"gang":"rear","on":true}`.
4. **AC4.** Restart A as `HW_FAKE_TIME_SCALE=60 uv run --directory services/hw uvicorn app.main:app --port 8081`
   (D5: the variable is `HW_FAKE_TIME_SCALE`). B: `curl -N 127.0.0.1:8081/v1/events`. C:
   `curl -XPOST 127.0.0.1:8081/v1/ir/send -H 'content-type: application/json' -d @packages/contracts/fixtures/hw/request.ir.send.json`
   → `{"ok":true}`; within ~1 s B shows `projector_power.reading` watts 12.0, 24.0, 36.0, 48.0 (5–50 W), 160.0, then
   287.0, and later readings stay at 287.0.
5. **AC5.** C: `curl -XPOST 127.0.0.1:8081/v1/_fake/lights/by_hand` → `{"ok":true}`; B shows a `lights.state` event
   (rear flipped) without any command.
6. **AC6a.** `HW_HOST=0.0.0.0 uv run --directory services/hw uvicorn app.main:app --port 8081; echo "exit=$?"` → prints
   exactly `HW_HOST must be a loopback address (127.0.0.1), got '0.0.0.0'` (no traceback) and `exit=1`.
7. **AC6b.** A: `HW_DRIVERS=lights=real uv run --directory services/hw uvicorn app.main:app --port 8081`. C:
   `curl -s 127.0.0.1:8081/v1/health` → `"lights":"real"`, the others `"fake"`;
   `curl -s -XPOST 127.0.0.1:8081/v1/lights/set -d '{"gang":"rear","on":true}' -H 'content-type: application/json'` →
   `{"ok":false,"error":{"code":"transport","message":"lights: hardware intake pending"}}`; the server keeps running
   (`curl -s 127.0.0.1:8081/v1/health` still answers).
8. **AC7.** C: `curl -s -o /dev/null -w '%{http_code}\n' -XPOST 127.0.0.1:8081/v1/lights/set -d '{"gang":"middle"}' -H 'content-type: application/json'` → `422`.
9. **AC8a.** `pnpm verify` → exit 0; its output contains ruff `All checks passed!`, `… files already formatted`
   and pytest `133 passed`.
10. **AC8b.** Delete the line `    volts: NonNegative` inside `class HwPowerReadingData` in
    `services/hw/app/modules/projector_power/schemas.py`; run
    `uv run --directory services/hw pytest tests/test_contract_fixtures.py -q` → `1 failed, 32 passed`
    (`event.projector_power.reading.json`). Restore it with `git checkout services/hw/app/modules/projector_power/schemas.py`
    and re-run → `33 passed`. `git status` must be clean apart from the plan file.
11. **Scope check.** `git diff --stat m07-start -- apps packages` → empty (no kiosk, core-api or contract change).
12. **[ON PI] (optional, otherwise done in M10).** On the Pi: `uv sync --directory services/hw && HW_MODE=real uv run
    --directory services/hw uvicorn app.main:app --port 8081` → health shows every module `"real"`; every command
    answers `{"ok":false,"error":{"code":"transport",…}}`. This only proves the service installs and runs on the Pi's
    Python/arch; real drivers are written by hardware intake.
13. Tick every T1–T20 box.

**Verify:** all items above as stated.

**Commit:** `git commit -am "docs: M07 acceptance walk-through"`

## Checkpoints

- After T13: nothing to look at; `pnpm verify` shows 71 hw tests passing.
- After T16: "Human: run `uv run --directory services/hw uvicorn app.main:app --port 8081`, open
  `http://127.0.0.1:8081/docs` and check every §3.4 endpoint plus the six `/v1/_fake/...` routes are listed."
- After T19: "Human: run `pnpm dev`; the kiosk still works in mock mode at `http://localhost:5173` and
  `curl -N 127.0.0.1:8081/v1/events` streams."
- After T20: M07 done → M08 can point core-api's hw client at `http://127.0.0.1:8081`.

## Blockers

(executor writes here; leave empty)

## Nice-to-haves (not tasks)

- Switch the test client to `httpx2` once Starlette drops `httpx` support (today it only warns; filtered, D15).
- A fake route to force the next IR learn to time out with a long `timeout_s` (today: blaster offline or
  `timeout_s < 3`), for an M09 walk-through like M06's "Next capture: nothing received".
- Make "node offline" for `r101_lights` / `r101_proj_plug` also fail that module's commands (fake modules are
  independent today).
- Random-walk the fake climate values instead of independent jitter around the base value.
- `.env.example` for `services/hw` (M10 adds `deploy/pi/env/hw.env.example`).
