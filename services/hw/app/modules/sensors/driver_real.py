"""Real sensors driver: stub until hardware intake.

[ASSUMED] SNZB-02P / SNZB-03P / SNZB-04PR2 via zigbee2mqtt (ARCHITECTURE §7.2).
"""

from app.config import Settings
from app.contracts import HwDriverKind
from app.modules.sensors.service import SensorsEmit


class RealSensorsDriver:
    kind: HwDriverKind = "real"

    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    async def start(self, emit: SensorsEmit) -> None:
        """Nothing to start before intake; no readings are reported."""

    async def stop(self) -> None:
        """Nothing to stop."""
