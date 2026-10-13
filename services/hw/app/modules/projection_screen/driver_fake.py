"""Fake projection screen: "moving", then the end position after TRAVEL_S (scaled)."""

import asyncio

from app.config import Settings
from app.contracts import ACK_OK, HwAck, HwDriverKind
from app.fake_support import FakeTasks, scaled
from app.modules.projection_screen.schemas import (
    HwProjectionScreenMoveRequest,
    HwProjectionScreenStateEvent,
    HwScreenPosition,
    HwScreenStateData,
)
from app.modules.projection_screen.service import ScreenEmit

TRAVEL_S = 3.0  # [ASSUMED] short enough for the 5 s screen command timeout (Q12)


class FakeProjectionScreenDriver:
    kind: HwDriverKind = "fake"

    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._position: HwScreenPosition = "lowered"  # screenshot 01
        self._emit: ScreenEmit | None = None
        self._tasks = FakeTasks()
        self._travel: asyncio.Task[None] | None = None

    async def start(self, emit: ScreenEmit) -> None:
        self._emit = emit
        self._report()

    async def stop(self) -> None:
        await self._tasks.cancel_all()
        self._emit = None

    async def move(self, request: HwProjectionScreenMoveRequest) -> HwAck:
        target: HwScreenPosition = "raised" if request.to == "raise" else "lowered"
        if self._travel is not None:
            self._travel.cancel()  # last write wins: a new move replaces the one in progress
        self._position = "moving"
        self._report()
        self._travel = self._tasks.spawn(self._arrive(target))
        return ACK_OK

    async def _arrive(self, target: HwScreenPosition) -> None:
        await asyncio.sleep(scaled(self._settings, TRAVEL_S))
        self._position = target
        self._travel = None
        self._report()

    def _report(self) -> None:
        if self._emit is not None:
            self._emit(
                HwProjectionScreenStateEvent(data=HwScreenStateData(position=self._position))
            )
