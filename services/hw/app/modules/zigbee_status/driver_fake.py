"""Fake Zigbee bridge: coordinator and nodes from config (HW_COORDINATOR, HW_ZIGBEE_NODES);
permit join opens the mesh and closes it again after `seconds` (scaled)."""

import asyncio
from datetime import datetime, timedelta

from fastapi import APIRouter

from app.config import Settings
from app.contracts import (
    ACK_OK,
    HwAck,
    HwAckError,
    HwAckOk,
    HwDriverKind,
    HwModel,
    ack_error,
    utc_now,
)
from app.fake_support import FakeTasks, scaled
from app.modules.zigbee_status.schemas import (
    HwCoordinator,
    HwMeshData,
    HwZigbeeCoordinatorEvent,
    HwZigbeeMeshEvent,
    HwZigbeeNode,
    HwZigbeeNodeEvent,
    HwZigbeeStatusPermitJoinRequest,
)
from app.modules.zigbee_status.service import ZigbeeEmit


class FakeZigbeeStatusDriver:
    kind: HwDriverKind = "fake"

    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._coordinator = HwCoordinator(**settings.coordinator.model_dump(), status="online")
        now = utc_now()
        self._nodes = {
            node.friendly_name: HwZigbeeNode(**node.model_dump(), last_seen=now, online=True)
            for node in settings.zigbee_nodes
        }
        self._emit: ZigbeeEmit | None = None
        self._tasks = FakeTasks()
        self._closer: asyncio.Task[None] | None = None

    async def start(self, emit: ZigbeeEmit) -> None:
        self._emit = emit
        emit(HwZigbeeCoordinatorEvent(data=self._coordinator))
        for node in self._nodes.values():
            emit(HwZigbeeNodeEvent(data=node))
        emit(HwZigbeeMeshEvent(data=HwMeshData(joining_until=None)))

    async def stop(self) -> None:
        await self._tasks.cancel_all()
        self._emit = None

    async def permit_join(self, request: HwZigbeeStatusPermitJoinRequest) -> HwAck:
        if self._coordinator.status != "online":
            return ack_error("device_offline", "Zigbee coordinator is offline")
        if self._closer is not None:
            self._closer.cancel()
            self._closer = None
        if request.seconds == 0:
            self._report_mesh(None)
            return ACK_OK
        duration_s = scaled(self._settings, request.seconds)
        self._report_mesh(utc_now() + timedelta(seconds=duration_s))
        self._closer = self._tasks.spawn(self._close_after(duration_s))
        return ACK_OK

    def set_node_online(self, friendly_name: str, online: bool) -> HwAckOk | HwAckError:
        node = self._nodes.get(friendly_name)
        if node is None:
            return ack_error("invalid", f"Unknown Zigbee node {friendly_name}")
        update = {"online": True, "last_seen": utc_now()} if online else {"online": False}
        self._nodes[friendly_name] = node.model_copy(update=update)
        if self._emit is not None:
            self._emit(HwZigbeeNodeEvent(data=self._nodes[friendly_name]))
        return ACK_OK

    def set_coordinator_online(self, online: bool) -> None:
        status = "online" if online else "offline"
        self._coordinator = self._coordinator.model_copy(update={"status": status})
        if self._emit is not None:
            self._emit(HwZigbeeCoordinatorEvent(data=self._coordinator))

    async def _close_after(self, duration_s: float) -> None:
        await asyncio.sleep(duration_s)
        self._closer = None
        self._report_mesh(None)

    def _report_mesh(self, joining_until: datetime | None) -> None:
        if self._emit is not None:
            self._emit(HwZigbeeMeshEvent(data=HwMeshData(joining_until=joining_until)))


class FakeNodeOnlineRequest(HwModel):
    friendly_name: str
    online: bool = False


class FakeOnlineRequest(HwModel):
    online: bool = False


def build_fake_router(driver: FakeZigbeeStatusDriver) -> APIRouter:
    router = APIRouter(prefix="/v1/_fake/zigbee_status", tags=["fake"])

    @router.post("/node_offline")
    async def node_offline(body: FakeNodeOnlineRequest) -> HwAckOk | HwAckError:
        return driver.set_node_online(body.friendly_name, body.online)

    @router.post("/coordinator_offline")
    async def coordinator_offline(body: FakeOnlineRequest | None = None) -> HwAckOk:
        driver.set_coordinator_online((body or FakeOnlineRequest()).online)
        return ACK_OK

    return router
