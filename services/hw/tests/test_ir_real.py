"""RealIrDriver (ZS06 via zigbee2mqtt) against an in-memory MQTT link. Topics and payload shapes are
copied from INTAKE-01 §2C (observed on the R-101 Pi, zigbee2mqtt 2.14.2)."""

import asyncio

from app.contracts import ACK_OK, HwErrorEvent, ack_error
from app.events import EventBus, Subscription
from app.modules.ir.driver_real import RealIrDriver, fresh_capture, is_online
from app.modules.ir.schemas import (
    HwIrBlasterData,
    HwIrBlasterEvent,
    HwIrLearnCancelled,
    HwIrLearnCaptured,
    HwIrLearnEvent,
    HwIrLearnRequest,
    HwIrLearnTimeout,
    HwIrSendRequest,
    HwIrSnapshot,
)
from app.modules.ir.service import IrService
from tests.fake_mqtt import FakeMqtt
from tests.helpers import drain, make_settings, next_event

STATE = "zigbee2mqtt/r101_ir"
SET = "zigbee2mqtt/r101_ir/set"
AVAILABILITY = "zigbee2mqtt/r101_ir/availability"
BRIDGE = "zigbee2mqtt/bridge/state"
ONLINE = {"state": "online"}
OFFLINE = {"state": "offline"}
ARMED_MS = 1_760_536_000_000  # the injected clock: learn is armed at this ms timestamp

# A Tuya code is opaque and 444-708 chars long (§2C); this one has the shape and is never altered.
CODE = "C/8hRgHrBkYBgAMH" + "A" * 480 + "+/=="
CACHED = "BbAPsAjmAewE4AFAA8ADQAMB7ARAH+ADAQ=="
SEND = HwIrSendRequest(transport="ir_zs06", code_format="tuya", code=CODE)
LEARN = HwIrLearnRequest(transport="ir_zs06", timeout_s=1)


def capture(code: str, timestamp: int) -> dict[str, object]:
    """The first state message after a capture (§2C "Learn result")."""
    return {
        "learn_ir_code": "OFF",
        "learned_ir_code": code,
        "learned_ir_timings": {
            "modulation": 38000,
            "timestamp": timestamp,
            "timings": [3500, 1700],
        },
        "linkquality": 170,
    }


def repeat(code: str) -> dict[str, object]:
    """Later state messages repeat the cached code with empty timings (§2C "Stale code")."""
    return {"learned_ir_code": code, "learned_ir_timings": "", "linkquality": 171}


async def start(
    online: bool = True, connected: bool = True
) -> tuple[IrService, RealIrDriver, FakeMqtt, Subscription]:
    bus = EventBus(64)
    sub = bus.subscribe()
    mqtt = FakeMqtt(connected=connected)
    driver = RealIrDriver(make_settings(drivers="ir=real"), mqtt, now_ms=lambda: ARMED_MS)
    service = IrService(driver, bus)
    await service.start()
    if online:
        mqtt.deliver(BRIDGE, ONLINE)
        mqtt.deliver(AVAILABILITY, ONLINE)
    return service, driver, mqtt, sub


async def learn_started(sub: Subscription) -> None:
    assert (await next_event(sub, HwIrLearnEvent)).data.status == "listening"


def test_payload_helpers() -> None:
    assert is_online({"state": "online"}) is True
    assert is_online("online") is True
    assert is_online({"state": "offline"}) is False
    assert is_online(None) is False
    assert fresh_capture(capture(CODE, ARMED_MS + 6000), ARMED_MS) == CODE
    assert fresh_capture(capture(CODE, ARMED_MS - 1), ARMED_MS) is None
    assert fresh_capture(repeat(CODE), ARMED_MS) is None
    assert fresh_capture({"learned_ir_timings": {"timestamp": True}}, ARMED_MS) is None


async def test_start_subscribes_and_reports_offline_until_availability() -> None:
    service, _, mqtt, sub = await start(online=False)
    assert set(mqtt.handlers) == {STATE, AVAILABILITY, BRIDGE}
    assert service.snapshot() == HwIrSnapshot(blaster=HwIrBlasterData(online=False, lqi=None))
    mqtt.deliver(BRIDGE, ONLINE)
    mqtt.deliver(AVAILABILITY, ONLINE)
    event = await next_event(sub, HwIrBlasterEvent)
    while not event.data.online:
        event = await next_event(sub, HwIrBlasterEvent)
    assert event.data == HwIrBlasterData(online=True, lqi=None)


async def test_blaster_follows_availability_and_link_quality() -> None:
    service, _, mqtt, sub = await start()
    drain(sub)
    mqtt.deliver(STATE, {"linkquality": 167})
    assert service.snapshot().blaster == HwIrBlasterData(online=True, lqi=167)
    mqtt.deliver(STATE, {"linkquality": 167})  # unchanged → no new event
    mqtt.deliver(AVAILABILITY, OFFLINE)
    assert service.snapshot().blaster == HwIrBlasterData(online=False, lqi=None)
    mqtt.deliver(AVAILABILITY, ONLINE)
    assert service.snapshot().blaster == HwIrBlasterData(online=True, lqi=167)
    events = [e.data for e in drain(sub) if isinstance(e, HwIrBlasterEvent)]
    assert events == [
        HwIrBlasterData(online=True, lqi=167),
        HwIrBlasterData(online=False, lqi=None),
        HwIrBlasterData(online=True, lqi=167),
    ]


async def test_bridge_offline_makes_the_blaster_offline() -> None:
    service, _, mqtt, _ = await start()
    mqtt.deliver(BRIDGE, OFFLINE)
    assert service.snapshot().blaster == HwIrBlasterData(online=False, lqi=None)


async def test_broker_loss_makes_the_blaster_offline_until_retained_state_returns() -> None:
    service, _, mqtt, _ = await start()
    mqtt.set_connected(False)
    assert service.snapshot().blaster == HwIrBlasterData(online=False, lqi=None)
    mqtt.set_connected(True)  # connected, but availability not heard again yet
    assert service.snapshot().blaster == HwIrBlasterData(online=False, lqi=None)
    mqtt.deliver(BRIDGE, ONLINE)
    mqtt.deliver(AVAILABILITY, ONLINE)
    assert service.snapshot().blaster == HwIrBlasterData(online=True, lqi=None)


async def test_send_publishes_the_code_unaltered() -> None:
    service, _, mqtt, _ = await start()
    assert await service.send(SEND) == ACK_OK
    assert mqtt.published == [(SET, {"ir_code_to_send": CODE})]
    assert len(mqtt.published[0][1]["ir_code_to_send"]) == len(CODE)


async def test_send_while_offline_is_device_offline() -> None:
    service, _, mqtt, _ = await start(online=False)
    assert await service.send(SEND) == ack_error("device_offline", "r101_ir is offline")
    assert mqtt.published == []


async def test_send_while_the_broker_is_down_is_transport() -> None:
    service, _, mqtt, _ = await start(connected=False)
    assert await service.send(SEND) == ack_error("transport", "MQTT broker not connected")
    assert mqtt.published == []


async def test_send_publish_failure_is_transport() -> None:
    service, _, mqtt, _ = await start()
    mqtt.fail_publish = TimeoutError("no PUBACK")
    ack = await service.send(SEND)
    assert ack.ok is False
    assert ack.error.code == "transport"


async def test_ir_mcu_is_invalid() -> None:
    service, _, mqtt, sub = await start()
    mcu = HwIrSendRequest(transport="ir_mcu", code_format="tuya", code=CODE)
    ack = await service.send(mcu)
    assert ack.ok is False
    assert ack.error.code == "invalid"
    learn = HwIrLearnRequest(transport="ir_mcu", timeout_s=1)
    assert await service.learn(learn) == HwIrLearnTimeout(status="timeout")
    error = await next_event(sub, HwErrorEvent)
    assert error.data.code == "invalid"
    assert mqtt.published == []


async def test_learn_captures_a_fresh_code_and_ignores_the_cached_one() -> None:
    service, _, mqtt, sub = await start()
    drain(sub)
    learning = asyncio.create_task(
        service.learn(HwIrLearnRequest(transport="ir_zs06", timeout_s=5))
    )
    await learn_started(sub)
    assert mqtt.published == [(SET, {"learn_ir_code": "ON"})]
    mqtt.deliver(STATE, repeat(CACHED))  # cached code repeated: not a capture
    mqtt.deliver(STATE, capture(CACHED, ARMED_MS - 60_000))  # an older capture: not fresh
    assert not learning.done()
    mqtt.deliver(STATE, capture(CODE, ARMED_MS + 6_000))
    result = await asyncio.wait_for(learning, 1)
    assert result == HwIrLearnCaptured(status="captured", code_format="tuya", code=CODE)
    assert (await next_event(sub, HwIrLearnEvent)).data.status == "captured"
    mqtt.deliver(STATE, repeat(CODE))  # the second message after a capture changes nothing
    assert mqtt.published == [(SET, {"learn_ir_code": "ON"})]


async def test_learn_timeout_switches_learn_mode_off() -> None:
    service, _, mqtt, sub = await start()
    drain(sub)
    learning = asyncio.create_task(service.learn(LEARN))
    await learn_started(sub)
    mqtt.deliver(STATE, repeat(CACHED))
    assert await asyncio.wait_for(learning, 2) == HwIrLearnTimeout(status="timeout")
    assert (await next_event(sub, HwIrLearnEvent)).data.status == "timeout"
    assert mqtt.published == [(SET, {"learn_ir_code": "ON"}), (SET, {"learn_ir_code": "OFF"})]


async def test_cancel_resolves_cancelled_and_switches_learn_mode_off() -> None:
    service, _, mqtt, sub = await start()
    drain(sub)
    learning = asyncio.create_task(
        service.learn(HwIrLearnRequest(transport="ir_zs06", timeout_s=5))
    )
    await learn_started(sub)
    assert await service.cancel_learn() == ACK_OK
    assert await asyncio.wait_for(learning, 1) == HwIrLearnCancelled(status="cancelled")
    assert (await next_event(sub, HwIrLearnEvent)).data.status == "cancelled"
    assert mqtt.published == [(SET, {"learn_ir_code": "ON"}), (SET, {"learn_ir_code": "OFF"})]


async def test_a_new_learn_cancels_the_one_in_progress() -> None:
    service, _, mqtt, sub = await start()
    drain(sub)
    first = asyncio.create_task(service.learn(HwIrLearnRequest(transport="ir_zs06", timeout_s=5)))
    await learn_started(sub)
    second = asyncio.create_task(service.learn(HwIrLearnRequest(transport="ir_zs06", timeout_s=5)))
    assert await asyncio.wait_for(first, 1) == HwIrLearnCancelled(status="cancelled")
    mqtt.deliver(STATE, capture(CODE, ARMED_MS + 1))
    assert await asyncio.wait_for(second, 1) == HwIrLearnCaptured(
        status="captured", code_format="tuya", code=CODE
    )


async def test_learn_while_offline_is_device_offline_and_never_arms() -> None:
    service, _, mqtt, sub = await start(online=False)
    assert await service.learn(LEARN) == HwIrLearnTimeout(status="timeout")
    error = await next_event(sub, HwErrorEvent)
    assert (error.data.code, error.data.message) == ("device_offline", "ir: r101_ir is offline")
    assert mqtt.published == []


async def test_learn_while_the_broker_is_down_is_transport() -> None:
    service, _, _, sub = await start(connected=False)
    assert await service.learn(LEARN) == HwIrLearnTimeout(status="timeout")
    error = await next_event(sub, HwErrorEvent)
    assert (error.data.code, error.data.message) == ("transport", "ir: MQTT broker not connected")


async def test_cancel_while_the_broker_is_down_is_transport() -> None:
    service, _, _, _ = await start(connected=False)
    assert await service.cancel_learn() == ack_error("transport", "MQTT broker not connected")
