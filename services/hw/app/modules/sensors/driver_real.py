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
