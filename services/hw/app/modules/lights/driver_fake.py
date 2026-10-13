"""Fake lights: in-memory gangs that echo every change as `lights.state`."""

from fastapi import APIRouter

from app.config import Settings
from app.contracts import ACK_OK, HwAck, HwAckOk, HwDriverKind, HwModel
from app.modules.lights.schemas import (
    HwLightsSetRequest,
    HwLightsStateData,
    HwLightsStateEvent,
    LightGang,
)
from app.modules.lights.service import LightsEmit


class FakeLightsDriver:
    kind: HwDriverKind = "fake"

    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._on: dict[LightGang, bool] = {"front": True, "rear": False}  # screenshot 01
        self._emit: LightsEmit | None = None

    async def start(self, emit: LightsEmit) -> None:
        self._emit = emit
        self._report("front")
        self._report("rear")

    async def stop(self) -> None:
        self._emit = None

    async def set(self, request: HwLightsSetRequest) -> HwAck:
        self._on[request.gang] = request.on
        self._report(request.gang)
        return ACK_OK

    def by_hand(self, gang: LightGang, on: bool | None) -> None:
        """Someone used the wall switch: no command, just a state event."""
        self._on[gang] = (not self._on[gang]) if on is None else on
        self._report(gang)

    def _report(self, gang: LightGang) -> None:
        if self._emit is not None:
            self._emit(HwLightsStateEvent(data=HwLightsStateData(gang=gang, on=self._on[gang])))


class FakeByHandRequest(HwModel):
    gang: LightGang = "rear"
    on: bool | None = None  # None = flip the gang


def build_fake_router(driver: FakeLightsDriver) -> APIRouter:
    router = APIRouter(prefix="/v1/_fake/lights", tags=["fake"])

    @router.post("/by_hand")
    async def by_hand(body: FakeByHandRequest | None = None) -> HwAckOk:
        request = body or FakeByHandRequest()
        driver.by_hand(request.gang, request.on)
        return ACK_OK

    return router
