"""audio contract. Mirrors packages/contracts/src/hw (HwAudioLevelRequest, HwAudioMuteRequest,
HwAudioStateData, HwAudioChannelState)."""

from typing import Literal

from app.contracts import HwEnvelope, HwModel, Level

AudioChannel = Literal["mic", "pc"]


class HwAudioLevelRequest(HwModel):
    channel: AudioChannel
    level: Level


class HwAudioMuteRequest(HwModel):
    channel: AudioChannel
    muted: bool


class HwAudioStateData(HwModel):
    channel: AudioChannel
    level: Level
    muted: bool


class HwAudioStateEvent(HwEnvelope):
    type: Literal["audio.state"] = "audio.state"
    data: HwAudioStateData


class HwAudioChannelState(HwModel):
    level: Level
    muted: bool


class HwAudioSnapshot(HwModel):
    """HwSnapshot.audio. None = channel not reported yet."""

    mic: HwAudioChannelState | None
    pc: HwAudioChannelState | None
