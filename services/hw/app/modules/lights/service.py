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
