"""Real projection screen driver: stub until hardware intake.

[ASSUMED] Relay or IR; position source unknown (Q2) (ARCHITECTURE §7.2).
"""

from app.config import Settings
from app.contracts import INTAKE_PENDING, HwAck, HwDriverKind
from app.modules.projection_screen.schemas import HwProjectionScreenMoveRequest
from app.modules.projection_screen.service import ScreenEmit


class RealProjectionScreenDriver:
    kind: HwDriverKind = "real"

    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    async def start(self, emit: ScreenEmit) -> None:
        """Nothing to start before intake; the position stays "unknown"."""

    async def stop(self) -> None:
        """Nothing to stop."""

    async def move(self, request: HwProjectionScreenMoveRequest) -> HwAck:
        raise NotImplementedError(INTAKE_PENDING)
