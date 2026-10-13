import asyncio

from app.config import Settings
from app.contracts import ACK_OK, ack_error
from app.events import EventBus, Subscription
from app.modules.projector_power.driver_fake import (
    COOL_DOWN_W,
    STANDBY_W,
    WARM_UP_W,
    FakeProjectorPowerDriver,
    build_fake_router,
)
from app.modules.projector_power.driver_real import RealProjectorPowerDriver
from app.modules.projector_power.router import build_router
from app.modules.projector_power.schemas import (
    HwProjectorPowerReadingEvent,
    HwProjectorPowerRelayEvent,
    HwProjectorPowerRelayRequest,
    HwProjectorPowerSnapshot,
)
from app.modules.projector_power.service import ProjectorPowerService
from tests.helpers import drain, http_client, make_settings, next_event

ON_CODE = "C/8hRgHrBkYBgAMH"
OFF_CODE = "C/8hRgHrBkYBgAMP"


async def start_fake(
    settings: Settings | None = None,
) -> tuple[ProjectorPowerService, FakeProjectorPowerDriver, Subscription]:
    bus = EventBus(64)
    sub = bus.subscribe()
    driver = FakeProjectorPowerDriver(settings or make_settings())
    service = ProjectorPowerService(driver, bus)
    await service.start()
    return service, driver, sub


async def watts(sub: Subscription, count: int) -> list[float]:
    return [(await next_event(sub, HwProjectorPowerReadingEvent)).data.watts for _ in range(count)]


async def test_fake_starts_in_standby_with_mains_on() -> None:
    service, _, _ = await start_fake()
    snapshot = service.snapshot()
    assert snapshot.relay is True
    assert snapshot.reading is not None
    assert snapshot.reading.watts == STANDBY_W
    assert snapshot.reading.volts == 231.0
    assert snapshot.reading.energy_kwh_total == 412.67
    await service.stop()


async def test_power_on_code_ramps_through_warm_up_to_running() -> None:
    service, driver, sub = await start_fake()
    drain(sub)
    driver.ir_received(ON_CODE)
    assert await watts(sub, len(WARM_UP_W)) == list(WARM_UP_W)
    assert WARM_UP_W[:4] == (12.0, 24.0, 36.0, 48.0)  # R1 "warming up": between 5 and 50 W
    assert WARM_UP_W[-1] == 287.0
    await service.stop()


async def test_power_off_code_cools_down_to_standby() -> None:
    service, driver, sub = await start_fake()
    driver.ir_received(ON_CODE)
    await watts(sub, 1 + len(WARM_UP_W))  # start reading + warm-up
    driver.ir_received(OFF_CODE)
    assert await watts(sub, len(COOL_DOWN_W)) == list(COOL_DOWN_W)
    assert service.snapshot().reading is not None
    await service.stop()


async def test_unknown_codes_and_repeats_are_ignored() -> None:
    service, driver, sub = await start_fake()
    drain(sub)
    driver.ir_received("SOME/OTHER/CODE")
    driver.ir_received(OFF_CODE)  # already in standby
    await asyncio.sleep(0.05)
    assert drain(sub) == []
    await service.stop()


async def test_relay_off_cuts_power_and_the_projector_ignores_ir() -> None:
    service, driver, sub = await start_fake()
    drain(sub)
    assert await service.relay(HwProjectorPowerRelayRequest(on=False)) == ACK_OK
    assert (await next_event(sub, HwProjectorPowerRelayEvent)).data.on is False
    assert await watts(sub, 1) == [0.0]
    driver.ir_received(ON_CODE)
    await asyncio.sleep(0.05)
    assert drain(sub) == []
    await service.relay(HwProjectorPowerRelayRequest(on=True))
    assert await watts(sub, 1) == [STANDBY_W]
    assert service.snapshot().relay is True
    await service.stop()


async def test_meter_offline_stops_readings_and_fails_relay() -> None:
    service, driver, sub = await start_fake(make_settings(fake_time_scale=100000.0))
    drain(sub)
    driver.set_meter_online(False)
    driver.ir_received(ON_CODE)
    await asyncio.sleep(0.1)
    assert drain(sub) == []
    ack = await service.relay(HwProjectorPowerRelayRequest(on=False))
    assert ack == ack_error("device_offline", "r101_proj_plug is offline")
    driver.set_meter_online(True)
    assert await watts(sub, 1) == [287.0]  # the ramp kept going while unreported
    await service.stop()


async def test_periodic_readings_accumulate_energy() -> None:
    # 3 W for 0.01 s x 360000 = 1 simulated hour → +0.003 kWh per reading
    settings = make_settings(fake_report_interval_s=0.01, fake_time_scale=360000.0)
    service, _, sub = await start_fake(settings)
    drain(sub)
    reading = await next_event(sub, HwProjectorPowerReadingEvent)
    assert reading.data.energy_kwh_total == 412.673
    await service.stop()


async def test_real_driver_answers_transport_error() -> None:
    service = ProjectorPowerService(RealProjectorPowerDriver(make_settings()), EventBus(8))
    await service.start()
    ack = await service.relay(HwProjectorPowerRelayRequest(on=True))
    assert ack == ack_error("transport", "projector_power: hardware intake pending")
    assert service.snapshot() == HwProjectorPowerSnapshot(relay=None, reading=None)


async def test_routes() -> None:
    service, driver, _ = await start_fake()
    async with http_client(build_router(service), build_fake_router(driver)) as http:
        ok = await http.post("/v1/projector_power/relay", json={"on": False})
        assert ok.json() == {"ok": True}
        assert (await http.post("/v1/projector_power/relay", json={})).status_code == 422
        assert (await http.post("/v1/_fake/projector_power/meter_offline")).json() == {"ok": True}
        offline = await http.post("/v1/projector_power/relay", json={"on": True})
        assert offline.json()["error"]["code"] == "device_offline"
        back = await http.post("/v1/_fake/projector_power/meter_offline", json={"online": True})
        assert back.json() == {"ok": True}
    assert service.snapshot().relay is False
    await service.stop()
