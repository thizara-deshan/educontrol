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
