"""RealHdmiDriver on the in-memory podium MCU (PLAN-H06 D8)."""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from dataclasses import dataclass

import pytest

from app.contracts import ACK_OK, ack_error
from app.events import EventBus, Subscription
from app.modules.hdmi.driver_real import RealHdmiDriver, parse_src
from app.modules.hdmi.schemas import HwHdmiSelectRequest, HwHdmiSnapshot, HwHdmiStateEvent
from app.modules.hdmi.service import HdmiService
from app.transports.podium_mcu import PodiumMcuTransport
from tests.fake_podium_mcu import FakePodiumMcu, podium_settings, until
from tests.helpers import drain, next_event


@dataclass
class Rig:
    service: HdmiService
    mcu: FakePodiumMcu
    link: PodiumMcuTransport
    sub: Subscription


@asynccontextmanager
async def make_rig(mcu: FakePodiumMcu, **settings: object) -> AsyncIterator[Rig]:
    config = podium_settings(**settings)
    bus = EventBus(256)
    sub = bus.subscribe()
    link = PodiumMcuTransport(config, mcu.opener)
    service = HdmiService(RealHdmiDriver(config, link), bus)
    await service.start()
    await link.start()
    yield Rig(service, mcu, link, sub)
    await link.stop()
    await service.stop()


@pytest.fixture
async def rig() -> AsyncIterator[Rig]:
    mcu = FakePodiumMcu(src=2)
    async with make_rig(mcu) as value:
        await until(lambda: value.link.connected and "src?" in mcu.received)
        await until(lambda: value.service.snapshot().input is not None)
        drain(value.sub)
        yield value


def test_parse_src() -> None:
    assert parse_src(["src=2"]) == 2
    assert parse_src(["src=0"]) == 0
    assert parse_src(["led1=0 led2=1916"]) is None
    assert parse_src(["src=x"]) is None


async def test_start_reports_the_switch_input(rig: Rig) -> None:
    assert rig.service.snapshot() == HwHdmiSnapshot(input="smart_board")  # input 2


async def test_select_presses_and_reports_the_confirmed_input(rig: Rig) -> None:
    assert await rig.service.select(HwHdmiSelectRequest(input="podium_pc")) == ACK_OK
    assert rig.mcu.received[-1] == "src 1"
    assert (await next_event(rig.sub, HwHdmiStateEvent)).data.input == "podium_pc"
    assert rig.service.snapshot() == HwHdmiSnapshot(input="podium_pc")


async def test_selecting_the_current_input_still_reports_it(rig: Rig) -> None:
    # core-api confirms only on a report, even when nothing had to change.
    assert await rig.service.select(HwHdmiSelectRequest(input="smart_board")) == ACK_OK
    assert (await next_event(rig.sub, HwHdmiStateEvent)).data.input == "smart_board"


async def test_a_switch_that_does_not_follow_reports_the_real_input(rig: Rig) -> None:
    rig.mcu.switch_stuck = True
    ack = await rig.service.select(HwHdmiSelectRequest(input="podium_pc"))
    assert ack == ack_error(
        "transport", "HDMI switch did not confirm input 1: switch_did_not_confirm"
    )
    assert (await next_event(rig.sub, HwHdmiStateEvent)).data.input == "smart_board"


async def test_leds_that_agree_on_nothing_report_nothing(rig: Rig) -> None:
    rig.mcu.leds_agree = False
    ack = await rig.service.select(HwHdmiSelectRequest(input="podium_pc"))
    assert ack.ok is False
    assert drain(rig.sub) == []
    assert rig.service.snapshot() == HwHdmiSnapshot(input="smart_board")


async def test_a_press_by_hand_is_reported(rig: Rig) -> None:
    rig.mcu.press_by_hand()
    assert (await next_event(rig.sub, HwHdmiStateEvent)).data.input == "podium_pc"
    rig.mcu.press_by_hand()
    assert (await next_event(rig.sub, HwHdmiStateEvent)).data.input == "smart_board"


async def test_a_reconnect_asks_the_switch_again(rig: Rig) -> None:
    rig.mcu.unplug()
    rig.mcu.src = 1  # pressed by hand while the cable was out
    await until(lambda: rig.mcu.opens == 2 and rig.mcu.received.count("src?") == 2)
    await until(lambda: rig.service.snapshot().input == "podium_pc")


async def test_a_silent_switch_times_out() -> None:
    mcu = FakePodiumMcu()
    async with make_rig(mcu, podium_src_timeout_s=0.05) as rig:
        await until(lambda: rig.link.connected)
        mcu.silent.add("src")
        ack = await rig.service.select(HwHdmiSelectRequest(input="podium_pc"))
        assert ack == ack_error("timeout", "podium MCU did not answer 'src'")


async def test_no_mcu_answers_device_offline() -> None:
    mcu = FakePodiumMcu()
    mcu.refuse_opens = 1000
    async with make_rig(mcu) as rig:
        ack = await rig.service.select(HwHdmiSelectRequest(input="podium_pc"))
        assert ack == ack_error("device_offline", "podium MCU not connected")
        assert rig.service.snapshot() == HwHdmiSnapshot(input=None)


async def test_the_podium_pc_can_be_on_input_2() -> None:
    mcu = FakePodiumMcu(src=2)
    async with make_rig(mcu, hdmi_podium_pc_input=2) as rig:
        await until(lambda: rig.service.snapshot().input == "podium_pc")
        assert await rig.service.select(HwHdmiSelectRequest(input="smart_board")) == ACK_OK
        assert mcu.received[-1] == "src 1"
        assert rig.service.snapshot() == HwHdmiSnapshot(input="smart_board")
