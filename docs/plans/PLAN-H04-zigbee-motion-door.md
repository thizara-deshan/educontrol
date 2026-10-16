# PLAN-H04 — Zigbee motion (SNZB-03P) and door (SNZB-04PR2) sensors live
Milestone: `docs/milestones/H04-zigbee-motion-door.md` · Start tag: `h04-start` · Verify-all: `pnpm verify`

Inputs read for this plan: H04 (incl. "Observed on the Pi"); H03 + PLAN-H03 (format, driver, D3); ARCHITECTURE
§7.1–§7.2 (`sensors` row); SPEC S1.E41, S1.E44–E45, S2.E17–E18, H10, H11, H23, R13, Q12, Q26; CLAUDE.md. Code:
`services/hw/app/{config,registry}.py`, `transports/mqtt.py` (`MqttLink`, `MessageHandler`),
`modules/sensors/{driver_real,schemas,service}.py`, `tests/{fake_mqtt,helpers,test_sensors_real,test_sensors_hardware,
test_config,test_zigbee_status,test_deploy_env}.py`; `deploy/pi/{README.md,env/hw.env.example}`; core-api
`domain/{sensors,initial}.ts` (R13: event sensors stale when the node's last seen > 60 min; `SENSOR_DEVICE_IDS`),
`db/seed.ts` (devices `motion` / `door` already have `hw_ref` `r101_motion` / `r101_door`); kiosk
`features/kiosk/kiosk-params.ts` (`occupancyWakes`: transition to `detected` only).
**No UI, contract, core-api or fixture change.** The S1 tiles, S2 rows, H10/H11, H23 wake and "n reporting" already
work from `sensors.reading`; this milestone only makes the hardware behind them real. `HW_DRIVERS` stays
`ir=real,sensors=real` (H03), so no `/etc/eduscope/hw.env` edit.

## Executor notes (read once, apply to every task)

- Repo root `/home/eduscope/edcontrol` on the **R-101 Pi** (mosquitto, zigbee2mqtt, the paired `r101_ir`,
  `r101_temp`, `r101_motion` and `r101_door` are live here). "Run `cmd`" = from the repo root.
- Before T1: `git tag h04-start` (on the commit that adds this plan).
- **PLAN-H03 T5 must be ticked before T5 here starts.** T5 step 1 restarts hw-service, which resets the climate
  tiles to "No reading yet" (H03 D3) and would void H03's pending 105-min not-stale check. T1–T4 restart nothing.
- Apply blocks **verbatim**:
  - "Create `X`" = the block is the full file content (end it with one newline). "Replace `X`" = same, over an
    existing file.
  - "Patch" = run the shell block from the repo root exactly as given. `git apply` prints nothing on success. If it
    prints `error: patch failed`, **stop** and write a Blocker. Never hand-edit around a failed patch.
- **What was verified while writing this plan** (a scratch worktree on this Pi, T1–T4 applied in order onto
  `421c0a6`): after each of T1, T2, T3, T4 `ruff check`, `ruff format --check` and `pytest -m "not hardware"` pass
  (197 passed each time); **the T3 hardware test passes against the real sensors** (3 passed: `r101_temp`,
  `r101_motion`, `r101_door` online in < 1 s). `pnpm verify` was not run (no TS change).
  **Not verified (needs root or a person):** install.sh, the service restarts and every S1/S2 check.
- **`[ON PI · HUMAN]` steps need root or a person in the room.** You have no sudo password. Ask the human to type the
  command with the `!` prefix in the Claude Code prompt (e.g. `! sudo deploy/pi/install.sh`), read its output,
  and continue. If nobody answers, write a Blocker and stop. Never work around sudo.
- **`[ON PI]` steps** (no root) you run yourself.
- After each task: run its **Verify**, then `pnpm verify`; tick the task box in this file; commit with the task's
  message (one commit per task, plan file included).
- Never edit SPEC, ARCHITECTURE, milestones or other plans. Never touch `reference/` or `/opt/zigbee2mqtt/data/`.

### Decisions this plan makes (accepted by the owner 2026-10-16 — do not re-open them)

- **D1 — Values.** `occupancy` `true` → `detected`, `false` → `clear`; `contact` `true` → `closed`, `false` → `open`
  (observed: `true` with the magnet at the body). Only a JSON boolean counts: missing, number, string or null emits
  nothing for that node. A non-object payload logs one warning and is dropped. Every other key (`battery`,
  `battery_low`, `tamper`, `linkquality`, `motion_timeout`, `voltage`, `update`) is ignored. Climate unchanged (H03 D4).
- **D2 — Repeated readings are emitted.** Each zigbee2mqtt message carries the full state, so a tamper-only or
  battery report repeats `contact` / `occupancy`. The driver emits it every time: it refreshes the node's last seen
  (R13), and the kiosk wakes only on the transition to `detected` (H23, `occupancyWakes`), so repeats are harmless.
- **D3 — Event-sensor staleness is measured, not changed.** R13 (60 min since last seen) stays. With the fake
  `zigbee_status` driver, last seen moves only on a reading, so a shut door in an empty room may go stale (H10) while
  correct. T5 measures it for 70 min and records the result; any fix (real `zigbee_status` driver, or a different
  rule through `docs/decisions/`) is a later milestone. A stale tile in T5 step 7 is **not** a failure.
- **D4 — No retained state.** After a hw-service restart OCCUPANCY and DOOR stay "No reading yet" until the
  sensor's next report (as H03 D3). Accepted; nothing is built for it.

## File map
| File | Create/Modify | Responsibility |
|---|---|---|
| `services/hw/app/modules/sensors/driver_real.py` | Replace | + SNZB-03P / SNZB-04PR2 reports → `sensors.reading` (T1) |
| `services/hw/tests/test_sensors_real.py` | Modify | motion / door against `FakeMqtt` with the captured payloads (T1) |
| `services/hw/app/config.py` | Modify | confirmed `r101_motion` / `r101_door` ieee + comments (T2) |
| `services/hw/tests/test_sensors_hardware.py` | Modify | `[ON PI]` all three sensor nodes online (T3) |
| `deploy/pi/README.md`, `deploy/pi/env/hw.env.example` | Modify | motion and door report since H04 (T4) |

## Tasks

### T1 — hw: real SNZB-03P motion and SNZB-04PR2 door through zigbee2mqtt
- [x] done

**Files:** `services/hw/app/modules/sensors/driver_real.py`, `services/hw/tests/test_sensors_real.py`
**Context:** H04 "Observed on the Pi"; D1, D2. The driver keeps the H03 shape (topics registered in `start()`, before
the registry starts the transport) and now holds one `(topic, node, parse)` row per sensor. Registry and service are
unchanged (`RealSensorsDriver(settings, mqtt)` since H03).
**Do:**
1. Replace `services/hw/app/modules/sensors/driver_real.py`:
```python
"""Real sensors driver: the SONOFF sensors through zigbee2mqtt (H03 climate, H04 motion and door).

Topic `<base>/<node>` (`<base>` = HW_Z2M_BASE_TOPIC): one JSON object per report, not retained
(observed on the R-101 Pi 2026-10-16, zigbee2mqtt 2.14.2; H03 and H04 milestones).
- SNZB-02P (`HW_TEMP_NODE`), sent on change, e.g. `{"battery":100,"humidity":64.6,
  "linkquality":182,"temperature":28.9,…}`: one `temperature` reading (1 dp) and one `humidity`
  reading (integer, half-up, 0-100).
- SNZB-03P (`HW_MOTION_NODE`), e.g. `{"battery":100,"motion_timeout":60,"occupancy":true,…}`:
  one `occupancy` reading, `true` → detected, `false` → clear.
- SNZB-04PR2 (`HW_DOOR_NODE`), e.g. `{"battery":100,"contact":true,"tamper":false,…}`: one
  `contact` reading, `true` → closed (magnet at the body), `false` → open.
Each message repeats the device's full state, so a report caused by another key (`tamper`) gives
the same reading again. Every other key is ignored.
"""

import math
from collections.abc import Callable

from app.config import Settings
from app.contracts import HwDriverKind, logger
from app.modules.sensors.schemas import (
    HwContactReading,
    HwHumidityReading,
    HwOccupancyReading,
    HwSensorReadingData,
    HwSensorsReadingEvent,
    HwTemperatureReading,
)
from app.modules.sensors.service import SensorsEmit
from app.transports.mqtt import MessageHandler, MqttLink

Parse = Callable[[str, object], list[HwSensorReadingData]]


def number(payload: dict[object, object], key: str) -> float | None:
    """`payload[key]` when it is a finite JSON number (bools and strings are not)."""
    value = payload.get(key)
    if isinstance(value, bool) or not isinstance(value, int | float):
        return None
    return float(value) if math.isfinite(value) else None


def flag(payload: dict[object, object], key: str) -> bool | None:
    """`payload[key]` when it is a JSON boolean (numbers and strings are not)."""
    value = payload.get(key)
    return value if isinstance(value, bool) else None


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


def motion_readings(node: str, payload: object) -> list[HwSensorReadingData]:
    """`occupancy` true → detected, false → clear; anything else → nothing."""
    if not isinstance(payload, dict):
        return []
    occupancy = flag(payload, "occupancy")
    if occupancy is None:
        return []
    value = "detected" if occupancy else "clear"
    return [HwOccupancyReading(node=node, kind="occupancy", value=value)]


def door_readings(node: str, payload: object) -> list[HwSensorReadingData]:
    """`contact` true → closed, false → open; anything else → nothing."""
    if not isinstance(payload, dict):
        return []
    contact = flag(payload, "contact")
    if contact is None:
        return []
    return [HwContactReading(node=node, kind="contact", value="closed" if contact else "open")]


class RealSensorsDriver:
    kind: HwDriverKind = "real"

    def __init__(self, settings: Settings, mqtt: MqttLink) -> None:
        self._mqtt = mqtt
        base = settings.z2m_base_topic
        self._nodes: list[tuple[str, str, Parse]] = [
            (f"{base}/{settings.temp_node}", settings.temp_node, climate_readings),
            (f"{base}/{settings.motion_node}", settings.motion_node, motion_readings),
            (f"{base}/{settings.door_node}", settings.door_node, door_readings),
        ]
        self._emit: SensorsEmit | None = None

    async def start(self, emit: SensorsEmit) -> None:
        self._emit = emit
        for topic, node, parse in self._nodes:
            self._mqtt.subscribe(topic, self._handler(topic, node, parse))

    async def stop(self) -> None:
        self._emit = None

    def _handler(self, topic: str, node: str, parse: Parse) -> MessageHandler:
        def on_report(payload: object) -> None:
            if self._emit is None:
                return
            if not isinstance(payload, dict):
                logger.warning("sensors: ignored a non-object report on %s", topic)
                return
            for reading in parse(node, payload):
                self._emit(HwSensorsReadingEvent(data=reading))

        return on_report
```
2. Patch (tests):
```sh
git apply <<'PATCH'
diff --git a/services/hw/tests/test_sensors_real.py b/services/hw/tests/test_sensors_real.py
index 98a996f..7a8b4ae 100644
--- a/services/hw/tests/test_sensors_real.py
+++ b/services/hw/tests/test_sensors_real.py
@@ -1,14 +1,23 @@
-"""RealSensorsDriver (SNZB-02P via zigbee2mqtt) against an in-memory MQTT link. Payloads are copied
-from the capture in docs/milestones/H03-zigbee-climate-sensor.md (R-101 Pi, zigbee2mqtt 2.14.2)."""
+"""RealSensorsDriver (SNZB-02P, SNZB-03P, SNZB-04PR2 via zigbee2mqtt) against an in-memory MQTT
+link. Payloads are copied from the captures in docs/milestones/H03-zigbee-climate-sensor.md and
+H04-zigbee-motion-door.md (R-101 Pi, zigbee2mqtt 2.14.2)."""
 
 import logging
 
 import pytest
 
 from app.events import EventBus, Subscription
-from app.modules.sensors.driver_real import RealSensorsDriver, climate_readings, humidity_pct
+from app.modules.sensors.driver_real import (
+    RealSensorsDriver,
+    climate_readings,
+    door_readings,
+    humidity_pct,
+    motion_readings,
+)
 from app.modules.sensors.schemas import (
+    HwContactReading,
     HwHumidityReading,
+    HwOccupancyReading,
     HwSensorsReadingEvent,
     HwTemperatureReading,
 )
@@ -17,6 +26,8 @@ from tests.fake_mqtt import FakeMqtt
 from tests.helpers import drain, make_settings
 
 CLIMATE = "zigbee2mqtt/r101_temp"
+MOTION = "zigbee2mqtt/r101_motion"
+DOOR = "zigbee2mqtt/r101_door"
 UPDATE = {
     "installed_version": 8704,
     "latest_release_notes": None,
@@ -39,6 +50,35 @@ def report(humidity: float, linkquality: int, temperature: float = 28.9) -> dict
     }
 
 
+def motion(occupancy: bool) -> dict[str, object]:
+    """One `zigbee2mqtt/r101_motion` message as captured (H04)."""
+    return {
+        "battery": 100,
+        "linkquality": 182,
+        "motion_timeout": 60,
+        "occupancy": occupancy,
+        "update": {
+            "installed_version": 8705,
+            "latest_release_notes": None,
+            "latest_source": None,
+            "latest_version": 8705,
+            "state": "idle",
+        },
+        "voltage": 3100,
+    }
+
+
+def door(contact: bool, tamper: bool = False) -> dict[str, object]:
+    """One `zigbee2mqtt/r101_door` message as captured (H04)."""
+    return {
+        "battery": 100,
+        "battery_low": False,
+        "contact": contact,
+        "linkquality": 189,
+        "tamper": tamper,
+    }
+
+
 async def start() -> tuple[SensorsService, FakeMqtt, Subscription]:
     bus = EventBus(64)
     sub = bus.subscribe()
@@ -56,9 +96,9 @@ def readings(sub: Subscription) -> list[tuple[str, str, object]]:
     ]
 
 
-async def test_subscribes_to_the_climate_node_only() -> None:
+async def test_subscribes_to_the_three_sensor_nodes() -> None:
     service, mqtt, _ = await start()
-    assert list(mqtt.handlers) == [CLIMATE]
+    assert list(mqtt.handlers) == [CLIMATE, MOTION, DOOR]
     assert service.snapshot() == []
     await service.stop()
 
@@ -101,25 +141,81 @@ def test_a_missing_or_bad_value_drops_only_that_kind() -> None:
     assert climate_readings("r101_temp", {"battery": 100, "linkquality": 182}) == []
 
 
+async def test_motion_reports_give_detected_then_clear() -> None:
+    service, mqtt, sub = await start()
+    mqtt.deliver(MOTION, motion(occupancy=True))
+    mqtt.deliver(MOTION, motion(occupancy=False))
+    assert readings(sub) == [
+        ("r101_motion", "occupancy", "detected"),
+        ("r101_motion", "occupancy", "clear"),
+    ]
+    await service.stop()
+
+
+async def test_door_reports_give_closed_then_open() -> None:
+    service, mqtt, sub = await start()
+    mqtt.deliver(DOOR, door(contact=True))
+    mqtt.deliver(DOOR, door(contact=False))
+    assert readings(sub) == [("r101_door", "contact", "closed"), ("r101_door", "contact", "open")]
+    await service.stop()
+
+
+async def test_a_tamper_only_report_repeats_the_door_state() -> None:
+    service, mqtt, sub = await start()
+    mqtt.deliver(DOOR, door(contact=False, tamper=True))
+    mqtt.deliver(DOOR, door(contact=False, tamper=False))
+    assert readings(sub) == [("r101_door", "contact", "open"), ("r101_door", "contact", "open")]
+    await service.stop()
+
+
+def test_a_missing_or_non_bool_event_value_gives_nothing() -> None:
+    assert motion_readings("r101_motion", {"occupancy": True}) == [
+        HwOccupancyReading(node="r101_motion", kind="occupancy", value="detected")
+    ]
+    assert door_readings("r101_door", {"contact": True}) == [
+        HwContactReading(node="r101_door", kind="contact", value="closed")
+    ]
+    assert motion_readings("r101_motion", {"battery": 100, "motion_timeout": 60}) == []
+    assert motion_readings("r101_motion", {"occupancy": 1}) == []
+    assert door_readings("r101_door", {"contact": "true"}) == []
+    assert door_readings("r101_door", {"contact": None, "tamper": True}) == []
+
+
+async def test_reports_are_routed_by_topic() -> None:
+    service, mqtt, sub = await start()
+    mqtt.deliver(MOTION, {"contact": True, "temperature": 21})
+    mqtt.deliver(DOOR, {"occupancy": True, "humidity": 50})
+    mqtt.deliver(CLIMATE, {"occupancy": True, "contact": False})
+    mqtt.deliver("zigbee2mqtt/r101_ir", door(contact=True))
+    assert readings(sub) == []
+    await service.stop()
+
+
+@pytest.mark.parametrize("topic", [CLIMATE, MOTION, DOOR])
 @pytest.mark.parametrize("payload", ["online", None, [28.9, 64.6], 42])
 async def test_non_object_reports_are_logged_and_dropped(
-    payload: object, caplog: pytest.LogCaptureFixture
+    topic: str, payload: object, caplog: pytest.LogCaptureFixture
 ) -> None:
     service, mqtt, sub = await start()
     caplog.set_level(logging.WARNING, logger="hw")
-    mqtt.deliver(CLIMATE, payload)
+    mqtt.deliver(topic, payload)
     assert readings(sub) == []
-    assert "ignored a non-object report on zigbee2mqtt/r101_temp" in caplog.text
+    assert f"ignored a non-object report on {topic}" in caplog.text
     await service.stop()
 
 
-async def test_snapshot_keeps_the_latest_climate_reading() -> None:
+async def test_snapshot_keeps_the_latest_reading_of_each_kind() -> None:
     service, mqtt, _ = await start()
     mqtt.deliver(CLIMATE, report(64.6, 182))
     mqtt.deliver(CLIMATE, report(73, 98))
+    mqtt.deliver(MOTION, motion(occupancy=True))
+    mqtt.deliver(DOOR, door(contact=True))
+    mqtt.deliver(DOOR, door(contact=False))
     assert [(s.reading.kind, s.reading.value) for s in service.snapshot()] == [
         ("temperature", 28.9),
         ("humidity", 73),
+        ("occupancy", "detected"),
+        ("contact", "open"),
     ]
     await service.stop()
 
@@ -129,9 +225,13 @@ async def test_reports_after_a_broker_reconnect_still_arrive() -> None:
     mqtt.set_connected(False)
     mqtt.set_connected(True)
     mqtt.deliver(CLIMATE, report(63.5, 185))
+    mqtt.deliver(MOTION, motion(occupancy=True))
+    mqtt.deliver(DOOR, door(contact=True))
     assert readings(sub) == [
         ("r101_temp", "temperature", 28.9),
         ("r101_temp", "humidity", 64),
+        ("r101_motion", "occupancy", "detected"),
+        ("r101_door", "contact", "closed"),
     ]
     await service.stop()
 
@@ -140,4 +240,6 @@ async def test_no_readings_after_stop() -> None:
     service, mqtt, sub = await start()
     await service.stop()
     mqtt.deliver(CLIMATE, report(64.6, 182))
+    mqtt.deliver(MOTION, motion(occupancy=True))
+    mqtt.deliver(DOOR, door(contact=True))
     assert readings(sub) == []
PATCH
```
**Test:** the files above. Cases: subscribes to `r101_temp`, `r101_motion`, `r101_door` in that order; motion true →
detected, false → clear; door true → closed, false → open; tamper-only report repeats the door state; missing /
non-bool (`1`, `"true"`, `null`) → nothing; each topic parses only its own kind, other topics ignored; non-object
payloads on all three topics warn and emit nothing; snapshot keeps the latest of each kind; all three after a
reconnect; nothing after `stop()`. The H03 climate cases stay as they are.
**Verify:** `uv run --directory services/hw ruff check . && uv run --directory services/hw ruff format --check .` →
clean; `uv run --directory services/hw pytest -m "not hardware"` → 197 passed; `pnpm verify` green.
**Commit:** `git commit -m "feat(hw): real SNZB-03P motion and SNZB-04PR2 door sensors through zigbee2mqtt"`

### T2 — hw: confirmed `r101_motion` and `r101_door` in config
- [ ] done

**Files:** `services/hw/app/config.py`
**Context:** H04 Scope (ieee `0x18690afffe1ca686` motion, `0xa4c138128a8fffff` door; models and friendly names
confirmed). Only the fake `zigbee_status` driver reads `DEFAULT_NODES`, so S2 shows the new ieee; lqi / battery stay
the fake values (H04 Out of scope). No test pins these ieee values.
**Do:** Patch:
```sh
git apply <<'PATCH'
diff --git a/services/hw/app/config.py b/services/hw/app/config.py
index e705a41..82fc890 100644
--- a/services/hw/app/config.py
+++ b/services/hw/app/config.py
@@ -38,7 +38,8 @@ class CoordinatorConfig(BaseModel):
 
 
 # R-101 as in screenshot 02 and fixtures/hw/response.snapshot.json. [ASSUMED] until intake, except
-# r101_temp's ieee and model (paired on the R-101 Pi 2026-10-16, H03); its lqi/battery stay fake.
+# the ieee and model of r101_temp (H03), r101_motion and r101_door (H04), paired on the R-101 Pi
+# 2026-10-16; their lqi/battery stay fake.
 DEFAULT_NODES = [
     ZigbeeNodeConfig(
         ieee="0xa4c1380f2b9e0001",
@@ -68,7 +69,7 @@ DEFAULT_NODES = [
         battery_pct=98,
     ),
     ZigbeeNodeConfig(
-        ieee="0x00124b0029b70004",
+        ieee="0x18690afffe1ca686",
         friendly_name="r101_motion",
         model="SNZB-03P",
         role="end_device",
@@ -77,7 +78,7 @@ DEFAULT_NODES = [
         battery_pct=91,
     ),
     ZigbeeNodeConfig(
-        ieee="0x00124b0029b70005",
+        ieee="0xa4c138128a8fffff",
         friendly_name="r101_door",
         model="SNZB-04PR2",
         role="end_device",
@@ -121,7 +122,7 @@ class Settings(BaseSettings):
     mqtt_publish_timeout_s: float = Field(default=2.0, gt=0)
 
     # Friendly names [ASSUMED] (ARCHITECTURE §7.1); confirmed on hardware: ir_node (INTAKE-01 §2C),
-    # temp_node (H03).
+    # temp_node (H03), motion_node and door_node (H04).
     lights_node: str = "r101_lights"
     proj_plug_node: str = "r101_proj_plug"
     ir_node: str = "r101_ir"
PATCH
```
**Verify:** `uv run --directory services/hw pytest -m "not hardware"` → 197 passed; ruff clean; `pnpm verify` green.
**Commit:** `git commit -m "chore(hw): confirmed r101_motion and r101_door ieee and node names (H04)"`

### T3 — hw: motion and door hardware test `[ON PI]`
- [ ] done

**Files:** `services/hw/tests/test_sensors_hardware.py`
**Context:** H04 Scope (hardware test). Both sensors report only on change, so the test checks the link, not a
reading. `<base>/<node>/availability` is retained, so it arrives right after the subscribe. The H03 test becomes one
case of three.
**Do:** Patch:
```sh
git apply <<'PATCH'
diff --git a/services/hw/tests/test_sensors_hardware.py b/services/hw/tests/test_sensors_hardware.py
index 51038f4..73b0dec 100644
--- a/services/hw/tests/test_sensors_hardware.py
+++ b/services/hw/tests/test_sensors_hardware.py
@@ -1,7 +1,8 @@
-"""[ON PI] RealSensorsDriver against the real broker, zigbee2mqtt and the paired SNZB-02P.
+"""[ON PI] RealSensorsDriver against the real broker, zigbee2mqtt and the paired sensors.
 
-Run on the R-101 Pi only: `uv run --directory services/hw pytest -m hardware`. The sensor reports
-only on change, so this checks the link (broker connected, `r101_temp` online), not a reading.
+Run on the R-101 Pi only: `uv run --directory services/hw pytest -m hardware`. The sensors report
+only on change, so this checks the link (broker connected, node online), not a reading:
+`r101_temp` (SNZB-02P, H03), `r101_motion` (SNZB-03P) and `r101_door` (SNZB-04PR2, H04).
 """
 
 import asyncio
@@ -19,8 +20,9 @@ pytestmark = pytest.mark.hardware
 ONLINE = {"state": "online"}  # zigbee2mqtt 2.x availability payload
 
 
-async def test_climate_sensor_is_online_within_5_s() -> None:
-    settings = Settings(_env_file=None)  # 127.0.0.1:1883, zigbee2mqtt, r101_temp
+@pytest.mark.parametrize("node", ["temp_node", "motion_node", "door_node"])
+async def test_sensor_is_online_within_5_s(node: str) -> None:
+    settings = Settings(_env_file=None)  # 127.0.0.1:1883, zigbee2mqtt, r101_temp/motion/door
     mqtt = MqttTransport(settings)
     service = SensorsService(RealSensorsDriver(settings, mqtt), EventBus(64))
     online = asyncio.Event()
@@ -30,7 +32,12 @@ async def test_climate_sensor_is_online_within_5_s() -> None:
             online.set()
 
     # Retained by zigbee2mqtt, so it arrives right after the subscribe.
-    availability = f"{settings.z2m_base_topic}/{settings.temp_node}/availability"
+    friendly_name = {
+        "temp_node": settings.temp_node,
+        "motion_node": settings.motion_node,
+        "door_node": settings.door_node,
+    }[node]
+    availability = f"{settings.z2m_base_topic}/{friendly_name}/availability"
     mqtt.subscribe(availability, on_availability)
     await service.start()
     await mqtt.start()
PATCH
```
**Verify:** `[ON PI]` `uv run --directory services/hw pytest -m hardware` → 5 passed (2 ZS06 + 3 sensors; no remote
may be pressed during the IR learn test); `pytest -m "not hardware"` → 197 passed, 5 deselected; ruff clean;
`pnpm verify` green.
**Commit:** `git commit -m "test(hw): SNZB-03P and SNZB-04PR2 hardware test (r101_motion, r101_door online)"`

### T4 — deploy: README and hw.env.example note motion and door
- [ ] done

**Files:** `deploy/pi/README.md`, `deploy/pi/env/hw.env.example`
**Context:** H04 Scope. `HW_DRIVERS=ir=real,sensors=real` is unchanged, so `tests/test_deploy_env.py` stays green
untouched.
**Do:** Patch:
```sh
git apply <<'PATCH'
diff --git a/deploy/pi/README.md b/deploy/pi/README.md
index 67e5f76..b4ff425 100644
--- a/deploy/pi/README.md
+++ b/deploy/pi/README.md
@@ -91,8 +91,9 @@ sudo systemctl restart eduscope.target
 curl -s 127.0.0.1:8081/v1/health                    # "ir":"real", "sensors":"real"
 ```
 
-With `sensors=real` only the climate sensor (`r101_temp`) reports; motion and door show "No reading
-yet" until they are paired (H03).
+With `sensors=real` the climate sensor (`r101_temp`, H03), the motion sensor (`r101_motion`) and the
+door sensor (`r101_door`, H04) report through the same driver. None of them is retained, so after a
+restart each tile shows "No reading yet" until that sensor's next report.
 
 ## 6 Backup
 
diff --git a/deploy/pi/env/hw.env.example b/deploy/pi/env/hw.env.example
index 21c2a51..cbdd20d 100644
--- a/deploy/pi/env/hw.env.example
+++ b/deploy/pi/env/hw.env.example
@@ -2,5 +2,5 @@
 # deploy/pi/env/hw.env.example; install.sh never changes it afterwards. Keys: services/hw/app/config.py.
 HW_MODE=fake
 # Per-module override (D-19). Each Hxx milestone switches its own module; H01: the ZS06 IR blaster,
-# H03: the SNZB-02P climate sensor.
+# H03: the SNZB-02P climate sensor (H04: same module, also the SNZB-03P motion and SNZB-04PR2 door).
 HW_DRIVERS=ir=real,sensors=real
PATCH
```
**Verify:** `uv run --directory services/hw pytest -m "not hardware" tests/test_deploy_env.py` → passes; full
`pytest -m "not hardware"` → 197 passed; `pnpm verify` green.
**Commit:** `git commit -m "docs(deploy): motion and door sensors report since H04"`

### T5 — Acceptance on the Pi (H04)
- [ ] done

**Files:** this plan (tick, "Observed on R-101" notes, failures under `## Blockers`).
**Do:** (PLAN-H03 T5 ticked first — Executor notes.)
1. `[ON PI · HUMAN]` `! sudo deploy/pi/install.sh` (builds and restarts `eduscope.target` with T1–T4).
2. **AC1** `[ON PI]` `curl -s 127.0.0.1:8081/v1/health` → `"ir":"real"` and `"sensors":"real"`.
3. **AC2** `[ON PI]` in one terminal `mosquitto_sub -h 127.0.0.1 -t zigbee2mqtt/r101_door -v`. `[ON PI · HUMAN]` pull
   the magnet away from the door sensor → within 5 s S1 DOOR reads "Open" (amber) and the message has
   `"contact":false`; put it back → "Closed", `"contact":true`. Repeat twice. S2 "Door" row shows the same and its
   last seen is "now"/seconds.
4. **AC3** `[ON PI]` `mosquitto_sub -h 127.0.0.1 -t zigbee2mqtt/r101_motion -v`. `[ON PI · HUMAN]` wave at the motion
   sensor → within 5 s S1 OCCUPANCY reads "Detected" (green), `"occupancy":true`. Leave its view (> 60 s with no
   movement) → "Clear", `"occupancy":false`. S2 "Motion" row shows the same.
5. **AC4** `[ON PI · HUMAN]` breathe on the climate sensor so it is fresh too; then S1.E41 reads "3 of 3 reporting"
   and both new tiles show `SNZB-03P` / `SNZB-04PR2`.
6. **AC5** `[ON PI · HUMAN]` `! sudo systemctl restart zigbee2mqtt`, wait 30 s, pull the door magnet → the new value
   reaches S1 within 5 s. Repeat with `! sudo systemctl restart mosquitto`. `systemctl status eduscope-hw` shows no
   restart (same `Active: since`).
7. **AC6 / D3** `[ON PI · HUMAN]` door closed, cover shut, nobody in the room. `[ON PI]` for 70 min:
   `timeout 4200 mosquitto_sub -h 127.0.0.1 -v -t zigbee2mqtt/r101_motion -t zigbee2mqtt/r101_door | while read -r l;
   do echo "$(date +%T) $l"; done | tee ~/h04-quiet.log`. Write every report time, the longest gap (s) per node, and
   whether `curl -s 127.0.0.1/api/state` shows `environment.sensors.occupancy.stale` / `.contact.stale` (and S1
   OCCUPANCY / DOOR) at the end, under "Observed on R-101" below. Stale is recorded, not a failure (D3).
8. **AC7** `[ON PI]` `uv run --directory services/hw pytest -m hardware` → 5 passed; `pnpm verify` green;
   `git status --short` clean apart from this plan.

**Observed on R-101:** (executor fills in)

**Verify:** every step passes as written; otherwise `## Blockers` and stop.
**Commit:** `git commit -m "docs: H04 acceptance walk-through"`

## Checkpoints
After T4: "Human: PLAN-H03 T5 must be done; then run step 1 of T5 (install.sh) — the rest of T5 needs it."

## Nice-to-haves (not tasks)

- Real `zigbee_status` driver so last seen, battery % and LQI come from zigbee2mqtt (fixes D3 for a quiet room).
- Surface `tamper` (cover open) and `battery_low` once a contract field exists for them.

## Blockers

(executor writes here; leave empty)
