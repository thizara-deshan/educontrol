"""zigbee_status: coordinator, paired nodes and permit-join (ARCHITECTURE §7.2)."""

from collections.abc import Callable
from datetime import datetime
from typing import Protocol

from app.contracts import HwAck, HwDriverKind, guard
from app.events import EventBus
from app.modules.zigbee_status.schemas import (
    HwCoordinator,
    HwZigbeeCoordinatorEvent,
    HwZigbeeMeshEvent,
    HwZigbeeNode,
    HwZigbeeNodeEvent,
    HwZigbeeSnapshot,
    HwZigbeeStatusPermitJoinRequest,
)

ZigbeeEvent = HwZigbeeNodeEvent | HwZigbeeCoordinatorEvent | HwZigbeeMeshEvent
ZigbeeEmit = Callable[[ZigbeeEvent], None]


class ZigbeeStatusDriver(Protocol):
    kind: HwDriverKind

    async def start(self, emit: ZigbeeEmit) -> None: ...

    async def stop(self) -> None: ...

    async def permit_join(self, request: HwZigbeeStatusPermitJoinRequest) -> HwAck: ...


class ZigbeeStatusService:
    def __init__(self, driver: ZigbeeStatusDriver, bus: EventBus) -> None:
        self.driver = driver
        self._bus = bus
        self._coordinator: HwCoordinator | None = None
        self._nodes: dict[str, HwZigbeeNode] = {}  # by ieee, first-reported order
        self._joining_until: datetime | None = None

    async def start(self) -> None:
        await self.driver.start(self._on_event)

    async def stop(self) -> None:
        await self.driver.stop()

    def snapshot(self) -> HwZigbeeSnapshot:
        return HwZigbeeSnapshot(
            coordinator=self._coordinator,
            nodes=list(self._nodes.values()),
            joining_until=self._joining_until,
        )

    async def permit_join(self, request: HwZigbeeStatusPermitJoinRequest) -> HwAck:
        return await guard("zigbee_status", self.driver.permit_join(request))

    def _on_event(self, event: ZigbeeEvent) -> None:
        if isinstance(event, HwZigbeeNodeEvent):
            self._nodes[event.data.ieee] = event.data
        elif isinstance(event, HwZigbeeCoordinatorEvent):
            self._coordinator = event.data
        else:
            self._joining_until = event.data.joining_until
        self._bus.publish(event)
