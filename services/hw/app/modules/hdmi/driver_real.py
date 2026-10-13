"""Real HDMI switch driver: stub until hardware intake.

[ASSUMED] Model and read-back unknown (Q1); serial (ARCHITECTURE §7.2).
"""

from app.config import Settings
from app.contracts import INTAKE_PENDING, HwAck, HwDriverKind
from app.modules.hdmi.schemas import HwHdmiSelectRequest
from app.modules.hdmi.service import HdmiEmit


class RealHdmiDriver:
    kind: HwDriverKind = "real"

    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    async def start(self, emit: HdmiEmit) -> None:
        """Nothing to start before intake; the module reports nothing (snapshot stays null)."""

    async def stop(self) -> None:
        """Nothing to stop."""

    async def select(self, request: HwHdmiSelectRequest) -> HwAck:
        raise NotImplementedError(INTAKE_PENDING)
