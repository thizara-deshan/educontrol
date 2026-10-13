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
