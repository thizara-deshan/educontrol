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
