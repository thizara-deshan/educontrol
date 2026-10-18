"""RealAudioDriver on the in-memory podium MCU (D-30, PLAN-H06 D3-D6)."""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from dataclasses import dataclass

import pytest

from app.contracts import ACK_OK, ack_error
from app.events import EventBus, Subscription
from app.modules.audio.driver_real import RealAudioDriver, parse_levels
from app.modules.audio.schemas import (
    HwAudioChannelState,
    HwAudioLevelRequest,
    HwAudioMuteRequest,
    HwAudioStateData,
    HwAudioStateEvent,
)
from app.modules.audio.service import AudioService
from app.transports.podium_mcu import PodiumMcuTransport
from tests.fake_podium_mcu import FakePodiumMcu, podium_settings, tap_to_vol, until, vol_to_tap
from tests.helpers import drain, next_event


@dataclass
class Rig:
    service: AudioService
    mcu: FakePodiumMcu
    link: PodiumMcuTransport
    sub: Subscription

    def sent_since(self, mark: int) -> list[str]:
        return [line for line in self.mcu.received[mark:] if line != "ping"]


@asynccontextmanager
async def make_rig(mcu: FakePodiumMcu, **settings: object) -> AsyncIterator[Rig]:
    config = podium_settings(**settings)
    bus = EventBus(256)
    sub = bus.subscribe()
    link = PodiumMcuTransport(config, mcu.opener)
    service = AudioService(RealAudioDriver(config, link), bus)
    await service.start()
    await link.start()
    try:
        yield Rig(service, mcu, link, sub)
    finally:
        await link.stop()
        await service.stop()


def both_reported(service: AudioService) -> bool:
    snapshot = service.snapshot()
    return snapshot.mic is not None and snapshot.pc is not None


@pytest.fixture
async def rig() -> AsyncIterator[Rig]:
    mcu = FakePodiumMcu()
    async with make_rig(mcu) as value:
        await until(lambda: both_reported(value.service))
        drain(value.sub)
        yield value


def test_parse_levels() -> None:
    assert parse_levels(["a=40", "b=-1"]) == {"a": 40, "b": -1}
    assert parse_levels(["src=2", "a=x", "c=3"]) == {}


async def test_start_sets_the_start_levels_on_unhomed_pots(rig: Rig) -> None:
    assert rig.mcu.received[:3] == ["vol?", "vol b 60", "vol a 40"]
    assert rig.service.snapshot().mic == HwAudioChannelState(level=60, muted=False)
    assert rig.service.snapshot().pc == HwAudioChannelState(level=40, muted=False)
    assert (rig.mcu.tap("b"), rig.mcu.tap("a")) == (vol_to_tap(60), vol_to_tap(40))


async def test_level_reports_the_requested_level_not_the_rounded_one(rig: Rig) -> None:
    mark = len(rig.mcu.received)
    assert await rig.service.level(HwAudioLevelRequest(channel="mic", level=50)) == ACK_OK
    assert rig.sent_since(mark) == ["vol b 50"]
    assert rig.mcu.tap("b") == 18
    assert tap_to_vol(18) != 50  # what `vol?` would say
    event = await next_event(rig.sub, HwAudioStateEvent)
    assert event.data == HwAudioStateData(channel="mic", level=50, muted=False)


async def test_mute_moves_the_wiper_to_0_and_unmute_restores_the_level(rig: Rig) -> None:
    mark = len(rig.mcu.received)
    assert await rig.service.mute(HwAudioMuteRequest(channel="pc", muted=True)) == ACK_OK
    assert rig.mcu.tap("a") == 0
    event = await next_event(rig.sub, HwAudioStateEvent)
    assert event.data == HwAudioStateData(channel="pc", level=40, muted=True)
    assert await rig.service.mute(HwAudioMuteRequest(channel="pc", muted=False)) == ACK_OK
    assert rig.mcu.tap("a") == vol_to_tap(40)
    event = await next_event(rig.sub, HwAudioStateEvent)
    assert event.data == HwAudioStateData(channel="pc", level=40, muted=False)
    assert rig.sent_since(mark) == ["vol a 0", "vol a 40"]


async def test_a_level_while_muted_moves_nothing_until_unmute(rig: Rig) -> None:
    await rig.service.mute(HwAudioMuteRequest(channel="pc", muted=True))
    mark = len(rig.mcu.received)
    assert await rig.service.level(HwAudioLevelRequest(channel="pc", level=55)) == ACK_OK
    assert rig.sent_since(mark) == []
    assert rig.service.snapshot().pc == HwAudioChannelState(level=55, muted=True)
    await rig.service.mute(HwAudioMuteRequest(channel="pc", muted=False))
    assert rig.sent_since(mark) == ["vol a 55"]
    assert rig.service.snapshot().pc == HwAudioChannelState(level=55, muted=False)


async def test_repeating_a_mute_sends_nothing_but_still_reports(rig: Rig) -> None:
    await rig.service.mute(HwAudioMuteRequest(channel="mic", muted=True))
    drain(rig.sub)
    mark = len(rig.mcu.received)
    assert await rig.service.mute(HwAudioMuteRequest(channel="mic", muted=True)) == ACK_OK
    assert rig.sent_since(mark) == []
    event = await next_event(rig.sub, HwAudioStateEvent)
    assert event.data == HwAudioStateData(channel="mic", level=60, muted=True)


async def test_an_mcu_reset_sets_the_start_levels_again_and_keeps_mute(rig: Rig) -> None:
    await rig.service.level(HwAudioLevelRequest(channel="mic", level=80))
    await rig.service.level(HwAudioLevelRequest(channel="pc", level=70))
    await rig.service.mute(HwAudioMuteRequest(channel="pc", muted=True))
    mark = len(rig.mcu.received)
    rig.mcu.reset()
    await until(lambda: len(rig.sent_since(mark)) == 3)
    assert rig.sent_since(mark) == ["vol?", "vol b 60", "vol a 0"]
    assert rig.service.snapshot().mic == HwAudioChannelState(level=60, muted=False)
    assert rig.service.snapshot().pc == HwAudioChannelState(level=40, muted=True)
    assert rig.mcu.tap("a") == 0
    await rig.service.mute(HwAudioMuteRequest(channel="pc", muted=False))
    assert rig.mcu.tap("a") == vol_to_tap(40)


async def test_pots_the_mcu_has_already_homed_are_reported_as_they_are() -> None:
    mcu = FakePodiumMcu(resets_on_open=False)  # e.g. a reconnect without a board reset
    mcu.taps = {"a": 18, "b": 30}
    async with make_rig(mcu) as rig:
        await until(lambda: both_reported(rig.service))
        assert mcu.received == ["vol?"]
        assert rig.service.snapshot().mic == HwAudioChannelState(level=tap_to_vol(30), muted=False)
        assert rig.service.snapshot().pc == HwAudioChannelState(level=tap_to_vol(18), muted=False)


async def test_the_channel_mapping_follows_config() -> None:
    mcu = FakePodiumMcu()
    async with make_rig(mcu, podium_mic_ch="a", podium_pc_ch="b") as rig:
        await until(lambda: both_reported(rig.service))
        mark = len(mcu.received)
        await rig.service.level(HwAudioLevelRequest(channel="mic", level=20))
        assert rig.sent_since(mark) == ["vol a 20"]


async def test_mcu_errors_become_acks(rig: Rig) -> None:
    rig.mcu.errors["vol"] = "not_homed"
    ack = await rig.service.level(HwAudioLevelRequest(channel="mic", level=10))
    assert ack == ack_error("transport", "podium MCU refused mic level: not_homed")
    ack = await rig.service.mute(HwAudioMuteRequest(channel="mic", muted=True))
    assert ack == ack_error("transport", "podium MCU refused mic level: not_homed")
    assert rig.service.snapshot().mic == HwAudioChannelState(level=60, muted=False)
    assert drain(rig.sub) == []
    rig.mcu.errors.clear()
    rig.mcu.silent.add("vol")
    ack = await rig.service.level(HwAudioLevelRequest(channel="mic", level=10))
    assert ack == ack_error("timeout", "podium MCU did not answer 'vol'")


async def test_no_mcu_answers_device_offline() -> None:
    mcu = FakePodiumMcu()
    mcu.refuse_opens = 1000
    async with make_rig(mcu) as rig:
        ack = await rig.service.level(HwAudioLevelRequest(channel="pc", level=50))
        assert ack == ack_error("device_offline", "podium MCU not connected")
        assert rig.service.snapshot().pc is None


async def test_volsave_is_never_sent(rig: Rig) -> None:
    for level in (10, 90, 0, 100):
        await rig.service.level(HwAudioLevelRequest(channel="pc", level=level))
    await rig.service.mute(HwAudioMuteRequest(channel="pc", muted=True))
    await rig.service.mute(HwAudioMuteRequest(channel="pc", muted=False))
    assert not [line for line in rig.mcu.received if line.startswith(("volsave", "tap"))]
