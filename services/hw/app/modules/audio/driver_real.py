"""Real audio driver: stub until hardware intake.

[ASSUMED] ALSA mixer on the Pi via `amixer` (Q8) (ARCHITECTURE §7.2).
"""

from app.config import Settings
from app.contracts import INTAKE_PENDING, HwAck, HwDriverKind
from app.modules.audio.schemas import HwAudioLevelRequest, HwAudioMuteRequest
from app.modules.audio.service import AudioEmit


class RealAudioDriver:
    kind: HwDriverKind = "real"

    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    async def start(self, emit: AudioEmit) -> None:
        """Nothing to start before intake; the module reports nothing (snapshot stays null)."""

    async def stop(self) -> None:
        """Nothing to stop."""

    async def level(self, request: HwAudioLevelRequest) -> HwAck:
        raise NotImplementedError(INTAKE_PENDING)

    async def mute(self, request: HwAudioMuteRequest) -> HwAck:
        raise NotImplementedError(INTAKE_PENDING)
