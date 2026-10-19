"""Real smart plug driver: SONOFF S60ZBTPG through zigbee2mqtt (D-34).

Topic `<base>/<node>` (`<base>` = HW_Z2M_BASE_TOPIC, `<node>` = HW_PLUG_NODE), one JSON object per
report with the plug's full state: `state` "ON" / "OFF", `power` W, `voltage` V, `current` A,
`energy_today` kWh (zigbee2mqtt 2.14.2; captured on the R-101 Pi 2026-10-19 right after pairing as
`r101_plug`, see tests/test_plug.py). Other keys (`energy_month`, `overload_protection`, …)
are ignored.
`<base>/<node>/availability` → online. Commands: `<base>/<node>/set {"state": "ON" | "OFF"}`.
"""

import math

from app.config import Settings
from app.contracts import ACK_OK, HwAck, HwDriverKind, ack_error
from app.modules.plug.schemas import HwPlugSetRequest, HwPlugStateData, HwPlugStateEvent
from app.modules.plug.service import PlugEmit
from app.transports.mqtt import MqttLink


def is_online(payload: object) -> bool:
    """`{"state": "online"}` (zigbee2mqtt 2.x) or the legacy plain text `online`."""
    if isinstance(payload, dict):
        return payload.get("state") == "online"
    return payload == "online"


def reading(payload: dict[object, object], key: str) -> float | None:
    """`payload[key]` when it is a finite, non-negative JSON number (bools are not)."""
    value = payload.get(key)
    if isinstance(value, bool) or not isinstance(value, int | float):
        return None
    return float(value) if math.isfinite(value) and value >= 0 else None


def relay(payload: dict[object, object]) -> bool | None:
    state = payload.get("state")
    return {"ON": True, "OFF": False}.get(state) if isinstance(state, str) else None


class RealPlugDriver:
    kind: HwDriverKind = "real"

    def __init__(self, settings: Settings, mqtt: MqttLink) -> None:
        self._mqtt = mqtt
        self._node = settings.plug_node
        base = settings.z2m_base_topic
        self._state_topic = f"{base}/{self._node}"
        self._set_topic = f"{base}/{self._node}/set"
        self._availability_topic = f"{base}/{self._node}/availability"
        self._available = False
        self._data = HwPlugStateData(
            online=False, on=None, watts=None, volts=None, amps=None, kwh_today=None
        )
        self._reported: HwPlugStateData | None = None
        self._emit: PlugEmit | None = None

    async def start(self, emit: PlugEmit) -> None:
        self._emit = emit
        self._mqtt.subscribe(self._state_topic, self._on_state)
        self._mqtt.subscribe(self._availability_topic, self._on_availability)
        self._mqtt.on_connection(self._on_connection)

    async def stop(self) -> None:
        self._emit = None

    async def set(self, request: HwPlugSetRequest) -> HwAck:
        if not self._mqtt.connected:
            return ack_error("transport", "MQTT broker not connected")
        if not self._available:
            return ack_error("device_offline", f"{self._node} is offline")
        await self._mqtt.publish(self._set_topic, {"state": "ON" if request.on else "OFF"})
        return ACK_OK

    def _on_state(self, payload: object) -> None:
        if not isinstance(payload, dict):
            return
        on = relay(payload)
        values = {
            "watts": reading(payload, "power"),
            "volts": reading(payload, "voltage"),
            "amps": reading(payload, "current"),
            "kwh_today": reading(payload, "energy_today"),
        }
        update: dict[str, object] = {k: v for k, v in values.items() if v is not None}
        if on is not None:
            update["on"] = on
        self._data = self._data.model_copy(update=update)
        self._report()

    def _on_availability(self, payload: object) -> None:
        self._available = is_online(payload)
        self._report()

    def _on_connection(self, connected: bool) -> None:
        if not connected:
            self._available = False  # retained availability arrives again on the next subscribe
        self._report()

    def _report(self) -> None:
        data = self._data.model_copy(update={"online": self._mqtt.connected and self._available})
        if data == self._reported or self._emit is None:
            return
        self._reported = data
        self._emit(HwPlugStateEvent(data=data))
