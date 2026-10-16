"""RealSensorsDriver (SNZB-02P via zigbee2mqtt) against an in-memory MQTT link. Payloads are copied
from the capture in docs/milestones/H03-zigbee-climate-sensor.md (R-101 Pi, zigbee2mqtt 2.14.2)."""

import logging

import pytest

from app.events import EventBus, Subscription
from app.modules.sensors.driver_real import RealSensorsDriver, climate_readings, humidity_pct
from app.modules.sensors.schemas import (
    HwHumidityReading,
    HwSensorsReadingEvent,
    HwTemperatureReading,
)
from app.modules.sensors.service import SensorsService
from tests.fake_mqtt import FakeMqtt
from tests.helpers import drain, make_settings

CLIMATE = "zigbee2mqtt/r101_temp"
UPDATE = {
    "installed_version": 8704,
    "latest_release_notes": None,
    "latest_source": "https://raw.githubusercontent.com/Koenkk/zigbee-OTA/master/images/Sonoff/snzb-02p_v2.2.0.ota",
    "latest_version": 8704,
    "state": "idle",
}


def report(humidity: float, linkquality: int, temperature: float = 28.9) -> dict[str, object]:
    """One `zigbee2mqtt/r101_temp` message as captured (only humidity/lqi/temperature vary)."""
    return {
        "battery": 100,
        "humidity": humidity,
        "humidity_calibration": 0,
        "linkquality": linkquality,
        "temperature": temperature,
        "temperature_calibration": 0,
        "update": UPDATE,
    }


async def start() -> tuple[SensorsService, FakeMqtt, Subscription]:
    bus = EventBus(64)
    sub = bus.subscribe()
    mqtt = FakeMqtt()
    service = SensorsService(RealSensorsDriver(make_settings(drivers="sensors=real"), mqtt), bus)
    await service.start()
    return service, mqtt, sub


def readings(sub: Subscription) -> list[tuple[str, str, object]]:
    return [
        (e.data.node, e.data.kind, e.data.value)
        for e in drain(sub)
        if isinstance(e, HwSensorsReadingEvent)
    ]


async def test_subscribes_to_the_climate_node_only() -> None:
    service, mqtt, _ = await start()
    assert list(mqtt.handlers) == [CLIMATE]
    assert service.snapshot() == []
    await service.stop()


async def test_one_report_gives_temperature_then_humidity() -> None:
    service, mqtt, sub = await start()
    mqtt.deliver(CLIMATE, report(64.6, 182))
    assert readings(sub) == [
        ("r101_temp", "temperature", 28.9),
        ("r101_temp", "humidity", 65),
    ]
    await service.stop()


@pytest.mark.parametrize(
    ("raw", "pct"),
    [(64.6, 65), (63.5, 64), (73, 73), (67.4, 67), (80.2, 80), (0.4, 0), (-0.6, 0), (100.6, 100)],
)
def test_humidity_is_rounded_half_up_and_clamped(raw: float, pct: int) -> None:
    assert humidity_pct(raw) == pct


def test_temperature_keeps_one_decimal() -> None:
    assert climate_readings("r101_temp", {"temperature": 28.94}) == [
        HwTemperatureReading(node="r101_temp", kind="temperature", value=28.9)
    ]
    assert climate_readings("r101_temp", {"temperature": 21}) == [
        HwTemperatureReading(node="r101_temp", kind="temperature", value=21.0)
    ]


def test_a_missing_or_bad_value_drops_only_that_kind() -> None:
    assert climate_readings("r101_temp", {"temperature": 28.9, "battery": 100}) == [
        HwTemperatureReading(node="r101_temp", kind="temperature", value=28.9)
    ]
    assert climate_readings("r101_temp", {"temperature": "28.9", "humidity": 61}) == [
        HwHumidityReading(node="r101_temp", kind="humidity", value=61)
    ]
    assert climate_readings("r101_temp", {"temperature": True, "humidity": float("nan")}) == []
    assert climate_readings("r101_temp", {"battery": 100, "linkquality": 182}) == []


@pytest.mark.parametrize("payload", ["online", None, [28.9, 64.6], 42])
async def test_non_object_reports_are_logged_and_dropped(
    payload: object, caplog: pytest.LogCaptureFixture
) -> None:
    service, mqtt, sub = await start()
    caplog.set_level(logging.WARNING, logger="hw")
    mqtt.deliver(CLIMATE, payload)
    assert readings(sub) == []
    assert "ignored a non-object report on zigbee2mqtt/r101_temp" in caplog.text
    await service.stop()


async def test_snapshot_keeps_the_latest_climate_reading() -> None:
    service, mqtt, _ = await start()
    mqtt.deliver(CLIMATE, report(64.6, 182))
    mqtt.deliver(CLIMATE, report(73, 98))
    assert [(s.reading.kind, s.reading.value) for s in service.snapshot()] == [
        ("temperature", 28.9),
        ("humidity", 73),
    ]
    await service.stop()


async def test_reports_after_a_broker_reconnect_still_arrive() -> None:
    service, mqtt, sub = await start()
    mqtt.set_connected(False)
    mqtt.set_connected(True)
    mqtt.deliver(CLIMATE, report(63.5, 185))
    assert readings(sub) == [
        ("r101_temp", "temperature", 28.9),
        ("r101_temp", "humidity", 64),
    ]
    await service.stop()


async def test_no_readings_after_stop() -> None:
    service, mqtt, sub = await start()
    await service.stop()
    mqtt.deliver(CLIMATE, report(64.6, 182))
    assert readings(sub) == []
