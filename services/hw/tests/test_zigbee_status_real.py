"""RealZigbeeStatusDriver (zigbee2mqtt bridge) against an in-memory MQTT link. `bridge/info` and
`bridge/devices` are trimmed captures from the R-101 Pi (tests/fixtures/z2m/, 2026-10-18); event
payloads follow /opt/zigbee2mqtt/dist/extension/bridge.js:163-210 (zigbee2mqtt 2.14.2)."""

import asyncio
import json
from datetime import UTC, datetime
from pathlib import Path

import pytest

from app.contracts import ACK_OK, ack_error
from app.events import EventBus, Subscription
from app.modules.zigbee_status.driver_real import (
    RealZigbeeStatusDriver,
    bridge_info,
    paired_device,
)
from app.modules.zigbee_status.schemas import (
    HwCoordinator,
    HwZigbeeCoordinatorEvent,
    HwZigbeeMeshEvent,
    HwZigbeeNode,
    HwZigbeeNodeEvent,
    HwZigbeeStatusPermitJoinRequest,
)
from app.modules.zigbee_status.service import ZigbeeStatusService
from tests.fake_mqtt import FakeMqtt
from tests.helpers import drain, make_settings

FIXTURES = Path(__file__).parent / "fixtures" / "z2m"
INFO = json.loads((FIXTURES / "bridge_info.json").read_text())
DEVICES = json.loads((FIXTURES / "bridge_devices.json").read_text())
T0 = datetime(2026, 10, 18, 9, 0, tzinfo=UTC)
BASE = "zigbee2mqtt"


class Clock:
    def __init__(self) -> None:
        self.now = T0

    def __call__(self) -> datetime:
        return self.now


async def started(
    connected: bool = True, response_timeout_s: float = 0.05
) -> tuple[ZigbeeStatusService, FakeMqtt, Subscription, Clock]:
    bus = EventBus(256)
    sub = bus.subscribe()
    mqtt = FakeMqtt(connected=connected)
    clock = Clock()
    driver = RealZigbeeStatusDriver(
        make_settings(), mqtt, now=clock, response_timeout_s=response_timeout_s
    )
    service = ZigbeeStatusService(driver, bus)
    await service.start()
    return service, mqtt, sub, clock


def online_bridge(mqtt: FakeMqtt) -> None:
    """The retained messages zigbee2mqtt delivers on subscribe."""
    mqtt.deliver(f"{BASE}/bridge/state", {"state": "online"})
    mqtt.deliver(f"{BASE}/bridge/info", INFO)
    mqtt.deliver(f"{BASE}/bridge/devices", DEVICES)


def node(service: ZigbeeStatusService, name: str) -> HwZigbeeNode:
    return next(n for n in service.snapshot().nodes if n.friendly_name == name)


def test_paired_device_maps_the_captured_list() -> None:
    devices = [d for d in map(paired_device, DEVICES) if d is not None]
    assert [(d.friendly_name, d.model, d.role, d.power_source) for d in devices] == [
        ("r101_ir", "ZS06", "router", "mains"),
        ("r101_temp", "SNZB-02P", "end_device", "battery"),
        ("r101_door", "SNZB-04PR2", "end_device", "battery"),
        ("r101_motion", "SNZB-03P", "end_device", "battery"),
    ]
    without_definition = paired_device({**DEVICES[1], "definition": None})
    assert without_definition is not None
    assert without_definition.model == "TS1201"  # falls back to model_id
    assert paired_device("nope") is None


def test_bridge_info_firmware_channel_and_joining() -> None:
    info = bridge_info(INFO)
    assert info is not None
    assert (info.firmware, info.channel, info.joining_until) == ("ZStack3x0 20250321", 25, None)
    end_ms = int(T0.timestamp() * 1000) + 240_000
    opened = bridge_info({**INFO, "permit_join": True, "permit_join_end": end_ms})
    assert opened is not None
    assert opened.joining_until == datetime(2026, 10, 18, 9, 4, tzinfo=UTC)
    assert bridge_info([]) is None


async def test_bridge_messages_become_coordinator_and_nodes() -> None:
    service, mqtt, sub, _ = await started()
    online_bridge(mqtt)
    snapshot = service.snapshot()
    assert snapshot.coordinator == HwCoordinator(
        model="ZG-808Z",
        chipset="CC2652P1",
        firmware="ZStack3x0 20250321",
        channel=25,
        tx_power_dbm=20,
        port="zigbee-coord",
        antenna="SMA, external",
        status="online",
    )
    assert [n.friendly_name for n in snapshot.nodes] == [
        "r101_ir",
        "r101_temp",
        "r101_door",
        "r101_motion",
    ]
    assert all(not n.online and n.last_seen is None for n in snapshot.nodes)
    assert snapshot.joining_until is None
    kinds = [type(event) for event in drain(sub)]
    assert kinds.count(HwZigbeeCoordinatorEvent) == 1
    assert kinds.count(HwZigbeeNodeEvent) == 4
    # The same retained list again changes nothing.
    mqtt.deliver(f"{BASE}/bridge/devices", DEVICES)
    assert drain(sub) == []


async def test_availability_and_node_reports() -> None:
    service, mqtt, sub, clock = await started()
    online_bridge(mqtt)
    drain(sub)
    mqtt.deliver(f"{BASE}/r101_ir/availability", {"state": "online"})
    assert node(service, "r101_ir").online is True
    clock.now = T0.replace(minute=5)
    mqtt.deliver(f"{BASE}/r101_motion", {"battery": 100, "linkquality": 0, "occupancy": True})
    motion = node(service, "r101_motion")
    assert (motion.last_seen, motion.lqi, motion.battery_pct) == (clock.now, 0, 100)
    mqtt.deliver(f"{BASE}/r101_motion", {"occupancy": False})  # keeps lqi and battery
    assert (node(service, "r101_motion").lqi, node(service, "r101_motion").battery_pct) == (0, 100)
    mqtt.deliver(f"{BASE}/r101_ir", {"linkquality": 120, "battery": 50})
    assert (node(service, "r101_ir").lqi, node(service, "r101_ir").battery_pct) == (120, None)
    mqtt.deliver(f"{BASE}/r101_ir/availability", {"state": "offline"})
    assert node(service, "r101_ir").online is False
    events = [e for e in drain(sub) if isinstance(e, HwZigbeeNodeEvent)]
    # online, motion report, ir report, offline; the repeated motion report changed nothing
    assert len(events) == 4


@pytest.mark.parametrize(
    ("event", "seen"),
    [
        ({"type": "device_joined"}, True),
        ({"type": "device_announce"}, True),
        ({"type": "device_interview", "status": "successful"}, True),
        ({"type": "device_interview", "status": "started"}, False),
    ],
)
async def test_join_events_mark_the_node_seen(event: dict[str, str], seen: bool) -> None:
    service, mqtt, _, clock = await started()
    online_bridge(mqtt)
    clock.now = T0.replace(minute=7)
    status = {"status": event["status"]} if "status" in event else {}
    data = {"friendly_name": "r101_door", "ieee_address": "0xa4c138128a8fffff", **status}
    mqtt.deliver(f"{BASE}/bridge/event", {"type": event["type"], "data": data})
    assert node(service, "r101_door").last_seen == (clock.now if seen else None)
    assert node(service, "r101_door").online is seen


async def test_device_leave_marks_offline() -> None:
    service, mqtt, _, _ = await started()
    online_bridge(mqtt)
    mqtt.deliver(f"{BASE}/r101_temp/availability", {"state": "online"})
    data = {"friendly_name": "r101_temp", "ieee_address": "0xb0e8e8fffe985dcd"}
    mqtt.deliver(f"{BASE}/bridge/event", {"type": "device_leave", "data": data})
    assert node(service, "r101_temp").online is False


async def test_rejoin_after_leave_brings_the_node_back_without_availability() -> None:
    service, mqtt, _, _ = await started()
    online_bridge(mqtt)
    mqtt.deliver(f"{BASE}/r101_motion/availability", {"state": "online"})
    data = {"friendly_name": "r101_motion", "ieee_address": "0x18690afffe1ca686"}
    mqtt.deliver(f"{BASE}/bridge/event", {"type": "device_leave", "data": data})
    assert node(service, "r101_motion").online is False
    mqtt.deliver(f"{BASE}/bridge/event", {"type": "device_announce", "data": data})
    assert node(service, "r101_motion").online is True


async def test_a_message_from_the_node_means_online() -> None:
    service, mqtt, _, _ = await started()
    online_bridge(mqtt)
    data = {"friendly_name": "r101_motion", "ieee_address": "0x18690afffe1ca686"}
    mqtt.deliver(f"{BASE}/bridge/event", {"type": "device_leave", "data": data})
    mqtt.deliver(f"{BASE}/r101_motion", {"occupancy": True})
    assert node(service, "r101_motion").online is True


async def test_permit_join_end_drives_the_mesh() -> None:
    service, mqtt, sub, _ = await started()
    online_bridge(mqtt)
    drain(sub)
    end_ms = int(T0.timestamp() * 1000) + 240_000
    mqtt.deliver(f"{BASE}/bridge/info", {**INFO, "permit_join": True, "permit_join_end": end_ms})
    assert service.snapshot().joining_until == datetime(2026, 10, 18, 9, 4, tzinfo=UTC)
    mqtt.deliver(f"{BASE}/bridge/info", INFO)
    assert service.snapshot().joining_until is None
    meshes = [e for e in drain(sub) if isinstance(e, HwZigbeeMeshEvent)]
    assert len(meshes) == 2


async def answer(mqtt: FakeMqtt, status: str, **extra: object) -> None:
    """Waits for the permit_join request, then answers it like zigbee2mqtt."""
    for _ in range(100):
        if mqtt.published:
            break
        await asyncio.sleep(0)
    topic, payload = mqtt.published[-1]
    assert topic == f"{BASE}/bridge/request/permit_join"
    response = {"data": {"time": payload["time"]}, "status": status, **extra}
    mqtt.deliver(f"{BASE}/bridge/response/permit_join", {**response, "transaction": "other"})
    mqtt.deliver(
        f"{BASE}/bridge/response/permit_join",
        {**response, "transaction": payload["transaction"]},
    )


async def test_permit_join_publishes_and_waits_for_ok() -> None:
    service, mqtt, _, _ = await started()
    online_bridge(mqtt)
    request = HwZigbeeStatusPermitJoinRequest(seconds=240)
    ack, _ = await asyncio.gather(service.permit_join(request), answer(mqtt, "ok"))
    assert ack == ACK_OK
    assert mqtt.published == [
        (f"{BASE}/bridge/request/permit_join", {"time": 240, "transaction": "hw-1"})
    ]


async def test_permit_join_error_timeout_and_offline() -> None:
    service, mqtt, _, _ = await started()
    request = HwZigbeeStatusPermitJoinRequest(seconds=240)
    assert await service.permit_join(request) == ack_error(
        "device_offline", "Zigbee coordinator is offline"
    )
    online_bridge(mqtt)
    ack, _ = await asyncio.gather(service.permit_join(request), answer(mqtt, "error", error="busy"))
    assert ack == ack_error("device_offline", "zigbee2mqtt refused permit_join: busy")
    assert await service.permit_join(request) == ack_error(
        "timeout", "zigbee2mqtt did not answer permit_join"
    )
    mqtt.set_connected(False)
    assert await service.permit_join(request) == ack_error("transport", "MQTT broker not connected")


async def test_disconnect_marks_bridge_and_nodes_offline() -> None:
    service, mqtt, _, _ = await started()
    online_bridge(mqtt)
    mqtt.deliver(f"{BASE}/r101_temp/availability", {"state": "online"})
    mqtt.set_connected(False)
    snapshot = service.snapshot()
    assert snapshot.coordinator is not None
    assert snapshot.coordinator.status == "offline"
    assert not any(n.online for n in snapshot.nodes)
