"""PodiumMcuTransport on the in-memory MCU: replies vs events, timeouts, resets, keepalive,
reconnect (PLAN-H06 D1, T0 observations)."""

import asyncio
import logging
from collections.abc import AsyncIterator, Callable

import pytest

from app.config import Settings
from app.transports.podium_mcu import (
    MAX_UNANSWERED,
    McuError,
    McuOffline,
    McuTimeout,
    PodiumMcuTransport,
)
from tests.fake_podium_mcu import FW, FakePodiumMcu, tap_to_vol, vol_to_tap
from tests.helpers import make_settings


def podium_settings(**overrides: object) -> Settings:
    values: dict[str, object] = {
        "podium_boot_wait_s": 0.05,
        "podium_cmd_timeout_s": 0.2,
        "podium_ping_s": 3600.0,
        "podium_reconnect_min_s": 0.01,
        "podium_reconnect_max_s": 0.05,
        **overrides,
    }
    return make_settings(**values)


async def until(condition: Callable[[], object], within: float = 1.0) -> None:
    async with asyncio.timeout(within):
        while not condition():  # noqa: ASYNC110 - polls state another task changes
            await asyncio.sleep(0.001)


@pytest.fixture
def mcu() -> FakePodiumMcu:
    return FakePodiumMcu()


@pytest.fixture
async def link(mcu: FakePodiumMcu) -> AsyncIterator[PodiumMcuTransport]:
    transport = PodiumMcuTransport(podium_settings(), mcu.opener)
    await transport.start()
    await until(lambda: transport.connected)
    yield transport
    await transport.stop()


def test_fake_rounding_matches_the_firmware_numbers_seen_in_t0() -> None:
    assert [vol_to_tap(v) for v in (0, 12, 13, 50, 62, 75, 100)] == [0, 0, 1, 18, 30, 48, 99]
    assert tap_to_vol(18) != 50  # `vol?` does not return the level that was sent


async def test_data_lines_come_back_before_ok(link: PodiumMcuTransport) -> None:
    assert await link.command("ping") == []
    assert await link.command("ver") == [FW]
    assert await link.command("vol?") == ["a=-1", "b=-1"]


async def test_err_raises_with_the_reason_and_the_data_lines(
    link: PodiumMcuTransport, mcu: FakePodiumMcu
) -> None:
    mcu.switch_stuck = True
    with pytest.raises(McuError) as caught:
        await link.command("src 1")
    assert caught.value.reason == "switch_did_not_confirm"
    assert caught.value.lines == ["src=2"]
    with pytest.raises(McuError, match="unknown_command"):
        await link.command("bogus")


async def test_an_event_between_command_and_reply_goes_to_subscribers(
    link: PodiumMcuTransport, mcu: FakePodiumMcu
) -> None:
    seen: list[str] = []
    link.subscribe("src changed ", seen.append)
    mcu.before_reply = ["evt src changed 2 1", "evt rs232 PWR=ON"]
    assert await link.command("src?") == ["src=2"]
    assert seen == ["src changed 2 1"]


async def test_boot_text_is_not_a_reply_and_the_boot_event_is_delivered(
    mcu: FakePodiumMcu, caplog: pytest.LogCaptureFixture
) -> None:
    caplog.set_level(logging.WARNING, logger="hw")
    transport = PodiumMcuTransport(podium_settings(), mcu.opener)
    seen: list[str] = []
    transport.subscribe("src changed ", seen.append)
    await transport.start()
    await until(lambda: transport.connected and seen)
    assert seen == ["src changed 0 2"]
    assert "unexpected line" not in caplog.text
    assert await transport.command("ping") == []
    await transport.stop()


async def test_nothing_is_sent_before_the_board_is_ready() -> None:
    mcu = FakePodiumMcu(resets_on_open=False)
    transport = PodiumMcuTransport(podium_settings(podium_boot_wait_s=0.2), mcu.opener)
    await transport.start()
    await until(lambda: mcu.opens == 1)
    with pytest.raises(McuOffline):
        await transport.command("ping")
    # No `evt ready` (a board that did not reset): ready after the boot wait anyway.
    await until(lambda: transport.connected)
    assert await transport.command("ping") == []
    await transport.stop()


async def test_a_timeout_frees_the_link_and_the_late_reply_is_skipped(
    link: PodiumMcuTransport, mcu: FakePodiumMcu
) -> None:
    mcu.delay_s["ver"] = 0.3  # longer than the 0.2 s command timeout
    with pytest.raises(McuTimeout):
        await link.command("ver")
    # The late `eduscope-podium-mcu 2.1` / `ok` must not become this command's answer.
    assert await link.command("vol?") == ["a=-1", "b=-1"]
    assert await link.command("ping") == []


async def test_a_longer_timeout_per_command(link: PodiumMcuTransport, mcu: FakePodiumMcu) -> None:
    mcu.delay_s["src"] = 0.3
    assert await link.command("src 1", timeout_s=1.0) == ["src=1"]


async def test_a_reset_fails_the_command_in_flight_and_runs_the_ready_handlers(
    mcu: FakePodiumMcu,
) -> None:
    transport = PodiumMcuTransport(podium_settings(), mcu.opener)
    readies: list[list[str]] = []

    async def on_ready() -> None:
        readies.append(await transport.command("vol?"))

    transport.on_ready(on_ready)
    await transport.start()
    await until(lambda: len(readies) == 1)
    await transport.command("vol a 50")
    mcu.silent.add("vol")  # the board resets before it answers
    command = asyncio.create_task(transport.command("vol a 60"))
    await until(lambda: mcu.received[-1] == "vol a 60")
    mcu.silent.clear()
    mcu.reset()
    with pytest.raises(McuOffline, match="restarted"):
        await command
    await until(lambda: len(readies) == 2)
    assert readies == [["a=-1", "b=-1"], ["a=-1", "b=-1"]]
    assert mcu.opens == 1  # a reset is not a reconnect
    await transport.stop()


async def test_keepalive_pings_while_idle(mcu: FakePodiumMcu) -> None:
    transport = PodiumMcuTransport(podium_settings(podium_ping_s=0.05), mcu.opener)
    await transport.start()
    await until(lambda: mcu.received.count("ping") >= 2)
    await transport.stop()


async def test_unplug_fails_commands_and_reopens(mcu: FakePodiumMcu) -> None:
    transport = PodiumMcuTransport(podium_settings(), mcu.opener)
    ready_count = 0

    async def on_ready() -> None:
        nonlocal ready_count
        ready_count += 1

    transport.on_ready(on_ready)
    await transport.start()
    await until(lambda: transport.connected and ready_count == 1)
    mcu.refuse_opens = 2  # still unplugged for the next two tries
    mcu.unplug()
    await until(lambda: not transport.connected)
    with pytest.raises(McuOffline):
        await transport.command("ping")
    await until(lambda: transport.connected and ready_count == 2)
    assert mcu.opens == 2
    assert mcu.refuse_opens == 0
    assert await transport.command("ping") == []
    await transport.stop()


async def test_unplug_during_a_command_fails_it(
    link: PodiumMcuTransport, mcu: FakePodiumMcu
) -> None:
    mcu.silent.add("ver")
    command = asyncio.create_task(link.command("ver"))
    await until(lambda: "ver" in mcu.received)
    mcu.unplug()
    with pytest.raises(McuOffline, match="lost"):
        await command


async def test_a_board_that_stops_answering_is_reopened(mcu: FakePodiumMcu) -> None:
    transport = PodiumMcuTransport(podium_settings(podium_cmd_timeout_s=0.02), mcu.opener)
    await transport.start()
    await until(lambda: transport.connected)
    mcu.silent.add("ping")
    for _ in range(MAX_UNANSWERED):
        with pytest.raises(McuTimeout):
            await transport.command("ping")
    mcu.silent.clear()
    await until(lambda: mcu.opens == 2 and transport.connected)
    assert await transport.command("ping") == []
    await transport.stop()


async def test_a_stray_line_is_dropped_with_a_warning(
    link: PodiumMcuTransport, mcu: FakePodiumMcu, caplog: pytest.LogCaptureFixture
) -> None:
    caplog.set_level(logging.WARNING, logger="hw")
    mcu.send("src=1")
    await until(lambda: "unexpected line dropped: src=1" in caplog.text)
    assert await link.command("src?") == ["src=2"]


async def test_a_failing_event_handler_does_not_stop_the_others(
    link: PodiumMcuTransport, mcu: FakePodiumMcu
) -> None:
    seen: list[str] = []

    def broken(_text: str) -> None:
        raise ValueError("boom")

    link.subscribe("src changed ", broken)
    link.subscribe("src changed ", seen.append)
    mcu.press_by_hand()
    await until(lambda: seen)
    assert seen == ["src changed 2 1"]
