"""RealSensorsDriver (SNZB-02P, SNZB-03P, SNZB-04PR2 via zigbee2mqtt) against an in-memory MQTT
link. Payloads are copied from the captures in docs/milestones/H03-zigbee-climate-sensor.md and
H04-zigbee-motion-door.md (R-101 Pi, zigbee2mqtt 2.14.2)."""

import asyncio
import logging

import pytest

from app.events import EventBus, Subscription
from app.modules.sensors.driver_real import (
    RealSensorsDriver,
    climate_readings,
    door_readings,
    humidity_pct,
    motion_readings,
)
from app.modules.sensors.schemas import (
    HwContactReading,
    HwHumidityReading,
    HwOccupancyReading,
    HwSensorsReadingEvent,
    HwTemperatureReading,
)
from app.modules.sensors.service import SensorsService
from tests.fake_mqtt import FakeMqtt
from tests.helpers import drain, make_settings

CLIMATE = "zigbee2mqtt/r101_temp"
MOTION = "zigbee2mqtt/r101_motion"
DOOR = "zigbee2mqtt/r101_door"
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


def motion(occupancy: bool) -> dict[str, object]:
    """One `zigbee2mqtt/r101_motion` message as captured (H04)."""
    return {
        "battery": 100,
        "linkquality": 182,
        "motion_timeout": 60,
        "occupancy": occupancy,
        "update": {
            "installed_version": 8705,
            "latest_release_notes": None,
            "latest_source": None,
            "latest_version": 8705,
            "state": "idle",
        },
        "voltage": 3100,
    }


def door(contact: bool, tamper: bool = False) -> dict[str, object]:
    """One `zigbee2mqtt/r101_door` message as captured (H04)."""
    return {
        "battery": 100,
        "battery_low": False,
        "contact": contact,
        "linkquality": 189,
        "tamper": tamper,
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


async def test_subscribes_to_the_three_sensor_nodes() -> None:
    service, mqtt, _ = await start()
    assert list(mqtt.handlers) == [CLIMATE, MOTION, DOOR]
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


async def test_motion_reports_give_detected_then_clear() -> None:
    service, mqtt, sub = await start()
    mqtt.deliver(MOTION, motion(occupancy=True))
    mqtt.deliver(MOTION, motion(occupancy=False))
    assert readings(sub) == [
        ("r101_motion", "occupancy", "detected"),
        ("r101_motion", "occupancy", "clear"),
    ]
    await service.stop()


async def test_door_reports_give_closed_then_open() -> None:
    service, mqtt, sub = await start()
    mqtt.deliver(DOOR, door(contact=True))
    mqtt.deliver(DOOR, door(contact=False))
    assert readings(sub) == [("r101_door", "contact", "closed"), ("r101_door", "contact", "open")]
    await service.stop()


async def test_a_tamper_only_report_repeats_the_door_state() -> None:
    service, mqtt, sub = await start()
    mqtt.deliver(DOOR, door(contact=False, tamper=True))
    mqtt.deliver(DOOR, door(contact=False, tamper=False))
    assert readings(sub) == [("r101_door", "contact", "open"), ("r101_door", "contact", "open")]
    await service.stop()


def test_a_missing_or_non_bool_event_value_gives_nothing() -> None:
    assert motion_readings("r101_motion", {"occupancy": True}) == [
        HwOccupancyReading(node="r101_motion", kind="occupancy", value="detected")
    ]
    assert door_readings("r101_door", {"contact": True}) == [
        HwContactReading(node="r101_door", kind="contact", value="closed")
    ]
    assert motion_readings("r101_motion", {"battery": 100, "motion_timeout": 60}) == []
    assert motion_readings("r101_motion", {"occupancy": 1}) == []
    assert door_readings("r101_door", {"contact": "true"}) == []
    assert door_readings("r101_door", {"contact": None, "tamper": True}) == []


async def test_reports_are_routed_by_topic() -> None:
    service, mqtt, sub = await start()
    mqtt.deliver(MOTION, {"contact": True, "temperature": 21})
    mqtt.deliver(DOOR, {"occupancy": True, "humidity": 50})
    mqtt.deliver(CLIMATE, {"occupancy": True, "contact": False})
    mqtt.deliver("zigbee2mqtt/r101_ir", door(contact=True))
    assert readings(sub) == []
    await service.stop()


@pytest.mark.parametrize("topic", [CLIMATE, MOTION, DOOR])
@pytest.mark.parametrize("payload", ["online", None, [28.9, 64.6], 42])
async def test_non_object_reports_are_logged_and_dropped(
    topic: str, payload: object, caplog: pytest.LogCaptureFixture
) -> None:
    service, mqtt, sub = await start()
    caplog.set_level(logging.WARNING, logger="hw")
    mqtt.deliver(topic, payload)
    assert readings(sub) == []
    assert f"ignored a non-object report on {topic}" in caplog.text
    await service.stop()


async def test_snapshot_keeps_the_latest_reading_of_each_kind() -> None:
    service, mqtt, _ = await start()
    mqtt.deliver(CLIMATE, report(64.6, 182))
    mqtt.deliver(CLIMATE, report(73, 98))
    mqtt.deliver(MOTION, motion(occupancy=True))
    mqtt.deliver(DOOR, door(contact=True))
    mqtt.deliver(DOOR, door(contact=False))
    assert [(s.reading.kind, s.reading.value) for s in service.snapshot()] == [
        ("temperature", 28.9),
        ("humidity", 73),
        ("occupancy", "detected"),
        ("contact", "open"),
    ]
    await service.stop()


async def test_reports_after_a_broker_reconnect_still_arrive() -> None:
    service, mqtt, sub = await start()
    mqtt.set_connected(False)
    mqtt.set_connected(True)
    mqtt.deliver(CLIMATE, report(63.5, 185))
    mqtt.deliver(MOTION, motion(occupancy=True))
    mqtt.deliver(DOOR, door(contact=True))
    assert readings(sub) == [
        ("r101_temp", "temperature", 28.9),
        ("r101_temp", "humidity", 64),
        ("r101_motion", "occupancy", "detected"),
        ("r101_door", "contact", "closed"),
    ]
    await service.stop()


async def test_no_readings_after_stop() -> None:
    service, mqtt, sub = await start()
    await service.stop()
    mqtt.deliver(CLIMATE, report(64.6, 182))
    mqtt.deliver(MOTION, motion(occupancy=True))
    mqtt.deliver(DOOR, door(contact=True))
    assert readings(sub) == []


class Clock:
    def __init__(self) -> None:
        self.now = 1000.0

    def __call__(self) -> float:
        return self.now


async def start_with_clock(**overrides: object) -> tuple[SensorsService, FakeMqtt, Clock]:
    mqtt = FakeMqtt()
    clock = Clock()
    settings = make_settings(drivers="sensors=real", **overrides)
    service = SensorsService(RealSensorsDriver(settings, mqtt, monotonic=clock), EventBus(64))
    await service.start()
    return service, mqtt, clock


async def settled() -> None:
    for _ in range(5):
        await asyncio.sleep(0)


SET_15 = ("zigbee2mqtt/r101_motion/set", {"motion_timeout": 15})


async def test_another_motion_timeout_is_set_back_once_per_minute() -> None:
    service, mqtt, clock = await start_with_clock()
    mqtt.deliver(MOTION, motion(True))  # captured with motion_timeout 60
    await settled()
    assert mqtt.published == [SET_15]
    clock.now += 59
    mqtt.deliver(MOTION, motion(False))
    await settled()
    assert mqtt.published == [SET_15]
    clock.now += 1
    mqtt.deliver(MOTION, motion(True))
    await settled()
    assert mqtt.published == [SET_15, SET_15]
    await service.stop()


async def test_the_configured_or_a_missing_timeout_publishes_nothing() -> None:
    service, mqtt, _ = await start_with_clock(motion_timeout_s=60)
    mqtt.deliver(MOTION, motion(True))
    mqtt.deliver(MOTION, {"occupancy": True})
    mqtt.deliver(MOTION, {"occupancy": True, "motion_timeout": "15"})
    mqtt.deliver(DOOR, {**door(True), "motion_timeout": 30})
    await settled()
    assert mqtt.published == []
    await service.stop()


async def test_a_failed_set_keeps_the_reading(caplog: pytest.LogCaptureFixture) -> None:
    bus = EventBus(64)
    sub = bus.subscribe()
    mqtt = FakeMqtt()
    mqtt.fail_publish = ConnectionError("broker gone")
    service = SensorsService(RealSensorsDriver(make_settings(drivers="sensors=real"), mqtt), bus)
    await service.start()
    with caplog.at_level(logging.WARNING):
        mqtt.deliver(MOTION, motion(True))
        await settled()
    assert readings(sub) == [("r101_motion", "occupancy", "detected")]
    assert "could not set motion_timeout" in caplog.text
    await service.stop()
