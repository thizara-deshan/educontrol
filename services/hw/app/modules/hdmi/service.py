"""hdmi: the projector's input switch (ARCHITECTURE §7.2)."""

from collections.abc import Callable
from typing import Protocol

from app.contracts import HwAck, HwDriverKind, guard
from app.events import EventBus
from app.modules.hdmi.schemas import HwHdmiSelectRequest, HwHdmiSnapshot, HwHdmiStateEvent

HdmiEmit = Callable[[HwHdmiStateEvent], None]


class HdmiDriver(Protocol):
    kind: HwDriverKind

    async def start(self, emit: HdmiEmit) -> None: ...

    async def stop(self) -> None: ...

    async def select(self, request: HwHdmiSelectRequest) -> HwAck: ...


class HdmiService:
    def __init__(self, driver: HdmiDriver, bus: EventBus) -> None:
        self.driver = driver
        self._bus = bus
        self._state = HwHdmiSnapshot(input=None)

    async def start(self) -> None:
        await self.driver.start(self._on_event)

    async def stop(self) -> None:
        await self.driver.stop()

    def snapshot(self) -> HwHdmiSnapshot:
        return self._state.model_copy()

    async def select(self, request: HwHdmiSelectRequest) -> HwAck:
        return await guard("hdmi", self.driver.select(request))

    def _on_event(self, event: HwHdmiStateEvent) -> None:
        self._state = HwHdmiSnapshot(input=event.data.input)
        self._bus.publish(event)
