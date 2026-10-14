import asyncio

from app.contracts import ACK_OK, HwErrorEvent, ack_error
from app.events import EventBus, Subscription
from app.modules.ir.driver_fake import FakeIrDriver, build_fake_router
from app.modules.ir.driver_real import RealIrDriver
from app.modules.ir.router import build_router
from app.modules.ir.schemas import (
    HwIrBlasterData,
    HwIrLearnCancelled,
    HwIrLearnCaptured,
    HwIrLearnEvent,
    HwIrLearnRequest,
    HwIrLearnTimeout,
    HwIrSendRequest,
    HwIrSnapshot,
)
from app.modules.ir.service import IrService
from tests.helpers import http_client, make_settings, next_event

SEND = HwIrSendRequest(transport="ir_zs06", code_format="tuya", code="C/8hRgHrBkYBgAMH")
LEARN = HwIrLearnRequest(transport="ir_zs06", timeout_s=20)


async def start_fake(time_scale: float = 1000.0) -> tuple[IrService, FakeIrDriver, Subscription]:
    bus = EventBus(64)
    sub = bus.subscribe()
    driver = FakeIrDriver(make_settings(fake_time_scale=time_scale))
    service = IrService(driver, bus)
    await service.start()
    return service, driver, sub


async def learn_statuses(sub: Subscription, count: int) -> list[str]:
    return [(await next_event(sub, HwIrLearnEvent)).data.status for _ in range(count)]


async def test_fake_blaster_starts_online() -> None:
    service, _, _ = await start_fake()
    assert service.snapshot() == HwIrSnapshot(blaster=HwIrBlasterData(online=True, lqi=196))


async def test_send_passes_the_code_to_listeners() -> None:
    service, driver, _ = await start_fake()
    seen: list[str] = []
    driver.add_listener(seen.append)
    assert await service.send(SEND) == ACK_OK
    assert seen == ["C/8hRgHrBkYBgAMH"]


async def test_offline_blaster_refuses_to_send() -> None:
    service, driver, _ = await start_fake()
    driver.set_online(False)
    assert await service.send(SEND) == ack_error("device_offline", "r101_ir is offline")
    assert service.snapshot() == HwIrSnapshot(blaster=HwIrBlasterData(online=False, lqi=None))


async def test_learn_captures_a_seeded_code() -> None:
    service, _, sub = await start_fake()
    result = await service.learn(LEARN)
    assert isinstance(result, HwIrLearnCaptured)
    assert result.code_format == "tuya"
    assert result.code != ""
    assert await learn_statuses(sub, 2) == ["listening", "captured"]
    again, _, _ = await start_fake()  # same HW_FAKE_SEED → same first code
    assert await again.learn(LEARN) == result


async def test_learn_times_out_when_shorter_than_a_capture() -> None:
    service, _, sub = await start_fake()
    result = await service.learn(HwIrLearnRequest(transport="ir_zs06", timeout_s=2))
    assert result == HwIrLearnTimeout(status="timeout")
    assert await learn_statuses(sub, 2) == ["listening", "timeout"]


async def test_learn_times_out_while_the_blaster_is_offline() -> None:
    service, driver, _ = await start_fake()
    driver.set_online(False)
    assert await service.learn(LEARN) == HwIrLearnTimeout(status="timeout")


async def test_nothing_received_times_out_until_switched_off() -> None:
    service, driver, sub = await start_fake()
    driver.set_nothing_received(True)
    assert await service.learn(LEARN) == HwIrLearnTimeout(status="timeout")
    assert await learn_statuses(sub, 2) == ["listening", "timeout"]
    driver.set_nothing_received(False)
    assert isinstance(await service.learn(LEARN), HwIrLearnCaptured)


async def test_cancel_ends_a_learn_in_progress() -> None:
    service, _, sub = await start_fake(time_scale=1.0)  # capture would take 3 real seconds
    learning = asyncio.create_task(service.learn(LEARN))
    assert await learn_statuses(sub, 1) == ["listening"]
    assert await service.cancel_learn() == ACK_OK
    assert await asyncio.wait_for(learning, 1) == HwIrLearnCancelled(status="cancelled")
    assert await learn_statuses(sub, 1) == ["cancelled"]


async def test_real_driver_errors_become_transport_and_timeout() -> None:
    bus = EventBus(8)
    sub = bus.subscribe()
    service = IrService(RealIrDriver(make_settings()), bus)
    await service.start()
    assert await service.send(SEND) == ack_error("transport", "ir: hardware intake pending")
    assert await service.learn(LEARN) == HwIrLearnTimeout(status="timeout")
    error = await next_event(sub, HwErrorEvent)
    assert error.data.module == "ir"
    assert error.data.code == "transport"
    assert service.snapshot() == HwIrSnapshot(blaster=None)


async def test_routes() -> None:
    service, driver, _ = await start_fake()
    async with http_client(build_router(service), build_fake_router(driver)) as http:
        send = await http.post("/v1/ir/send", json=SEND.model_dump())
        assert send.json() == {"ok": True}
        learn = await http.post("/v1/ir/learn", json={"transport": "ir_zs06", "timeout_s": 20})
        assert learn.json()["status"] == "captured"
        assert (await http.post("/v1/ir/learn/cancel")).json() == {"ok": True}
        bad = await http.post("/v1/ir/learn", json={"transport": "ir_zs06", "timeout_s": 61})
        assert bad.status_code == 422
        assert (await http.post("/v1/_fake/ir/nothing_received")).json() == {"ok": True}
        nothing = await http.post("/v1/ir/learn", json={"transport": "ir_zs06", "timeout_s": 20})
        assert nothing.json() == {"status": "timeout"}
        off = await http.post("/v1/_fake/ir/nothing_received", json={"on": False})
        assert off.json() == {"ok": True}
        again = await http.post("/v1/ir/learn", json={"transport": "ir_zs06", "timeout_s": 20})
        assert again.json()["status"] == "captured"
        assert (await http.post("/v1/_fake/ir/blaster_offline")).json() == {"ok": True}
    assert service.snapshot().blaster == HwIrBlasterData(online=False, lqi=None)
