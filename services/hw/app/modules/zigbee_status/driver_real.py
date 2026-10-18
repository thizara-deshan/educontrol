"""Real zigbee_status driver: the zigbee2mqtt bridge (PLAN-H05 D1, D2).

Topics under `<base>` = HW_Z2M_BASE_TOPIC (zigbee2mqtt 2.14.2 on the R-101 Pi, observed
2026-10-18; payloads in tests/fixtures/z2m/, event shapes from
/opt/zigbee2mqtt/dist/extension/bridge.js:163-210):
- `bridge/info` (retained): `coordinator.type` + `meta.revision` → firmware, `network.channel`,
  `permit_join` / `permit_join_end` (ms since the epoch) → mesh `joining_until`.
- `bridge/state` (retained): `{"state": "online"}` → coordinator status.
- `bridge/devices` (retained): the paired devices; the `Coordinator` entry is not a node.
- `bridge/event`: `device_joined`, `device_announce`, `device_interview` (successful) → last
  seen now and online; `device_leave` → offline. zigbee2mqtt does not publish availability again
  after a leave + rejoin (observed 2026-10-18: r101_motion re-paired at 14:17, next availability
  at the 15:16 restart), so the rejoin itself has to bring the node back.
- `<node>` and `<node>/availability` for the configured nodes (HW_IR/TEMP/MOTION/DOOR_NODE):
  any message → last seen now and online (the node was just heard), `linkquality` → lqi,
  `battery` → battery_pct; availability → online. zigbee2mqtt's own `last_seen` is disabled on
  the Pi, so last seen is when hw-service heard the node.
- Permit join: `bridge/request/permit_join {"time": s, "transaction": id}` → `bridge/response/
  permit_join {"status": "ok" | "error", "transaction": id, …}` (zigbee2mqtt echoes `transaction`).
"""

import asyncio
from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Literal

from app.config import Settings
from app.contracts import ACK_OK, HwAck, HwDriverKind, ack_error, utc_now
from app.modules.zigbee_status.schemas import (
    HwCoordinator,
    HwMeshData,
    HwZigbeeCoordinatorEvent,
    HwZigbeeMeshEvent,
    HwZigbeeNode,
    HwZigbeeNodeEvent,
    HwZigbeeStatusPermitJoinRequest,
)
from app.modules.zigbee_status.service import ZigbeeEmit
from app.transports.mqtt import MqttLink

SEEN_EVENTS = ("device_joined", "device_announce")


@dataclass(frozen=True)
class PairedDevice:
    """One `bridge/devices` entry that is a node."""

    ieee: str
    friendly_name: str
    model: str
    role: Literal["router", "end_device"]
    power_source: Literal["mains", "battery"]


@dataclass
class NodeLive:
    """What hw-service heard from one node since it started."""

    online: bool = False
    last_seen: datetime | None = None
    lqi: int | None = None
    battery_pct: int | None = None


@dataclass(frozen=True)
class BridgeInfo:
    firmware: str
    channel: int | None
    joining_until: datetime | None


def is_online(payload: object) -> bool:
    """`{"state": "online"}` (zigbee2mqtt 2.x) or the legacy plain text `online`."""
    if isinstance(payload, dict):
        return payload.get("state") == "online"
    return payload == "online"


def whole(payload: dict[object, object], key: str, low: int, high: int) -> int | None:
    """`payload[key]` as an int in [low, high] when it is a JSON number (bools are not)."""
    value = payload.get(key)
    if isinstance(value, bool) or not isinstance(value, int | float):
        return None
    number = round(value)
    return number if low <= number <= high else None


def text(payload: dict[object, object], key: str) -> str | None:
    value = payload.get(key)
    return value if isinstance(value, str) and value != "" else None


def paired_device(entry: object) -> PairedDevice | None:
    """A `bridge/devices` entry → node fields; the coordinator and malformed entries → None."""
    if not isinstance(entry, dict):
        return None
    kind = entry.get("type")
    ieee = text(entry, "ieee_address")
    name = text(entry, "friendly_name")
    if kind not in ("Router", "EndDevice") or ieee is None or name is None:
        return None
    definition = entry.get("definition")
    model = (text(definition, "model") if isinstance(definition, dict) else None) or text(
        entry, "model_id"
    )
    return PairedDevice(
        ieee=ieee,
        friendly_name=name,
        model=model or "unknown",
        role="router" if kind == "Router" else "end_device",
        power_source="battery" if entry.get("power_source") == "Battery" else "mains",
    )


def bridge_info(payload: object) -> BridgeInfo | None:
    if not isinstance(payload, dict):
        return None
    coordinator = payload.get("coordinator")
    firmware = ""
    if isinstance(coordinator, dict):
        meta = coordinator.get("meta")
        revision = meta.get("revision") if isinstance(meta, dict) else None
        parts = [text(coordinator, "type"), None if revision is None else str(revision)]
        firmware = " ".join(part for part in parts if part)
    network = payload.get("network")
    channel = whole(network, "channel", 11, 26) if isinstance(network, dict) else None
    joining_until: datetime | None = None
    end_ms = payload.get("permit_join_end")
    if (
        payload.get("permit_join") is True
        and isinstance(end_ms, int)
        and not isinstance(end_ms, bool)
    ):
        joining_until = datetime.fromtimestamp(end_ms / 1000, UTC)
    return BridgeInfo(firmware=firmware, channel=channel, joining_until=joining_until)


class RealZigbeeStatusDriver:
    kind: HwDriverKind = "real"

    def __init__(
        self,
        settings: Settings,
        mqtt: MqttLink,
        now: Callable[[], datetime] = utc_now,
        response_timeout_s: float | None = None,
    ) -> None:
        self._settings = settings
        self._mqtt = mqtt
        self._now = now
        self._response_timeout_s = (
            settings.mqtt_publish_timeout_s + 1.0
            if response_timeout_s is None
            else response_timeout_s
        )
        base = settings.z2m_base_topic
        self._base = base
        self._request_topic = f"{base}/bridge/request/permit_join"
        names = [settings.ir_node, settings.temp_node, settings.motion_node, settings.door_node]
        self._watched = list(dict.fromkeys(names))
        self._devices: dict[str, PairedDevice] = {}  # by ieee, bridge order
        self._live: dict[str, NodeLive] = {name: NodeLive() for name in self._watched}
        self._bridge_online = False
        self._info: BridgeInfo | None = None
        self._reported_nodes: dict[str, HwZigbeeNode] = {}
        self._reported_coordinator: HwCoordinator | None = None
        self._reported_joining: datetime | None = None
        self._pending: dict[str, asyncio.Future[dict[object, object]]] = {}
        self._transaction = 0
        self._emit: ZigbeeEmit | None = None

    async def start(self, emit: ZigbeeEmit) -> None:
        self._emit = emit
        base = self._base
        self._mqtt.subscribe(f"{base}/bridge/info", self._on_info)
        self._mqtt.subscribe(f"{base}/bridge/state", self._on_bridge_state)
        self._mqtt.subscribe(f"{base}/bridge/devices", self._on_devices)
        self._mqtt.subscribe(f"{base}/bridge/event", self._on_event)
        self._mqtt.subscribe(f"{base}/bridge/response/permit_join", self._on_response)
        for name in self._watched:
            self._mqtt.subscribe(f"{base}/{name}", self._node_handler(name))
            self._mqtt.subscribe(f"{base}/{name}/availability", self._availability_handler(name))
        self._mqtt.on_connection(self._on_connection)

    async def stop(self) -> None:
        for future in self._pending.values():
            future.cancel()
        self._pending.clear()
        self._emit = None

    async def permit_join(self, request: HwZigbeeStatusPermitJoinRequest) -> HwAck:
        if not self._mqtt.connected:
            return ack_error("transport", "MQTT broker not connected")
        if not self._bridge_online:
            return ack_error("device_offline", "Zigbee coordinator is offline")
        self._transaction += 1
        transaction = f"hw-{self._transaction}"
        future: asyncio.Future[dict[object, object]] = asyncio.get_running_loop().create_future()
        self._pending[transaction] = future
        try:
            await self._mqtt.publish(
                self._request_topic, {"time": request.seconds, "transaction": transaction}
            )
            response = await asyncio.wait_for(future, timeout=self._response_timeout_s)
        except TimeoutError:
            return ack_error("timeout", "zigbee2mqtt did not answer permit_join")
        finally:
            self._pending.pop(transaction, None)
        if response.get("status") == "ok":
            return ACK_OK
        reason = text(response, "error") or "unknown error"
        return ack_error("device_offline", f"zigbee2mqtt refused permit_join: {reason}")

    # MQTT handlers

    def _on_info(self, payload: object) -> None:
        info = bridge_info(payload)
        if info is None:
            return
        self._info = info
        self._report_coordinator()
        self._report_mesh()

    def _on_bridge_state(self, payload: object) -> None:
        self._bridge_online = is_online(payload)
        self._report_coordinator()

    def _on_devices(self, payload: object) -> None:
        if not isinstance(payload, list):
            return
        devices = [device for device in map(paired_device, payload) if device is not None]
        self._devices = {device.ieee: device for device in devices}
        self._report_nodes()

    def _on_event(self, payload: object) -> None:
        if not isinstance(payload, dict):
            return
        kind = payload.get("type")
        data = payload.get("data")
        name = text(data, "friendly_name") if isinstance(data, dict) else None
        if name is None or not isinstance(data, dict):
            return
        live = self._live.setdefault(name, NodeLive())
        if kind in SEEN_EVENTS or (
            kind == "device_interview" and data.get("status") == "successful"
        ):
            live.last_seen = self._now()
            live.online = True
        elif kind == "device_leave":
            live.online = False
        else:
            return
        self._report_nodes()

    def _on_response(self, payload: object) -> None:
        if not isinstance(payload, dict):
            return
        transaction = payload.get("transaction")
        future = self._pending.get(transaction) if isinstance(transaction, str) else None
        if future is not None and not future.done():
            future.set_result(payload)

    def _node_handler(self, name: str) -> Callable[[object], None]:
        def on_message(payload: object) -> None:
            live = self._live[name]
            live.last_seen = self._now()
            live.online = True
            if isinstance(payload, dict):
                lqi = whole(payload, "linkquality", 0, 255)
                battery = whole(payload, "battery", 0, 100)
                live.lqi = live.lqi if lqi is None else lqi
                live.battery_pct = live.battery_pct if battery is None else battery
            self._report_nodes()

        return on_message

    def _availability_handler(self, name: str) -> Callable[[object], None]:
        def on_availability(payload: object) -> None:
            self._live[name].online = is_online(payload)
            self._report_nodes()

        return on_availability

    def _on_connection(self, connected: bool) -> None:
        if not connected:
            # Retained bridge state and availability arrive again on the next subscribe.
            self._bridge_online = False
            for live in self._live.values():
                live.online = False
            self._report_nodes()
        self._report_coordinator()

    # Reports: each event only when its data changed

    def _report_nodes(self) -> None:
        for device in self._devices.values():
            live = self._live.get(device.friendly_name, NodeLive())
            node = HwZigbeeNode(
                ieee=device.ieee,
                friendly_name=device.friendly_name,
                model=device.model,
                role=device.role,
                power_source=device.power_source,
                lqi=live.lqi,
                battery_pct=live.battery_pct if device.power_source == "battery" else None,
                last_seen=live.last_seen,
                online=live.online,
            )
            if self._reported_nodes.get(device.ieee) == node:
                continue
            self._reported_nodes[device.ieee] = node
            if self._emit is not None:
                self._emit(HwZigbeeNodeEvent(data=node))

    def _report_coordinator(self) -> None:
        info = self._info
        if info is None:
            return
        configured = self._settings.coordinator
        status: Literal["online", "offline"] = (
            "online" if self._mqtt.connected and self._bridge_online else "offline"
        )
        coordinator = HwCoordinator(
            model=configured.model,
            chipset=configured.chipset,
            firmware=info.firmware or configured.firmware,
            channel=configured.channel if info.channel is None else info.channel,
            tx_power_dbm=configured.tx_power_dbm,
            port=configured.port,
            antenna=configured.antenna,
            status=status,
        )
        if coordinator == self._reported_coordinator:
            return
        self._reported_coordinator = coordinator
        if self._emit is not None:
            self._emit(HwZigbeeCoordinatorEvent(data=coordinator))

    def _report_mesh(self) -> None:
        joining_until = None if self._info is None else self._info.joining_until
        if joining_until == self._reported_joining:
            return
        self._reported_joining = joining_until
        if self._emit is not None:
            self._emit(HwZigbeeMeshEvent(data=HwMeshData(joining_until=joining_until)))
