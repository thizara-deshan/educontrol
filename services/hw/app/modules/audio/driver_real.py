"""Real audio driver: the X9C103S digipot pairs behind the podium MCU (D-30, PLAN-H06 D3-D6).

- `level`: `vol <ch> <level>`; on `ok` reports the **requested** level. The firmware rounds it
  onto a tap (fw:volToTap) and has no read-back, so `vol?` would not return it (D-30).
- `mute` is done here; the firmware has none: mute remembers the level and sends `vol <ch> 0`,
  unmute sends the remembered level. A level while muted only updates the remembered level.
- After every MCU boot / port open (`vol?` gives -1: not homed) each channel is set to
  `HW_AUDIO_START_*`; a muted channel stays muted (wiper at 0) with the start level remembered.
  A channel the MCU has homed reports its `vol?` value.
- Never sends `volsave` (D-30): the X9C EEPROM is rated for 100k writes.
- [ASSUMED] tap 0 is silent (PLAN-H06 AC4).
"""

from dataclasses import dataclass

from app.config import Settings
from app.contracts import ACK_OK, HwAck, HwAckError, HwDriverKind, ack_error, logger
from app.modules.audio.schemas import (
    AudioChannel,
    HwAudioLevelRequest,
    HwAudioMuteRequest,
    HwAudioStateData,
    HwAudioStateEvent,
)
from app.modules.audio.service import AudioEmit
from app.transports.podium_mcu import McuError, McuOffline, McuTimeout, PodiumMcuLink

CHANNELS: tuple[AudioChannel, ...] = ("mic", "pc")


@dataclass
class _Channel:
    level: int | None = None  # the level the user wants (kept while muted)
    muted: bool = False


def parse_levels(lines: list[str]) -> dict[str, int]:
    """`vol?` data lines `a=<n>` / `b=<n>` (fw:handle "vol?"); -1 = not homed."""
    levels: dict[str, int] = {}
    for line in lines:
        name, sep, value = line.partition("=")
        if sep and name in ("a", "b") and value.lstrip("-").isdigit():
            levels[name] = int(value)
    return levels


class RealAudioDriver:
    kind: HwDriverKind = "real"

    def __init__(self, settings: Settings, mcu: PodiumMcuLink) -> None:
        self._settings = settings
        self._mcu = mcu
        self._emit: AudioEmit | None = None
        self._pots: dict[AudioChannel, str] = {
            "mic": settings.podium_mic_ch,
            "pc": settings.podium_pc_ch,
        }
        self._start: dict[AudioChannel, int] = {
            "mic": settings.audio_start_mic,
            "pc": settings.audio_start_pc,
        }
        self._channels: dict[AudioChannel, _Channel] = {ch: _Channel() for ch in CHANNELS}
        mcu.on_ready(self._on_ready)

    async def start(self, emit: AudioEmit) -> None:
        self._emit = emit

    async def stop(self) -> None:
        self._emit = None

    async def level(self, request: HwAudioLevelRequest) -> HwAck:
        state = self._channels[request.channel]
        if state.muted:
            state.level = request.level
            self._report(request.channel)
            return ACK_OK
        refused = await self._vol(request.channel, request.level)
        if refused is not None:
            return refused
        state.level = request.level
        self._report(request.channel)
        return ACK_OK

    async def mute(self, request: HwAudioMuteRequest) -> HwAck:
        state = self._channels[request.channel]
        if request.muted != state.muted:
            wiper = 0 if request.muted else (state.level or 0)
            refused = await self._vol(request.channel, wiper)
            if refused is not None:
                return refused
            state.muted = request.muted
            if state.level is None:
                state.level = 0
        # Reported even when nothing changed: core-api confirms only on a report.
        self._report(request.channel)
        return ACK_OK

    async def _vol(self, channel: AudioChannel, level: int) -> HwAckError | None:
        """`vol <pot> <level>`; None when the MCU answered `ok`, else the ack to return."""
        try:
            await self._mcu.command(f"vol {self._pots[channel]} {level}")
        except McuError as exc:
            return ack_error("transport", f"podium MCU refused {channel} level: {exc}")
        except McuTimeout as exc:
            return ack_error("timeout", str(exc))
        except McuOffline as exc:
            return ack_error("device_offline", str(exc))
        return None

    async def _on_ready(self) -> None:
        try:
            homed = parse_levels(await self._mcu.command("vol?"))
        except (McuError, McuTimeout, McuOffline) as exc:
            logger.warning("audio: vol? after MCU start failed: %s", exc)
            return
        for channel in CHANNELS:
            state = self._channels[channel]
            current = homed.get(self._pots[channel], -1)
            if current >= 0:
                state.level, state.muted = current, False
            else:
                start = self._start[channel]
                refused = await self._vol(channel, 0 if state.muted else start)
                if refused is not None:
                    logger.warning(
                        "audio: start level for %s failed: %s", channel, refused.error.message
                    )
                    continue
                state.level = start
            self._report(channel)

    def _report(self, channel: AudioChannel) -> None:
        state = self._channels[channel]
        if self._emit is not None and state.level is not None:
            data = HwAudioStateData(channel=channel, level=state.level, muted=state.muted)
            self._emit(HwAudioStateEvent(data=data))
