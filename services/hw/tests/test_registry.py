import pytest
from fastapi.routing import APIRoute

from app.events import EventBus
from app.modules.ir.schemas import HwIrBlasterData, HwIrSendRequest
from app.modules.projector_power.schemas import HwProjectorPowerReadingEvent
from app.registry import MODULES, build_registry, driver_kinds, parse_driver_overrides
from tests.helpers import drain, make_settings, next_event

ON_SEND = HwIrSendRequest(transport="ir_zs06", code_format="tuya", code="C/8hRgHrBkYBgAMH")


def test_modules_match_the_contract() -> None:
    assert MODULES == (
        "lights",
        "projector_power",
        "ir",
        "hdmi",
        "projection_screen",
        "audio",
        "sensors",
        "zigbee_status",
    )


def test_parse_driver_overrides() -> None:
    assert parse_driver_overrides("") == {}
    assert parse_driver_overrides("lights=real, ir=fake ,") == {"lights": "real", "ir": "fake"}


@pytest.mark.parametrize("raw", ["lights", "lights=on", "door=real", "lights=real,=fake"])
def test_parse_driver_overrides_rejects_typos(raw: str) -> None:
    with pytest.raises(ValueError, match="HW_DRIVERS"):
        parse_driver_overrides(raw)


def test_driver_kinds_apply_mode_then_overrides() -> None:
    kinds = driver_kinds(make_settings(mode="real", drivers="lights=fake"))
    assert kinds["lights"] == "fake"
    assert [kinds[m] for m in MODULES if m != "lights"] == ["real"] * 7


def fake_paths(mode: str, drivers: str = "") -> list[str]:
    registry = build_registry(make_settings(mode=mode, drivers=drivers), EventBus(8))
    routes = [route for router in registry.routers() for route in router.routes]
    paths = [route.path for route in routes if isinstance(route, APIRoute)]
    return sorted(path for path in paths if path.startswith("/v1/_fake/"))


def test_fake_mode_mounts_simulation_routes() -> None:
    assert fake_paths("fake") == [
        "/v1/_fake/ir/blaster_offline",
        "/v1/_fake/ir/nothing_received",
        "/v1/_fake/lights/by_hand",
        "/v1/_fake/projector_power/meter_offline",
        "/v1/_fake/sensors/value",
        "/v1/_fake/zigbee_status/coordinator_offline",
        "/v1/_fake/zigbee_status/node_offline",
    ]


def test_real_mode_has_no_simulation_routes() -> None:
    assert fake_paths("real") == []
    assert fake_paths("real", "lights=fake") == ["/v1/_fake/lights/by_hand"]


def test_health_reports_each_module_driver() -> None:
    registry = build_registry(make_settings(drivers="lights=real"), EventBus(8))
    health = registry.health()
    assert health.mode == "fake"
    assert health.modules.lights == "real"
    assert health.modules.ir == "fake"


def test_mqtt_runs_only_with_a_real_zigbee_driver() -> None:
    assert build_registry(make_settings(), EventBus(8)).mqtt is None
    non_zigbee = make_settings(drivers="hdmi=real,projection_screen=real,audio=real")
    assert build_registry(non_zigbee, EventBus(8)).mqtt is None
    assert build_registry(make_settings(drivers="ir=real"), EventBus(8)).mqtt is not None
    assert build_registry(make_settings(drivers="sensors=real"), EventBus(8)).mqtt is not None
    assert build_registry(make_settings(mode="real"), EventBus(8)).mqtt is not None


def test_the_podium_mcu_port_opens_only_with_real_audio_or_hdmi() -> None:
    assert build_registry(make_settings(), EventBus(8)).podium is None
    others = make_settings(drivers="ir=real,sensors=real,projection_screen=real")
    assert build_registry(others, EventBus(8)).podium is None
    assert build_registry(make_settings(drivers="audio=real"), EventBus(8)).podium is not None
    assert build_registry(make_settings(drivers="hdmi=real"), EventBus(8)).podium is not None
    assert build_registry(make_settings(mode="real"), EventBus(8)).podium is not None


async def test_real_ir_starts_offline_without_a_broker() -> None:
    registry = build_registry(make_settings(drivers="ir=real"), EventBus(64))
    await registry.start()
    assert registry.health().modules.ir == "real"
    assert registry.snapshot().ir.blaster == HwIrBlasterData(online=False, lqi=None)
    await registry.stop()


async def test_real_sensors_start_empty_without_a_broker() -> None:
    registry = build_registry(make_settings(drivers="sensors=real"), EventBus(64))
    await registry.start()
    assert registry.health().modules.sensors == "real"
    assert registry.snapshot().sensors == []
    assert "/v1/_fake/sensors/value" not in [
        route.path for router in registry.fake_routers for route in router.routes
    ]
    await registry.stop()


async def test_fake_ir_send_drives_the_fake_projector() -> None:
    bus = EventBus(256)
    sub = bus.subscribe()
    registry = build_registry(make_settings(), bus)
    await registry.start()
    drain(sub)
    await registry.ir.send(ON_SEND)
    first = await next_event(sub, HwProjectorPowerReadingEvent)
    assert first.data.watts == 12.0
    await registry.stop()


async def test_real_projector_ignores_fake_ir() -> None:
    bus = EventBus(256)
    registry = build_registry(make_settings(drivers="projector_power=real"), bus)
    await registry.start()
    assert (await registry.ir.send(ON_SEND)).ok is True
    assert registry.snapshot().projector_power.reading is None
    await registry.stop()
