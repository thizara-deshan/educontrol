"""audio: mic and PC channels on the room mixer (ARCHITECTURE §7.2)."""

from collections.abc import Callable
from typing import Protocol

from app.contracts import HwAck, HwDriverKind, guard
from app.events import EventBus
from app.modules.audio.schemas import (
    HwAudioChannelState,
    HwAudioLevelRequest,
    HwAudioMuteRequest,
    HwAudioSnapshot,
    HwAudioStateEvent,
)

AudioEmit = Callable[[HwAudioStateEvent], None]


class AudioDriver(Protocol):
    kind: HwDriverKind

    async def start(self, emit: AudioEmit) -> None: ...

    async def stop(self) -> None: ...

    async def level(self, request: HwAudioLevelRequest) -> HwAck: ...

    async def mute(self, request: HwAudioMuteRequest) -> HwAck: ...


class AudioService:
    def __init__(self, driver: AudioDriver, bus: EventBus) -> None:
        self.driver = driver
        self._bus = bus
        self._state = HwAudioSnapshot(mic=None, pc=None)

    async def start(self) -> None:
        await self.driver.start(self._on_event)

    async def stop(self) -> None:
        await self.driver.stop()

    def snapshot(self) -> HwAudioSnapshot:
        return self._state.model_copy()

    async def level(self, request: HwAudioLevelRequest) -> HwAck:
        return await guard("audio", self.driver.level(request))

    async def mute(self, request: HwAudioMuteRequest) -> HwAck:
        return await guard("audio", self.driver.mute(request))

    def _on_event(self, event: HwAudioStateEvent) -> None:
        channel = HwAudioChannelState(level=event.data.level, muted=event.data.muted)
        self._state = self._state.model_copy(update={event.data.channel: channel})
        self._bus.publish(event)
