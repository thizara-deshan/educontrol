"""ir: send and learn Tuya IR codes through the blaster (ARCHITECTURE §7.2, §6.9)."""

from collections.abc import Callable
from typing import Protocol

from app.contracts import HwAck, HwDriverKind, HwErrorData, HwErrorEvent, guard, logger
from app.events import EventBus
from app.modules.ir.schemas import (
    HwIrBlasterEvent,
    HwIrLearnEvent,
    HwIrLearnRequest,
    HwIrLearnResult,
    HwIrLearnTimeout,
    HwIrSendRequest,
    HwIrSnapshot,
)

IrEvent = HwIrBlasterEvent | HwIrLearnEvent
IrEmit = Callable[[IrEvent], None]


class IrDriver(Protocol):
    kind: HwDriverKind

    async def start(self, emit: IrEmit) -> None: ...

    async def stop(self) -> None: ...

    async def send(self, request: HwIrSendRequest) -> HwAck: ...

    async def learn(self, request: HwIrLearnRequest) -> HwIrLearnResult: ...

    async def cancel_learn(self) -> HwAck: ...


class IrService:
    def __init__(self, driver: IrDriver, bus: EventBus) -> None:
        self.driver = driver
        self._bus = bus
        self._state = HwIrSnapshot(blaster=None)

    async def start(self) -> None:
        await self.driver.start(self._on_event)

    async def stop(self) -> None:
        await self.driver.stop()

    def snapshot(self) -> HwIrSnapshot:
        return self._state.model_copy()

    async def send(self, request: HwIrSendRequest) -> HwAck:
        return await guard("ir", self.driver.send(request))

    async def learn(self, request: HwIrLearnRequest) -> HwIrLearnResult:
        """The learn response has no error variant: a driver failure is reported as `hw.error`
        and answered with `timeout` (nothing was captured, the old code stays untouched)."""
        try:
            return await self.driver.learn(request)
        except Exception as exc:
            logger.warning("ir learn failed: %s", exc)
            data = HwErrorData(module="ir", code="transport", message=f"ir: {exc}")
            self._bus.publish(HwErrorEvent(data=data))
            return HwIrLearnTimeout(status="timeout")

    async def cancel_learn(self) -> HwAck:
        return await guard("ir", self.driver.cancel_learn())

    def _on_event(self, event: IrEvent) -> None:
        if isinstance(event, HwIrBlasterEvent):
            self._state = HwIrSnapshot(blaster=event.data)
        self._bus.publish(event)
