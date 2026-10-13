from app.contracts import ACK_OK, ack_error
from app.events import EventBus, Subscription
from app.modules.lights.driver_fake import FakeLightsDriver, build_fake_router
from app.modules.lights.driver_real import RealLightsDriver
from app.modules.lights.router import build_router
from app.modules.lights.schemas import (
    HwLightsSetRequest,
    HwLightsSnapshot,
    HwLightsStateData,
    HwLightsStateEvent,
)
from app.modules.lights.service import LightsService
from tests.helpers import drain, http_client, make_settings, next_event


async def start_fake() -> tuple[LightsService, FakeLightsDriver, Subscription]:
    bus = EventBus(64)
    sub = bus.subscribe()
    driver = FakeLightsDriver(make_settings())
    service = LightsService(driver, bus)
    await service.start()
    return service, driver, sub


async def test_fake_reports_both_gangs_on_start() -> None:
    service, _, sub = await start_fake()
    assert [e.data for e in drain(sub) if isinstance(e, HwLightsStateEvent)] == [
        HwLightsStateData(gang="front", on=True),
        HwLightsStateData(gang="rear", on=False),
    ]
    assert service.snapshot() == HwLightsSnapshot(front=True, rear=False)


async def test_set_is_acked_and_echoed_as_state() -> None:
    service, _, sub = await start_fake()
    drain(sub)
    assert await service.set(HwLightsSetRequest(gang="rear", on=True)) == ACK_OK
    event = await next_event(sub, HwLightsStateEvent)
    assert event.data == HwLightsStateData(gang="rear", on=True)
    assert service.snapshot() == HwLightsSnapshot(front=True, rear=True)


async def test_by_hand_flips_a_gang_without_a_command() -> None:
    service, driver, sub = await start_fake()
    drain(sub)
    driver.by_hand("front", None)
    assert (await next_event(sub, HwLightsStateEvent)).data == HwLightsStateData(
        gang="front", on=False
    )
    driver.by_hand("front", False)  # explicit value, no flip
    assert (await next_event(sub, HwLightsStateEvent)).data.on is False
    assert service.snapshot().front is False


async def test_real_driver_answers_transport_error_and_reports_nothing() -> None:
    service = LightsService(RealLightsDriver(make_settings()), EventBus(8))
    await service.start()
    ack = await service.set(HwLightsSetRequest(gang="rear", on=True))
    assert ack == ack_error("transport", "lights: hardware intake pending")
    assert service.snapshot() == HwLightsSnapshot(front=None, rear=None)


async def test_routes() -> None:
    service, driver, _ = await start_fake()
    async with http_client(build_router(service), build_fake_router(driver)) as http:
        ok = await http.post("/v1/lights/set", json={"gang": "rear", "on": True})
        assert ok.status_code == 200
        assert ok.json() == {"ok": True}
        assert (await http.post("/v1/lights/set", json={"gang": "middle"})).status_code == 422
        by_hand = await http.post("/v1/_fake/lights/by_hand")  # no body: flip rear
        assert by_hand.json() == {"ok": True}
    assert service.snapshot() == HwLightsSnapshot(front=True, rear=False)
