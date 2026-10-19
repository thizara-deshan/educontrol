"""plug module (D-34): the fake driver, the route, and RealPlugDriver against an in-memory MQTT
link. S60ZBTPG payload keys from zigbee-herdsman-converters sonoff.js (zigbee2mqtt 2.14.2)."""

from app.contracts import ACK_OK, ack_error
from app.events import EventBus, Subscription
from app.modules.plug.driver_fake import FakePlugDriver
from app.modules.plug.driver_real import RealPlugDriver
from app.modules.plug.router import build_router
from app.modules.plug.schemas import HwPlugSetRequest, HwPlugStateData, HwPlugStateEvent
from app.modules.plug.service import PlugService
from tests.fake_mqtt import FakeMqtt
from tests.helpers import drain, http_client, make_settings

STATE = "zigbee2mqtt/r101_plug"
AVAILABILITY = "zigbee2mqtt/r101_plug/availability"
# `zigbee2mqtt/r101_plug` as captured on the R-101 Pi 2026-10-19, right after pairing (relay off).
# REPORT below is the same message with a running load.
CAPTURED = {
    "current": 0,
    "energy": 0,
    "energy_month": 0,
    "energy_today": 0,
    "energy_yesterday": 0,
    "linkquality": 163,
    "network_indicator": True,
    "outlet_control_protect": False,
    "overload_protection": {
        "enable_max_voltage": "DISABLE",
        "enable_min_current": "DISABLE",
        "enable_min_power": "DISABLE",
        "enable_min_voltage": "DISABLE",
        "max_current": 0,
        "max_power": 0,
        "max_voltage": 0,
        "min_current": 0,
        "min_power": 0,
        "min_voltage": 0,
    },
    "power": 0,
    "power_on_behavior": "off",
    "state": "OFF",
    "voltage": 0,
}
REPORT = {
    **CAPTURED,
    "state": "ON",
    "power": 42.5,
    "voltage": 231.2,
    "current": 0.21,
    "energy_today": 0.34,
}


def states(sub: Subscription) -> list[HwPlugStateData]:
    return [e.data for e in drain(sub) if isinstance(e, HwPlugStateEvent)]


async def start_real(connected: bool = True) -> tuple[PlugService, FakeMqtt, Subscription]:
    bus = EventBus(64)
    sub = bus.subscribe()
    mqtt = FakeMqtt(connected=connected)
    service = PlugService(RealPlugDriver(make_settings(drivers="plug=real"), mqtt), bus)
    await service.start()
    return service, mqtt, sub


async def test_fake_reports_on_start_and_echoes_set() -> None:
    bus = EventBus(16)
    sub = bus.subscribe()
    service = PlugService(FakePlugDriver(make_settings()), bus)
    await service.start()
    assert states(sub)[0].on is True
    assert await service.set(HwPlugSetRequest(on=False)) == ACK_OK
    off = states(sub)[0]
    assert (off.on, off.watts) == (False, 0.0)
    assert service.snapshot() == off


async def test_route() -> None:
    service = PlugService(FakePlugDriver(make_settings()), EventBus(8))
    await service.start()
    async with http_client(build_router(service)) as http:
        assert (await http.post("/v1/plug/set", json={"on": False})).json() == {"ok": True}
        assert (await http.post("/v1/plug/set", json={})).status_code == 422


async def test_real_maps_a_report_and_availability() -> None:
    service, mqtt, sub = await start_real()
    assert service.snapshot() is None
    mqtt.deliver(AVAILABILITY, {"state": "online"})
    mqtt.deliver(STATE, REPORT)
    assert service.snapshot() == HwPlugStateData(
        online=True, on=True, watts=42.5, volts=231.2, amps=0.21, kwh_today=0.34
    )
    # A partial or odd report keeps the last good values.
    mqtt.deliver(STATE, {"state": "OFF", "power": "x", "voltage": -1, "current": True})
    snap = service.snapshot()
    assert snap is not None
    assert (snap.on, snap.watts, snap.volts, snap.amps) == (False, 42.5, 231.2, 0.21)
    mqtt.deliver(STATE, "garbage")
    mqtt.deliver(AVAILABILITY, {"state": "offline"})
    assert [s.online for s in states(sub)] == [True, True, True, False]


async def test_real_reads_the_captured_report() -> None:
    service, mqtt, _ = await start_real()
    mqtt.deliver(AVAILABILITY, {"state": "online"})
    mqtt.deliver(STATE, CAPTURED)
    assert service.snapshot() == HwPlugStateData(
        online=True, on=False, watts=0.0, volts=0.0, amps=0.0, kwh_today=0.0
    )


async def test_real_set_publishes_state() -> None:
    service, mqtt, _ = await start_real()
    mqtt.deliver(AVAILABILITY, {"state": "online"})
    assert await service.set(HwPlugSetRequest(on=False)) == ACK_OK
    assert await service.set(HwPlugSetRequest(on=True)) == ACK_OK
    assert mqtt.published == [
        ("zigbee2mqtt/r101_plug/set", {"state": "OFF"}),
        ("zigbee2mqtt/r101_plug/set", {"state": "ON"}),
    ]


async def test_real_refuses_when_offline_or_disconnected() -> None:
    service, mqtt, sub = await start_real()
    assert await service.set(HwPlugSetRequest(on=True)) == ack_error(
        "device_offline", "r101_plug is offline"
    )
    mqtt.deliver(AVAILABILITY, {"state": "online"})
    mqtt.set_connected(False)
    assert await service.set(HwPlugSetRequest(on=True)) == ack_error(
        "transport", "MQTT broker not connected"
    )
    assert states(sub)[-1].online is False
    assert mqtt.published == []
