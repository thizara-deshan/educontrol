import asyncio

from app.contracts import ACK_OK, ack_error
from app.events import EventBus, Subscription
from app.modules.projection_screen.driver_fake import FakeProjectionScreenDriver
from app.modules.projection_screen.driver_real import RealProjectionScreenDriver
from app.modules.projection_screen.router import build_router
from app.modules.projection_screen.schemas import (
    HwProjectionScreenMoveRequest,
    HwProjectionScreenSnapshot,
    HwProjectionScreenStateEvent,
)
from app.modules.projection_screen.service import ProjectionScreenService
from tests.helpers import drain, http_client, make_settings, next_event


async def start_fake() -> tuple[ProjectionScreenService, Subscription]:
    bus = EventBus(64)
    sub = bus.subscribe()
    service = ProjectionScreenService(FakeProjectionScreenDriver(make_settings()), bus)
    await service.start()
    return service, sub


async def positions(sub: Subscription, count: int) -> list[str]:
    return [
        (await next_event(sub, HwProjectionScreenStateEvent)).data.position for _ in range(count)
    ]


async def test_fake_starts_lowered() -> None:
    service, _ = await start_fake()
    assert service.snapshot() == HwProjectionScreenSnapshot(position="lowered")


async def test_move_reports_moving_then_the_end_position() -> None:
    service, sub = await start_fake()
    drain(sub)
    assert await service.move(HwProjectionScreenMoveRequest(to="raise")) == ACK_OK
    assert await positions(sub, 2) == ["moving", "raised"]
    assert service.snapshot().position == "raised"
    await service.stop()


async def test_a_new_move_replaces_the_one_in_progress() -> None:
    service, sub = await start_fake()
    drain(sub)
    await service.move(HwProjectionScreenMoveRequest(to="raise"))
    await service.move(HwProjectionScreenMoveRequest(to="lower"))
    assert await positions(sub, 3) == ["moving", "moving", "lowered"]
    await asyncio.sleep(0.02)  # the cancelled "raise" never arrives
    assert drain(sub) == []
    await service.stop()


async def test_real_driver_answers_transport_error() -> None:
    service = ProjectionScreenService(RealProjectionScreenDriver(make_settings()), EventBus(8))
    await service.start()
    ack = await service.move(HwProjectionScreenMoveRequest(to="raise"))
    assert ack == ack_error("transport", "projection_screen: hardware intake pending")
    assert service.snapshot() == HwProjectionScreenSnapshot(position="unknown")


async def test_route() -> None:
    service, _ = await start_fake()
    async with http_client(build_router(service)) as http:
        ok = await http.post("/v1/projection_screen/move", json={"to": "lower"})
        assert ok.json() == {"ok": True}
        bad = await http.post("/v1/projection_screen/move", json={"to": "up"})
        assert bad.status_code == 422
    await service.stop()
