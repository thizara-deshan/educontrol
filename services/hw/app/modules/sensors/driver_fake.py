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
