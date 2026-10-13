from app.events import EventBus, Subscription
from app.modules.sensors.driver_fake import FakeSensorsDriver, build_fake_router
from app.modules.sensors.driver_real import RealSensorsDriver
from app.modules.sensors.router import build_router
from app.modules.sensors.schemas import HwContactReading, HwSensorsReadingEvent
from app.modules.sensors.service import SensorsService
from tests.helpers import drain, http_client, make_settings, next_event


async def start_fake(
    interval_s: float = 3600.0,
) -> tuple[SensorsService, FakeSensorsDriver, Subscription]:
    bus = EventBus(64)
    sub = bus.subscribe()
    driver = FakeSensorsDriver(make_settings(fake_report_interval_s=interval_s))
    service = SensorsService(driver, bus)
    await service.start()
    return service, driver, sub


async def test_fake_reports_every_sensor_on_start() -> None:
    service, _, _ = await start_fake()
    assert [(s.reading.node, s.reading.kind, s.reading.value) for s in service.snapshot()] == [
        ("r101_temp", "temperature", 26.4),
        ("r101_temp", "humidity", 61),
        ("r101_motion", "occupancy", "detected"),
        ("r101_door", "contact", "closed"),
    ]
    await service.stop()


async def test_climate_readings_repeat_with_seeded_drift() -> None:
    service, _, sub = await start_fake(interval_s=0.01)
    drain(sub)
    first = await next_event(sub, HwSensorsReadingEvent)
    second = await next_event(sub, HwSensorsReadingEvent)
    assert (first.data.kind, second.data.kind) == ("temperature", "humidity")
    assert 26.1 <= first.data.value <= 26.7
    assert 59 <= second.data.value <= 63
    await service.stop()
    again, _, sub2 = await start_fake(interval_s=0.01)  # same seed → same first values
    drain(sub2)
    assert (await next_event(sub2, HwSensorsReadingEvent)).data == first.data
    await again.stop()


async def test_snapshot_keeps_the_latest_reading_per_node_and_kind() -> None:
    service, driver, _ = await start_fake()
    driver.report(HwContactReading(node="r101_door", kind="contact", value="open"))
    contacts = [s.reading for s in service.snapshot() if s.reading.kind == "contact"]
    assert contacts == [HwContactReading(node="r101_door", kind="contact", value="open")]
    assert len(service.snapshot()) == 4
    await service.stop()


async def test_real_driver_reports_nothing() -> None:
    service = SensorsService(RealSensorsDriver(make_settings()), EventBus(8))
    await service.start()
    assert service.snapshot() == []


async def test_fake_value_route() -> None:
    service, driver, sub = await start_fake()
    drain(sub)
    async with http_client(build_router(service), build_fake_router(driver)) as http:
        ok = await http.post(
            "/v1/_fake/sensors/value",
            json={"node": "r101_motion", "kind": "occupancy", "value": "clear"},
        )
        assert ok.json() == {"ok": True}
        bad = await http.post(
            "/v1/_fake/sensors/value",
            json={"node": "r101_motion", "kind": "occupancy", "value": "open"},
        )
        assert bad.status_code == 422
    assert (await next_event(sub, HwSensorsReadingEvent)).data.value == "clear"
    await service.stop()
