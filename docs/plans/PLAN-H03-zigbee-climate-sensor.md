# PLAN-H03 — Zigbee climate sensor (SNZB-02P) live
Milestone: `docs/milestones/H03-zigbee-climate-sensor.md` · Start tag: `h03-start` · Verify-all: `pnpm verify`

Inputs read for this plan: H03 (incl. "Observed on the Pi"); ARCHITECTURE §7.1–§7.2 (`sensors` row); SPEC S1.E41–E43,
S2.E16, H10, H11, R13, Q12; CLAUDE.md; PLAN-H01 (format, D2 transport). Code: `services/hw/app/{config,registry}.py`,
`transports/mqtt.py` (`MqttLink`), `modules/sensors/*`, `modules/ir/driver_real.py` (pattern),
`tests/{fake_mqtt,helpers,test_sensors,test_registry,test_deploy_env,test_ir_real,test_ir_hardware,
test_contract_fixtures}.py`; `deploy/pi/{README.md,env/hw.env.example,env/core.env.example}`; core-api
`domain/sensors.ts` (R13: climate stale after 2 × `CLIMATE_REPORT_INTERVAL_S`, default 300 s, `config.ts`).
**No UI, contract, core-api or fixture change.** The S1 tiles, S2 row, H10/H11 and "n reporting" already work from
`sensors.reading`; this milestone only makes the hardware behind them real. The fake `r101_temp` ieee in
`fixtures/hw/*snapshot.json` stays (fixtures are screenshot examples; no test compares them with `config.py`).

## Executor notes (read once, apply to every task)

- Repo root `/home/eduscope/edcontrol` on the **R-101 Pi** (mosquitto, zigbee2mqtt, the paired `r101_ir` and
  `r101_temp` are live here). "Run `cmd`" = from the repo root.
- Before T1: `git tag h03-start` (on the commit that adds this plan).
- Apply blocks **verbatim**:
  - "Create `X`" = the block is the full file content (end it with one newline). "Replace `X`" = same, over an
    existing file.
  - "Patch" = run the shell block from the repo root exactly as given. `git apply` prints nothing on success. If it
    prints `error: patch failed`, **stop** and write a Blocker. Never hand-edit around a failed patch.
- **What was verified while writing this plan** (two scratch worktrees on this Pi, T1–T4 applied in order onto
  `6b7262a`): after each of T1, T2, T3, T4 `ruff check`, `ruff format --check` and `pytest -m "not hardware"` pass
  (184 passed each time); the end state equals the worktree it was cut from; **the T3 hardware test passes against
  the real `r101_temp`** (broker connected, availability online in < 1 s). `pnpm verify` was not run (no TS change).
  **Not verified (needs root or a person):** the `/etc/eduscope/hw.env` edit, the service restart and every S1/S2 check.
- **`[ON PI · HUMAN]` steps need root or a person in the room.** You have no sudo password. Ask the human to type the
  command with the `!` prefix in the Claude Code prompt (e.g. `! sudoedit /etc/eduscope/hw.env`), read its output,
  and continue. If nobody answers, write a Blocker and stop. Never work around sudo.
- **`[ON PI]` steps** (no root) you run yourself.
- After each task: run its **Verify**, then `pnpm verify`; tick the task box in this file; commit with the task's
  message (one commit per task, plan file included).
- Never edit SPEC, ARCHITECTURE, milestones or other plans. Never touch `reference/` or `/opt/zigbee2mqtt/data/`.

### Decisions this plan makes (accepted by the owner 2026-10-16 — do not re-open them)

- **D1 — Partial sensors are shown as they are.** With `sensors=real` only `r101_temp` reports. Motion and door show
  "—" / "No reading yet" (H11) and S1.E41 / S1.E4 show the degraded "1 of 3 reporting" state. No per-node fake/real
  split.
- **D2 — Staleness interval from a measurement.** T5 measures report gaps for 1 hour in a still room. If the longest
  gap is ≤ 300 s, nothing changes. Otherwise `CLIMATE_REPORT_INTERVAL_S` = longest gap rounded **up** to a multiple of
  300 s (no report in the hour → `3600`), set in `/etc/eduscope/core.env` on the Pi and in
  `deploy/pi/env/core.env.example` (T5 step 7). No zigbee2mqtt reporting change.
- **D3 — No retained state.** After a hw-service restart the climate tiles stay "No reading yet" until the sensor's
  next report. Accepted; nothing is built for it.
- **D4 — Values.** Temperature `round(x, 1)`; humidity half-up to an integer (`floor(x + 0.5)`, not Python's half-even
  `round`), clamped 0–100. A report without a numeric `temperature`/`humidity` (missing, string, bool, NaN) emits
  nothing for that kind; a non-object payload logs one warning and is dropped. Every other key is ignored.

## File map
| File | Create/Modify | Responsibility |
|---|---|---|
| `services/hw/app/modules/sensors/driver_real.py` | Replace | SNZB-02P reports → `sensors.reading` (T1) |
| `services/hw/app/registry.py` | Modify | pass the shared MQTT transport to the real sensors driver (T1) |
| `services/hw/tests/test_sensors_real.py` | Create | driver against `FakeMqtt` with the captured payloads (T1) |
| `services/hw/tests/test_sensors.py` | Modify | drop the "real driver reports nothing" test (T1) |
| `services/hw/tests/test_registry.py` | Modify | `sensors=real` starts the transport, starts empty (T1) |
| `services/hw/app/config.py` | Modify | confirmed `r101_temp` ieee + comments (T2) |
| `services/hw/tests/test_sensors_hardware.py` | Create | `[ON PI]` broker + `r101_temp` online (T3) |
| `deploy/pi/env/hw.env.example`, `deploy/pi/README.md`, `services/hw/tests/test_deploy_env.py` | Modify | `HW_DRIVERS=ir=real,sensors=real` (T4) |
| `deploy/pi/env/core.env.example` | Modify, **only if D2 says so** | `CLIMATE_REPORT_INTERVAL_S` (T5) |

## Tasks

### T1 — hw: real sensors driver for the SNZB-02P
- [x] done

**Files:** `services/hw/app/modules/sensors/driver_real.py`, `services/hw/app/registry.py`,
`services/hw/tests/{test_sensors_real,test_sensors,test_registry}.py`
**Context:** H03 "Observed on the Pi"; D4. Same shape as `ir/driver_real.py`: the driver registers its topic in
`start()` (before the registry starts the transport, PLAN-H01 D2) and gets decoded JSON. `sensors` is already in
`ZIGBEE_MODULES`, so `sensors=real` starts the transport. The service (`SensorsService`) is unchanged.
**Do:**
1. Replace `services/hw/app/modules/sensors/driver_real.py`:
```python
"""Real sensors driver: the SNZB-02P climate sensor (`HW_TEMP_NODE`) through zigbee2mqtt (H03).

Topic `<base>/<node>` (`<base>` = HW_Z2M_BASE_TOPIC): one JSON object per report, sent on change
and not retained, e.g. `{"battery":100,"humidity":64.6,"linkquality":182,"temperature":28.9,…}`
(observed on the R-101 Pi 2026-10-16, zigbee2mqtt 2.14.2; H03 milestone). Each report
gives one `temperature` reading (1 dp) and one `humidity` reading (integer, half-up, 0-100); every
other key is ignored. Motion (SNZB-03P) and door (SNZB-04PR2) are not paired yet: no readings.
"""

import math

from app.config import Settings
from app.contracts import HwDriverKind, logger
from app.modules.sensors.schemas import (
    HwHumidityReading,
    HwSensorReadingData,
    HwSensorsReadingEvent,
    HwTemperatureReading,
)
from app.modules.sensors.service import SensorsEmit
from app.transports.mqtt import MqttLink


def number(payload: dict[object, object], key: str) -> float | None:
    """`payload[key]` when it is a finite JSON number (bools and strings are not)."""
    value = payload.get(key)
    if isinstance(value, bool) or not isinstance(value, int | float):
        return None
    return float(value) if math.isfinite(value) else None


def humidity_pct(value: float) -> int:
    """64.6 → 65, 63.5 → 64 (half-up, not Python's half-even `round`), clamped to 0-100."""
    return min(100, max(0, math.floor(value + 0.5)))


def climate_readings(node: str, payload: object) -> list[HwSensorReadingData]:
    """The readings in one zigbee2mqtt report: temperature first, then humidity."""
    if not isinstance(payload, dict):
        return []
    readings: list[HwSensorReadingData] = []
    temperature = number(payload, "temperature")
    if temperature is not None:
        readings.append(
            HwTemperatureReading(node=node, kind="temperature", value=round(temperature, 1))
        )
    humidity = number(payload, "humidity")
    if humidity is not None:
        readings.append(HwHumidityReading(node=node, kind="humidity", value=humidity_pct(humidity)))
    return readings


class RealSensorsDriver:
    kind: HwDriverKind = "real"

    def __init__(self, settings: Settings, mqtt: MqttLink) -> None:
        self._settings = settings
        self._mqtt = mqtt
        self._climate_topic = f"{settings.z2m_base_topic}/{settings.temp_node}"
        self._emit: SensorsEmit | None = None

    async def start(self, emit: SensorsEmit) -> None:
        self._emit = emit
        self._mqtt.subscribe(self._climate_topic, self._on_climate)

    async def stop(self) -> None:
        self._emit = None

    def _on_climate(self, payload: object) -> None:
        if self._emit is None:
            return
        if not isinstance(payload, dict):
            logger.warning("sensors: ignored a non-object report on %s", self._climate_topic)
            return
        for reading in climate_readings(self._settings.temp_node, payload):
            self._emit(HwSensorsReadingEvent(data=reading))
```
2. Create `services/hw/tests/test_sensors_real.py`:
```python
"""RealSensorsDriver (SNZB-02P via zigbee2mqtt) against an in-memory MQTT link. Payloads are copied
from the capture in docs/milestones/H03-zigbee-climate-sensor.md (R-101 Pi, zigbee2mqtt 2.14.2)."""

import logging

import pytest

from app.events import EventBus, Subscription
from app.modules.sensors.driver_real import RealSensorsDriver, climate_readings, humidity_pct
from app.modules.sensors.schemas import (
    HwHumidityReading,
    HwSensorsReadingEvent,
    HwTemperatureReading,
)
from app.modules.sensors.service import SensorsService
from tests.fake_mqtt import FakeMqtt
from tests.helpers import drain, make_settings

CLIMATE = "zigbee2mqtt/r101_temp"
UPDATE = {
    "installed_version": 8704,
    "latest_release_notes": None,
    "latest_source": "https://raw.githubusercontent.com/Koenkk/zigbee-OTA/master/images/Sonoff/snzb-02p_v2.2.0.ota",
    "latest_version": 8704,
    "state": "idle",
}


def report(humidity: float, linkquality: int, temperature: float = 28.9) -> dict[str, object]:
    """One `zigbee2mqtt/r101_temp` message as captured (only humidity/lqi/temperature vary)."""
    return {
        "battery": 100,
        "humidity": humidity,
        "humidity_calibration": 0,
        "linkquality": linkquality,
        "temperature": temperature,
        "temperature_calibration": 0,
        "update": UPDATE,
    }


async def start() -> tuple[SensorsService, FakeMqtt, Subscription]:
    bus = EventBus(64)
    sub = bus.subscribe()
    mqtt = FakeMqtt()
    service = SensorsService(RealSensorsDriver(make_settings(drivers="sensors=real"), mqtt), bus)
    await service.start()
    return service, mqtt, sub


def readings(sub: Subscription) -> list[tuple[str, str, object]]:
    return [
        (e.data.node, e.data.kind, e.data.value)
        for e in drain(sub)
        if isinstance(e, HwSensorsReadingEvent)
    ]


async def test_subscribes_to_the_climate_node_only() -> None:
    service, mqtt, _ = await start()
    assert list(mqtt.handlers) == [CLIMATE]
    assert service.snapshot() == []
    await service.stop()


async def test_one_report_gives_temperature_then_humidity() -> None:
    service, mqtt, sub = await start()
    mqtt.deliver(CLIMATE, report(64.6, 182))
    assert readings(sub) == [
        ("r101_temp", "temperature", 28.9),
        ("r101_temp", "humidity", 65),
    ]
    await service.stop()


@pytest.mark.parametrize(
    ("raw", "pct"),
    [(64.6, 65), (63.5, 64), (73, 73), (67.4, 67), (80.2, 80), (0.4, 0), (-0.6, 0), (100.6, 100)],
)
def test_humidity_is_rounded_half_up_and_clamped(raw: float, pct: int) -> None:
    assert humidity_pct(raw) == pct


def test_temperature_keeps_one_decimal() -> None:
    assert climate_readings("r101_temp", {"temperature": 28.94}) == [
        HwTemperatureReading(node="r101_temp", kind="temperature", value=28.9)
    ]
    assert climate_readings("r101_temp", {"temperature": 21}) == [
        HwTemperatureReading(node="r101_temp", kind="temperature", value=21.0)
    ]


def test_a_missing_or_bad_value_drops_only_that_kind() -> None:
    assert climate_readings("r101_temp", {"temperature": 28.9, "battery": 100}) == [
        HwTemperatureReading(node="r101_temp", kind="temperature", value=28.9)
    ]
    assert climate_readings("r101_temp", {"temperature": "28.9", "humidity": 61}) == [
        HwHumidityReading(node="r101_temp", kind="humidity", value=61)
    ]
    assert climate_readings("r101_temp", {"temperature": True, "humidity": float("nan")}) == []
    assert climate_readings("r101_temp", {"battery": 100, "linkquality": 182}) == []


@pytest.mark.parametrize("payload", ["online", None, [28.9, 64.6], 42])
async def test_non_object_reports_are_logged_and_dropped(
    payload: object, caplog: pytest.LogCaptureFixture
) -> None:
    service, mqtt, sub = await start()
    caplog.set_level(logging.WARNING, logger="hw")
    mqtt.deliver(CLIMATE, payload)
    assert readings(sub) == []
    assert "ignored a non-object report on zigbee2mqtt/r101_temp" in caplog.text
    await service.stop()


async def test_snapshot_keeps_the_latest_climate_reading() -> None:
    service, mqtt, _ = await start()
    mqtt.deliver(CLIMATE, report(64.6, 182))
    mqtt.deliver(CLIMATE, report(73, 98))
    assert [(s.reading.kind, s.reading.value) for s in service.snapshot()] == [
        ("temperature", 28.9),
        ("humidity", 73),
    ]
    await service.stop()


async def test_reports_after_a_broker_reconnect_still_arrive() -> None:
    service, mqtt, sub = await start()
    mqtt.set_connected(False)
    mqtt.set_connected(True)
    mqtt.deliver(CLIMATE, report(63.5, 185))
    assert readings(sub) == [
        ("r101_temp", "temperature", 28.9),
        ("r101_temp", "humidity", 64),
    ]
    await service.stop()


async def test_no_readings_after_stop() -> None:
    service, mqtt, sub = await start()
    await service.stop()
    mqtt.deliver(CLIMATE, report(64.6, 182))
    assert readings(sub) == []
```
3. Patch (registry wiring; the old stub test goes; registry tests for `sensors=real`):
```sh
git apply <<'PATCH'
diff --git a/services/hw/app/registry.py b/services/hw/app/registry.py
index b0897df..2ea2143 100644
--- a/services/hw/app/registry.py
+++ b/services/hw/app/registry.py
@@ -211,7 +211,7 @@ def build_registry(settings: Settings, bus: EventBus) -> Registry:
     if kinds["sensors"] == "fake":
         sensors_fake_driver = sensors_fake.FakeSensorsDriver(settings)
         fake_routers.append(sensors_fake.build_fake_router(sensors_fake_driver))
-    sensors = SensorsService(sensors_fake_driver or RealSensorsDriver(settings), bus)
+    sensors = SensorsService(sensors_fake_driver or RealSensorsDriver(settings, mqtt), bus)
 
     zigbee_fake_driver: zigbee_fake.FakeZigbeeStatusDriver | None = None
     if kinds["zigbee_status"] == "fake":
diff --git a/services/hw/tests/test_registry.py b/services/hw/tests/test_registry.py
index 11cdd34..f8c9872 100644
--- a/services/hw/tests/test_registry.py
+++ b/services/hw/tests/test_registry.py
@@ -77,6 +77,7 @@ def test_mqtt_runs_only_with_a_real_zigbee_driver() -> None:
     non_zigbee = make_settings(drivers="hdmi=real,projection_screen=real,audio=real")
     assert build_registry(non_zigbee, EventBus(8)).mqtt is None
     assert build_registry(make_settings(drivers="ir=real"), EventBus(8)).mqtt is not None
+    assert build_registry(make_settings(drivers="sensors=real"), EventBus(8)).mqtt is not None
     assert build_registry(make_settings(mode="real"), EventBus(8)).mqtt is not None
 
 
@@ -88,6 +89,17 @@ async def test_real_ir_starts_offline_without_a_broker() -> None:
     await registry.stop()
 
 
+async def test_real_sensors_start_empty_without_a_broker() -> None:
+    registry = build_registry(make_settings(drivers="sensors=real"), EventBus(64))
+    await registry.start()
+    assert registry.health().modules.sensors == "real"
+    assert registry.snapshot().sensors == []
+    assert "/v1/_fake/sensors/value" not in [
+        route.path for router in registry.fake_routers for route in router.routes
+    ]
+    await registry.stop()
+
+
 async def test_fake_ir_send_drives_the_fake_projector() -> None:
     bus = EventBus(256)
     sub = bus.subscribe()
diff --git a/services/hw/tests/test_sensors.py b/services/hw/tests/test_sensors.py
index c8b5b81..d13290d 100644
--- a/services/hw/tests/test_sensors.py
+++ b/services/hw/tests/test_sensors.py
@@ -1,6 +1,5 @@
 from app.events import EventBus, Subscription
 from app.modules.sensors.driver_fake import FakeSensorsDriver, build_fake_router
-from app.modules.sensors.driver_real import RealSensorsDriver
 from app.modules.sensors.router import build_router
 from app.modules.sensors.schemas import HwContactReading, HwSensorsReadingEvent
 from app.modules.sensors.service import SensorsService
@@ -53,12 +52,6 @@ async def test_snapshot_keeps_the_latest_reading_per_node_and_kind() -> None:
     await service.stop()
 
 
-async def test_real_driver_reports_nothing() -> None:
-    service = SensorsService(RealSensorsDriver(make_settings()), EventBus(8))
-    await service.start()
-    assert service.snapshot() == []
-
-
 async def test_fake_value_route() -> None:
     service, driver, sub = await start_fake()
     drain(sub)
PATCH
```
**Test:** the files above. Cases: subscribes to `zigbee2mqtt/r101_temp` only; one captured report → temperature then
humidity; half-up + clamp (64.6→65, 63.5→64, 73→73, 0.4→0, −0.6→0, 100.6→100); 1 dp; missing / string / bool / NaN
values; non-object payloads warn and emit nothing; snapshot keeps the latest; reports after a reconnect; nothing after
`stop()`; registry: `sensors=real` → transport built, `modules.sensors == "real"`, empty snapshot, no fake route.
**Verify:** `uv run --directory services/hw ruff check . && uv run --directory services/hw ruff format --check .` →
clean; `uv run --directory services/hw pytest -m "not hardware"` → 184 passed; `pnpm verify` green.
**Commit:** `git commit -m "feat(hw): real SNZB-02P climate sensor driver through zigbee2mqtt"`

### T2 — hw: confirmed `r101_temp` in config
- [x] done

**Files:** `services/hw/app/config.py`
**Context:** H03 Scope (ieee `0xb0e8e8fffe985dcd`; model and friendly name confirmed). Only the fake `zigbee_status`
driver reads `DEFAULT_NODES`, so S2 shows the new ieee; its lqi / battery stay the fake values (H03 Out of scope).
**Do:** Patch:
```sh
git apply <<'PATCH'
diff --git a/services/hw/app/config.py b/services/hw/app/config.py
index ab43d0a..e705a41 100644
--- a/services/hw/app/config.py
+++ b/services/hw/app/config.py
@@ -37,7 +37,8 @@ class CoordinatorConfig(BaseModel):
     antenna: str
 
 
-# R-101 as in screenshot 02 and fixtures/hw/response.snapshot.json. [ASSUMED] until intake.
+# R-101 as in screenshot 02 and fixtures/hw/response.snapshot.json. [ASSUMED] until intake, except
+# r101_temp's ieee and model (paired on the R-101 Pi 2026-10-16, H03); its lqi/battery stay fake.
 DEFAULT_NODES = [
     ZigbeeNodeConfig(
         ieee="0xa4c1380f2b9e0001",
@@ -58,7 +59,7 @@ DEFAULT_NODES = [
         battery_pct=None,
     ),
     ZigbeeNodeConfig(
-        ieee="0x00124b0029b70003",
+        ieee="0xb0e8e8fffe985dcd",
         friendly_name="r101_temp",
         model="SNZB-02P",
         role="end_device",
@@ -119,7 +120,8 @@ class Settings(BaseSettings):
     # A QoS 1 publish the broker has not accepted after this long fails (core-api waits 3 s).
     mqtt_publish_timeout_s: float = Field(default=2.0, gt=0)
 
-    # Friendly names [ASSUMED] (ARCHITECTURE §7.1); ir_node confirmed on hardware (INTAKE-01 §2C)
+    # Friendly names [ASSUMED] (ARCHITECTURE §7.1); confirmed on hardware: ir_node (INTAKE-01 §2C),
+    # temp_node (H03).
     lights_node: str = "r101_lights"
     proj_plug_node: str = "r101_proj_plug"
     ir_node: str = "r101_ir"
PATCH
```
**Verify:** `uv run --directory services/hw pytest -m "not hardware"` → 184 passed; ruff clean; `pnpm verify` green.
**Commit:** `git commit -m "chore(hw): confirmed r101_temp ieee and node name (H03)"`

### T3 — hw: SNZB-02P hardware test `[ON PI]`
- [ ] done

**Files:** `services/hw/tests/test_sensors_hardware.py`
**Context:** H03 Scope (hardware test). The sensor reports only on change, so the test checks the link, not a reading.
`<base>/r101_temp/availability` is retained, so it arrives right after the subscribe.
**Do:** Create `services/hw/tests/test_sensors_hardware.py`:
```python
"""[ON PI] RealSensorsDriver against the real broker, zigbee2mqtt and the paired SNZB-02P.

Run on the R-101 Pi only: `uv run --directory services/hw pytest -m hardware`. The sensor reports
only on change, so this checks the link (broker connected, `r101_temp` online), not a reading.
"""

import asyncio

import pytest

from app.config import Settings
from app.events import EventBus
from app.modules.sensors.driver_real import RealSensorsDriver
from app.modules.sensors.service import SensorsService
from app.transports.mqtt import MqttTransport

pytestmark = pytest.mark.hardware

ONLINE = {"state": "online"}  # zigbee2mqtt 2.x availability payload


async def test_climate_sensor_is_online_within_5_s() -> None:
    settings = Settings(_env_file=None)  # 127.0.0.1:1883, zigbee2mqtt, r101_temp
    mqtt = MqttTransport(settings)
    service = SensorsService(RealSensorsDriver(settings, mqtt), EventBus(64))
    online = asyncio.Event()

    def on_availability(payload: object) -> None:
        if payload == ONLINE:
            online.set()

    # Retained by zigbee2mqtt, so it arrives right after the subscribe.
    availability = f"{settings.z2m_base_topic}/{settings.temp_node}/availability"
    mqtt.subscribe(availability, on_availability)
    await service.start()
    await mqtt.start()
    try:
        async with asyncio.timeout(5):
            await online.wait()
        assert mqtt.connected
    finally:
        await mqtt.stop()
        await service.stop()
```
**Verify:** `[ON PI]` `uv run --directory services/hw pytest -m hardware` → 3 passed (2 ZS06 + this one; no remote may
be pressed during the IR learn test); `pytest -m "not hardware"` → 184 passed, 3 deselected; ruff clean; `pnpm verify`
green.
**Commit:** `git commit -m "test(hw): SNZB-02P hardware test (r101_temp online)"`

### T4 — deploy: `HW_DRIVERS=ir=real,sensors=real`
- [ ] done

**Files:** `deploy/pi/env/hw.env.example`, `deploy/pi/README.md`, `services/hw/tests/test_deploy_env.py`
**Context:** H03 Scope; install.sh creates `/etc/eduscope/hw.env` once and never rewrites it, so T5 changes the live
file by hand.
**Do:** Patch:
```sh
git apply <<'PATCH'
diff --git a/deploy/pi/README.md b/deploy/pi/README.md
index 5bbeab3..67e5f76 100644
--- a/deploy/pi/README.md
+++ b/deploy/pi/README.md
@@ -80,16 +80,20 @@ Restart everything: Settings → About → **Restart controller**, or
 ## 5 Hardware drivers
 
 `/etc/eduscope/hw.env` has `HW_MODE=fake` (every device simulated) plus a per-module override
-`HW_DRIVERS=`. Each hardware milestone switches its own module. Since H01 the IR blaster is real:
-`HW_DRIVERS=ir=real`. The installer creates this file once and never changes it, so on a Pi that
-was installed earlier set the line by hand, then restart:
+`HW_DRIVERS=`. Each hardware milestone switches its own module. Since H01 the IR blaster is real,
+since H03 the SNZB-02P climate sensor too: `HW_DRIVERS=ir=real,sensors=real`. The installer
+creates this file once and never changes it, so on a Pi that was installed earlier set the line by
+hand, then restart:
 
 ```sh
-sudoedit /etc/eduscope/hw.env                       # HW_DRIVERS=ir=real
+sudoedit /etc/eduscope/hw.env                       # HW_DRIVERS=ir=real,sensors=real
 sudo systemctl restart eduscope.target
-curl -s 127.0.0.1:8081/v1/health                    # "ir":"real"
+curl -s 127.0.0.1:8081/v1/health                    # "ir":"real", "sensors":"real"
 ```
 
+With `sensors=real` only the climate sensor (`r101_temp`) reports; motion and door show "No reading
+yet" until they are paired (H03).
+
 ## 6 Backup
 
 Back up the database (settings, schedule, IR codes) and the env files. Stop the services for the
diff --git a/deploy/pi/env/hw.env.example b/deploy/pi/env/hw.env.example
index fcb4b41..21c2a51 100644
--- a/deploy/pi/env/hw.env.example
+++ b/deploy/pi/env/hw.env.example
@@ -1,5 +1,6 @@
 # /etc/eduscope/hw.env (mode 600) — created once by deploy/pi/install.sh from
 # deploy/pi/env/hw.env.example; install.sh never changes it afterwards. Keys: services/hw/app/config.py.
 HW_MODE=fake
-# Per-module override (D-19). Each Hxx milestone switches its own module; H01: the ZS06 IR blaster.
-HW_DRIVERS=ir=real
+# Per-module override (D-19). Each Hxx milestone switches its own module; H01: the ZS06 IR blaster,
+# H03: the SNZB-02P climate sensor.
+HW_DRIVERS=ir=real,sensors=real
diff --git a/services/hw/tests/test_deploy_env.py b/services/hw/tests/test_deploy_env.py
index 16c4d5a..fadae54 100644
--- a/services/hw/tests/test_deploy_env.py
+++ b/services/hw/tests/test_deploy_env.py
@@ -10,18 +10,18 @@ from app.registry import driver_kinds
 EXAMPLE = Path(__file__).resolve().parents[3] / "deploy" / "pi" / "env" / "hw.env.example"
 
 
-def test_hw_env_example_is_real_ir_only_on_loopback() -> None:
+def test_hw_env_example_is_real_ir_and_sensors_on_loopback() -> None:
     settings = Settings(_env_file=EXAMPLE)
     assert settings.mode == "fake"
     assert settings.host == "127.0.0.1"
     real = [module for module, kind in driver_kinds(settings).items() if kind == "real"]
-    assert real == ["ir"]  # H01; every later Hxx adds its own module
+    assert real == ["ir", "sensors"]  # H01, H03; every later Hxx adds its own module
 
 
 def test_hw_env_example_has_no_placeholders() -> None:
     assert "@" not in EXAMPLE.read_text(encoding="utf-8")
 
 
-@pytest.mark.parametrize("line", ["HW_MODE=fake", "HW_DRIVERS=ir=real"])
+@pytest.mark.parametrize("line", ["HW_MODE=fake", "HW_DRIVERS=ir=real,sensors=real"])
 def test_hw_env_example_sets(line: str) -> None:
     assert line in EXAMPLE.read_text(encoding="utf-8").splitlines()
PATCH
```
**Verify:** `uv run --directory services/hw pytest -m "not hardware" tests/test_deploy_env.py` → passes; full
`pytest -m "not hardware"` → 184 passed; `pnpm verify` green.
**Commit:** `git commit -m "feat(deploy): real climate sensor on the Pi (HW_DRIVERS=ir=real,sensors=real)"`

### T5 — Acceptance on the Pi (H03)
- [ ] done

**Files:** this plan (tick, "Observed on R-101" notes, failures under `## Blockers`); `deploy/pi/env/core.env.example`
only if step 7 says so.
**Do:**
1. `[ON PI · HUMAN]` `! sudoedit /etc/eduscope/hw.env` → set `HW_DRIVERS=ir=real,sensors=real`; then
   `! sudo deploy/pi/install.sh` (builds and restarts `eduscope.target`).
2. **AC1** `[ON PI]` `curl -s 127.0.0.1:8081/v1/health` → `"ir":"real"` and `"sensors":"real"`.
3. **AC2** `[ON PI]` in one terminal `mosquitto_sub -h 127.0.0.1 -t zigbee2mqtt/r101_temp -v`. `[ON PI · HUMAN]` breathe
   on the sensor ~30 s. Within 60 s S1 HUMIDITY shows the latest `humidity` rounded half-up (64.6 → 65 %), S1
   TEMPERATURE the `temperature` at 1 dp; S2 "Room climate" shows the same `° · %` and its last seen is "now"/seconds.
4. **AC3** `[ON PI · HUMAN]` both climate tiles read `SNZB-02P` and never 26.4° / 61 %; OCCUPANCY and DOOR show "—" /
   "No reading yet"; S1.E41 reads "1 of 3 reporting" (amber), S1.E4 degraded (D1).
5. **AC4** `[ON PI · HUMAN]` `! sudo systemctl restart zigbee2mqtt`, wait 30 s, breathe on the sensor → the new value
   reaches S1 within 60 s. Repeat with `! sudo systemctl restart mosquitto`. `systemctl status eduscope-hw` shows no
   restart (same `Active: since`).
6. **AC5** `[ON PI]` leave the sensor untouched, nobody near it, for 1 hour:
   `timeout 3600 mosquitto_sub -h 127.0.0.1 -t zigbee2mqtt/r101_temp | while read -r l; do echo "$(date +%T) $l"; done
   | tee ~/h03-report-gaps.log`. Write every report time and the longest gap (s) under "Observed on R-101" below.
7. **D2** If the longest gap ≤ 300 s: nothing. Otherwise compute the value (D2) and:
   `[ON PI · HUMAN]` `! sudoedit /etc/eduscope/core.env` → add `CLIMATE_REPORT_INTERVAL_S=<value>`, then
   `! sudo systemctl restart eduscope.target`; and append to `deploy/pi/env/core.env.example`:
   ```
   # H03: the SNZB-02P reports on change; longest gap in a still room was <gap> s (R13: stale after 2×).
   CLIMATE_REPORT_INTERVAL_S=<value>
   ```
   Then left untouched for 2 × `<value>` + 5 min, the climate tiles are **not** stale. If the sensor is still stale
   (or `<value>` would exceed 3600): Blocker, stop.
8. **AC6** `[ON PI]` `uv run --directory services/hw pytest -m hardware` → 3 passed; `pnpm verify` green;
   `git status --short` clean apart from this plan (and `core.env.example` if step 7 changed it).

**Observed on R-101:** (executor fills in)

**Verify:** every step passes as written; otherwise `## Blockers` and stop.
**Commit:** `git commit -m "docs: H03 acceptance walk-through"`

## Checkpoints
After T4: "Human: run step 1 of T5 (`HW_DRIVERS=ir=real,sensors=real`, install.sh) — the rest of T5 needs it."

## Nice-to-haves (not tasks)

- Real `zigbee_status` driver so S2 shows the sensor's real battery %, LQI and last seen (next Hxx).
- Ask zigbee2mqtt for a fixed maximum report interval (reporting config) instead of relying on change reports.
- SNZB-03P motion and SNZB-04PR2 door once they are paired (same driver, two more topics).

## Blockers

(executor writes here; leave empty)
