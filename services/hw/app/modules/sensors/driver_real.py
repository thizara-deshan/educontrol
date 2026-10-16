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
