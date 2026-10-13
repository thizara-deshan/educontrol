"""Real zigbee_status driver: stub until hardware intake.

[ASSUMED] zigbee2mqtt `bridge/*` topics; ZG-808Z coordinator (ARCHITECTURE §7.2).
"""

from app.config import Settings
from app.contracts import INTAKE_PENDING, HwAck, HwDriverKind
from app.modules.zigbee_status.schemas import HwZigbeeStatusPermitJoinRequest
from app.modules.zigbee_status.service import ZigbeeEmit


class RealZigbeeStatusDriver:
    kind: HwDriverKind = "real"

    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    async def start(self, emit: ZigbeeEmit) -> None:
        """Nothing to start before intake; coordinator stays null and the node list empty."""

    async def stop(self) -> None:
        """Nothing to stop."""

    async def permit_join(self, request: HwZigbeeStatusPermitJoinRequest) -> HwAck:
        raise NotImplementedError(INTAKE_PENDING)
