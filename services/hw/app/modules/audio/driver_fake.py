"""Fake mixer: echoes every level/mute change as `audio.state`. No simulation routes."""

from app.config import Settings
from app.contracts import ACK_OK, HwAck, HwDriverKind
from app.modules.audio.schemas import (
    AudioChannel,
    HwAudioChannelState,
    HwAudioLevelRequest,
    HwAudioMuteRequest,
    HwAudioStateData,
    HwAudioStateEvent,
)
from app.modules.audio.service import AudioEmit


class FakeAudioDriver:
    kind: HwDriverKind = "fake"

    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._channels: dict[AudioChannel, HwAudioChannelState] = {  # screenshot 01
            "mic": HwAudioChannelState(level=62, muted=False),
            "pc": HwAudioChannelState(level=38, muted=False),
        }
        self._emit: AudioEmit | None = None

    async def start(self, emit: AudioEmit) -> None:
        self._emit = emit
        self._report("mic")
        self._report("pc")

    async def stop(self) -> None:
        self._emit = None

    async def level(self, request: HwAudioLevelRequest) -> HwAck:
        current = self._channels[request.channel]
        self._channels[request.channel] = current.model_copy(update={"level": request.level})
        self._report(request.channel)
        return ACK_OK

    async def mute(self, request: HwAudioMuteRequest) -> HwAck:
        current = self._channels[request.channel]
        self._channels[request.channel] = current.model_copy(update={"muted": request.muted})
        self._report(request.channel)
        return ACK_OK

    def _report(self, channel: AudioChannel) -> None:
        if self._emit is not None:
            state = self._channels[channel]
            data = HwAudioStateData(channel=channel, level=state.level, muted=state.muted)
            self._emit(HwAudioStateEvent(data=data))
