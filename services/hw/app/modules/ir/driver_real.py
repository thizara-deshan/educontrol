"""Real IR driver: the ZS06 blaster (`transport: ir_zs06`) through zigbee2mqtt (INTAKE-01 §2C, §5B).

Topics (`<base>` = HW_Z2M_BASE_TOPIC, `<node>` = HW_IR_NODE):
- `<base>/<node>/availability` `{"state": "online"|"offline"}` (retained) and
  `<base>/bridge/state` `{"state": "online"|"offline"}` (retained) → `ir.blaster.online`, which is
  also false while the broker is down. `linkquality` in `<base>/<node>` → `ir.blaster.lqi`.
- send: `{"ir_code_to_send": code}` → `<base>/<node>/set`. The ZS06 never acknowledges, so the
  ack only means "the broker accepted it" and core-api keeps IR `assumed`.
- learn: `{"learn_ir_code": "ON"}`; the capture is the first `<base>/<node>` message whose
  `learned_ir_timings` is an object with `timestamp` (ms) ≥ the arm time. zigbee2mqtt repeats the
  cached `learned_ir_code` in later messages, so the code alone never counts. Codes are passed on
  exactly as received. Timeout and cancel publish `{"learn_ir_code": "OFF"}`.
- `ir_mcu` (ESP32) is not built yet (INTAKE-01 Part A): send → `invalid`, learn → `invalid`.
"""

import asyncio
import time
from collections.abc import Callable

from app.config import Settings
from app.contracts import ACK_OK, HwAck, HwDriverKind, ack_error, logger
from app.modules.ir.schemas import (
    HwIrBlasterData,
    HwIrBlasterEvent,
    HwIrLearnCancelled,
    HwIrLearnCaptured,
    HwIrLearnEvent,
    HwIrLearnRequest,
    HwIrLearnResult,
    HwIrLearnStateData,
    HwIrLearnTimeout,
    HwIrSendRequest,
    IrLearnStatus,
)
from app.modules.ir.service import IrEmit, IrRefused
from app.transports.mqtt import MqttLink

MCU_PENDING = "ir_mcu (ESP32) is not available yet (INTAKE-01 Part A)"


def wall_clock_ms() -> int:
    """zigbee2mqtt stamps `learned_ir_timings.timestamp` with its own Date.now() on this Pi."""
    return int(time.time() * 1000)


def is_online(payload: object) -> bool:
    """`{"state": "online"}` (zigbee2mqtt 2.x) or the legacy plain text `online`."""
    if isinstance(payload, dict):
        return payload.get("state") == "online"
    return payload == "online"


def fresh_capture(payload: object, armed_ms: int) -> str | None:
    """The learned code when `payload` is a capture made after `armed_ms`, else None."""
    if not isinstance(payload, dict):
        return None
    timings = payload.get("learned_ir_timings")
    code = payload.get("learned_ir_code")
    if not isinstance(timings, dict) or not isinstance(code, str) or code == "":
        return None
    stamp = timings.get("timestamp")
    if isinstance(stamp, bool) or not isinstance(stamp, int | float):
        return None
    return code if stamp >= armed_ms else None


def link_quality(payload: object) -> int | None:
    if not isinstance(payload, dict):
        return None
    lqi = payload.get("linkquality")
    if isinstance(lqi, bool) or not isinstance(lqi, int) or not 0 <= lqi <= 255:
        return None
    return lqi


class RealIrDriver:
    kind: HwDriverKind = "real"

    def __init__(
        self, settings: Settings, mqtt: MqttLink, now_ms: Callable[[], int] = wall_clock_ms
    ) -> None:
        self._settings = settings
        self._mqtt = mqtt
        self._now_ms = now_ms
        base = settings.z2m_base_topic
        node = settings.ir_node
        self._state_topic = f"{base}/{node}"
        self._set_topic = f"{base}/{node}/set"
        self._availability_topic = f"{base}/{node}/availability"
        self._bridge_topic = f"{base}/bridge/state"
        self._available = False
        self._bridge_online = False
        self._lqi: int | None = None
        self._reported: HwIrBlasterData | None = None
        self._learn: asyncio.Future[HwIrLearnResult] | None = None
        self._armed_ms = 0
        self._emit: IrEmit | None = None

    @property
    def online(self) -> bool:
        return self._mqtt.connected and self._bridge_online and self._available

    async def start(self, emit: IrEmit) -> None:
        self._emit = emit
        self._mqtt.subscribe(self._availability_topic, self._on_availability)
        self._mqtt.subscribe(self._bridge_topic, self._on_bridge)
        self._mqtt.subscribe(self._state_topic, self._on_state)
        self._mqtt.on_connection(self._on_connection)
        self._report_blaster()

    async def stop(self) -> None:
        self._resolve_learn(HwIrLearnCancelled(status="cancelled"))
        self._emit = None

    async def send(self, request: HwIrSendRequest) -> HwAck:
        refused = self._refusal(request.transport)
        if refused is not None:
            return ack_error(refused.code, str(refused))
        await self._mqtt.publish(self._set_topic, {"ir_code_to_send": request.code})
        return ACK_OK

    async def learn(self, request: HwIrLearnRequest) -> HwIrLearnResult:
        """One capture at a time: a new learn cancels the one in progress (like the fake)."""
        refused = self._refusal(request.transport)
        if refused is not None:
            raise refused
        self._resolve_learn(HwIrLearnCancelled(status="cancelled"))
        future: asyncio.Future[HwIrLearnResult] = asyncio.get_running_loop().create_future()
        self._learn = future
        self._armed_ms = self._now_ms()
        try:
            await self._mqtt.publish(self._set_topic, {"learn_ir_code": "ON"})
        except Exception:
            self._learn = None
            raise
        self._report_learn("listening")
        result: HwIrLearnResult
        try:
            result = await asyncio.wait_for(future, timeout=request.timeout_s)
        except TimeoutError:
            result = HwIrLearnTimeout(status="timeout")
            await self._learn_off()
        finally:
            if self._learn is future:
                self._learn = None
        self._report_learn(result.status)
        return result

    async def cancel_learn(self) -> HwAck:
        self._resolve_learn(HwIrLearnCancelled(status="cancelled"))
        if not self._mqtt.connected:
            return ack_error("transport", "MQTT broker not connected")
        await self._mqtt.publish(self._set_topic, {"learn_ir_code": "OFF"})
        return ACK_OK

    def _refusal(self, transport: str) -> IrRefused | None:
        if transport != "ir_zs06":
            return IrRefused("invalid", MCU_PENDING)
        if not self._mqtt.connected:
            return IrRefused("transport", "MQTT broker not connected")
        if not self.online:
            return IrRefused("device_offline", f"{self._settings.ir_node} is offline")
        return None

    async def _learn_off(self) -> None:
        """Stops learn mode after a timeout; a failure only logs (H21: nothing is stored)."""
        try:
            await self._mqtt.publish(self._set_topic, {"learn_ir_code": "OFF"})
        except Exception as exc:
            logger.warning("ir: could not switch learn mode off: %s", exc)

    def _resolve_learn(self, result: HwIrLearnResult) -> None:
        future = self._learn
        if future is not None and not future.done():
            future.set_result(result)

    def _on_availability(self, payload: object) -> None:
        self._available = is_online(payload)
        self._report_blaster()

    def _on_bridge(self, payload: object) -> None:
        self._bridge_online = is_online(payload)
        self._report_blaster()

    def _on_state(self, payload: object) -> None:
        lqi = link_quality(payload)
        if lqi is not None:
            self._lqi = lqi
            self._report_blaster()
        future = self._learn
        if future is None or future.done():
            return
        code = fresh_capture(payload, self._armed_ms)
        if code is not None:
            future.set_result(HwIrLearnCaptured(status="captured", code_format="tuya", code=code))

    def _on_connection(self, connected: bool) -> None:
        if not connected:
            # Retained availability and bridge state arrive again on the next subscribe.
            self._available = False
            self._bridge_online = False
        self._report_blaster()

    def _report_blaster(self) -> None:
        """Emits `ir.blaster` when (online, lqi) changed; lqi is null while offline."""
        online = self.online
        data = HwIrBlasterData(online=online, lqi=self._lqi if online else None)
        if data == self._reported or self._emit is None:
            return
        self._reported = data
        self._emit(HwIrBlasterEvent(data=data))

    def _report_learn(self, status: IrLearnStatus) -> None:
        if self._emit is not None:
            self._emit(HwIrLearnEvent(data=HwIrLearnStateData(status=status)))
