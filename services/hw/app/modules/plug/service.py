"""plug: a general-purpose smart plug with a power meter (D-34)."""

from collections.abc import Callable
from typing import Protocol

from app.contracts import HwAck, HwDriverKind, guard
from app.events import EventBus
from app.modules.plug.schemas import HwPlugSetRequest, HwPlugStateData, HwPlugStateEvent

PlugEmit = Callable[[HwPlugStateEvent], None]


class PlugDriver(Protocol):
    kind: HwDriverKind

    async def start(self, emit: PlugEmit) -> None: ...

    async def stop(self) -> None: ...

    async def set(self, request: HwPlugSetRequest) -> HwAck: ...


class PlugService:
    def __init__(self, driver: PlugDriver, bus: EventBus) -> None:
        self.driver = driver
        self._bus = bus
        self._state: HwPlugStateData | None = None

    async def start(self) -> None:
        await self.driver.start(self._on_event)

    async def stop(self) -> None:
        await self.driver.stop()

    def snapshot(self) -> HwPlugStateData | None:
        return None if self._state is None else self._state.model_copy()

    async def set(self, request: HwPlugSetRequest) -> HwAck:
        return await guard("plug", self.driver.set(request))

    def _on_event(self, event: HwPlugStateEvent) -> None:
        self._state = event.data
        self._bus.publish(event)
