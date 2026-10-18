from datetime import timedelta

from app.config import ZigbeeNodeConfig
from app.contracts import ACK_OK, ack_error, utc_now
from app.events import EventBus, Subscription
from app.modules.zigbee_status.driver_fake import FakeZigbeeStatusDriver, build_fake_router
from app.modules.zigbee_status.router import build_router
from app.modules.zigbee_status.schemas import (
    HwZigbeeMeshEvent,
    HwZigbeeNodeEvent,
    HwZigbeeStatusPermitJoinRequest,
)
from app.modules.zigbee_status.service import ZigbeeStatusService
from tests.helpers import drain, http_client, make_settings, next_event


async def start_fake(
    **overrides: object,
) -> tuple[ZigbeeStatusService, FakeZigbeeStatusDriver, Subscription]:
    bus = EventBus(64)
    sub = bus.subscribe()
    driver = FakeZigbeeStatusDriver(make_settings(**overrides))
    service = ZigbeeStatusService(driver, bus)
    await service.start()
    return service, driver, sub


async def test_fake_reports_coordinator_and_configured_nodes() -> None:
    service, _, _ = await start_fake()
    snapshot = service.snapshot()
    assert snapshot.coordinator is not None
    assert snapshot.coordinator.status == "online"
    assert snapshot.coordinator.channel == 25
    assert [n.friendly_name for n in snapshot.nodes] == [
        "r101_lights",
        "r101_proj_plug",
        "r101_temp",
        "r101_motion",
        "r101_door",
    ]
    assert all(n.online and n.last_seen is not None for n in snapshot.nodes)
    assert snapshot.joining_until is None


async def test_nodes_come_from_config() -> None:
    node = ZigbeeNodeConfig(
        ieee="0x01",
        friendly_name="r102_lights",
        model="ZBM5-2C-86W",
        role="router",
        power_source="mains",
        lqi=200,
        battery_pct=None,
    )
    service, _, _ = await start_fake(zigbee_nodes=[node])
    assert [n.friendly_name for n in service.snapshot().nodes] == ["r102_lights"]


async def test_permit_join_opens_then_closes_the_mesh() -> None:
    service, _, sub = await start_fake()
    drain(sub)
    before = utc_now()
    assert await service.permit_join(HwZigbeeStatusPermitJoinRequest(seconds=240)) == ACK_OK
    opened = await next_event(sub, HwZigbeeMeshEvent)
    assert opened.data.joining_until is not None
    assert before < opened.data.joining_until <= before + timedelta(seconds=1)  # 240 s / 1000
    assert service.snapshot().joining_until == opened.data.joining_until
    closed = await next_event(sub, HwZigbeeMeshEvent)
    assert closed.data.joining_until is None
    await service.stop()


async def test_permit_join_zero_closes_immediately() -> None:
    service, _, sub = await start_fake(fake_time_scale=1.0)
    await service.permit_join(HwZigbeeStatusPermitJoinRequest(seconds=240))
    drain(sub)
    await service.permit_join(HwZigbeeStatusPermitJoinRequest(seconds=0))
    assert (await next_event(sub, HwZigbeeMeshEvent)).data.joining_until is None
    await service.stop()


async def test_coordinator_offline_refuses_permit_join() -> None:
    service, driver, _ = await start_fake()
    driver.set_coordinator_online(False)
    snapshot = service.snapshot()
    assert snapshot.coordinator is not None
    assert snapshot.coordinator.status == "offline"
    ack = await service.permit_join(HwZigbeeStatusPermitJoinRequest(seconds=60))
    assert ack == ack_error("device_offline", "Zigbee coordinator is offline")


async def test_node_offline_and_back() -> None:
    service, driver, sub = await start_fake()
    drain(sub)
    assert driver.set_node_online("r101_door", False) == ACK_OK
    offline = await next_event(sub, HwZigbeeNodeEvent)
    assert (offline.data.friendly_name, offline.data.online) == ("r101_door", False)
    assert driver.set_node_online("r101_door", True) == ACK_OK
    assert (await next_event(sub, HwZigbeeNodeEvent)).data.online is True
    assert driver.set_node_online("r101_nope", False) == ack_error(
        "invalid", "Unknown Zigbee node r101_nope"
    )
    assert len(service.snapshot().nodes) == 5


async def test_routes() -> None:
    service, driver, _ = await start_fake()
    async with http_client(build_router(service), build_fake_router(driver)) as http:
        ok = await http.post("/v1/zigbee_status/permit_join", json={"seconds": 240})
        assert ok.json() == {"ok": True}
        bad = await http.post("/v1/zigbee_status/permit_join", json={"seconds": 255})
        assert bad.status_code == 422
        node = await http.post(
            "/v1/_fake/zigbee_status/node_offline", json={"friendly_name": "r101_temp"}
        )
        assert node.json() == {"ok": True}
        unknown = await http.post(
            "/v1/_fake/zigbee_status/node_offline", json={"friendly_name": "r101_nope"}
        )
        assert unknown.json()["error"]["code"] == "invalid"
        coordinator = await http.post("/v1/_fake/zigbee_status/coordinator_offline")
        assert coordinator.json() == {"ok": True}
    snapshot = service.snapshot()
    assert snapshot.coordinator is not None
    assert snapshot.coordinator.status == "offline"
    assert [n.online for n in snapshot.nodes if n.friendly_name == "r101_temp"] == [False]
    await service.stop()
