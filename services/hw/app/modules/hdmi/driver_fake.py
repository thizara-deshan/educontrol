"""Fake HDMI switch: echoes every selection as `hdmi.state`. No simulation routes."""

from app.config import Settings
from app.contracts import ACK_OK, HwAck, HwDriverKind
from app.modules.hdmi.schemas import (
    HdmiInput,
    HwHdmiSelectRequest,
    HwHdmiStateData,
    HwHdmiStateEvent,
)
from app.modules.hdmi.service import HdmiEmit


class FakeHdmiDriver:
    kind: HwDriverKind = "fake"

    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._input: HdmiInput = "podium_pc"  # screenshot 01
        self._emit: HdmiEmit | None = None

    async def start(self, emit: HdmiEmit) -> None:
        self._emit = emit
        self._report()

    async def stop(self) -> None:
        self._emit = None

    async def select(self, request: HwHdmiSelectRequest) -> HwAck:
        self._input = request.input
        self._report()
        return ACK_OK

    def _report(self) -> None:
        if self._emit is not None:
            self._emit(HwHdmiStateEvent(data=HwHdmiStateData(input=self._input)))
