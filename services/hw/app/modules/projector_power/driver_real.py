"""Real projector plug driver: stub until hardware intake.

[ASSUMED] S60ZBTPG via zigbee2mqtt (power, voltage, energy) (ARCHITECTURE §7.2).
"""

from app.config import Settings
from app.contracts import INTAKE_PENDING, HwAck, HwDriverKind
from app.modules.projector_power.schemas import HwProjectorPowerRelayRequest
from app.modules.projector_power.service import ProjectorPowerEmit


class RealProjectorPowerDriver:
    kind: HwDriverKind = "real"

    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    async def start(self, emit: ProjectorPowerEmit) -> None:
        """Nothing to start before intake; the module reports nothing (snapshot stays null)."""

    async def stop(self) -> None:
        """Nothing to stop."""

    async def relay(self, request: HwProjectorPowerRelayRequest) -> HwAck:
        raise NotImplementedError(INTAKE_PENDING)
