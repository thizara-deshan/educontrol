"""Real lights driver: stub until hardware intake.

[ASSUMED] ZBM5-2C-86W via zigbee2mqtt `state_l1` / `state_l2` (ARCHITECTURE §7.2).
"""

from app.config import Settings
from app.contracts import INTAKE_PENDING, HwAck, HwDriverKind
from app.modules.lights.schemas import HwLightsSetRequest
from app.modules.lights.service import LightsEmit


class RealLightsDriver:
    kind: HwDriverKind = "real"

    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    async def start(self, emit: LightsEmit) -> None:
        """Nothing to start before intake; the module reports nothing (snapshot stays null)."""

    async def stop(self) -> None:
        """Nothing to stop."""

    async def set(self, request: HwLightsSetRequest) -> HwAck:
        raise NotImplementedError(INTAKE_PENDING)
