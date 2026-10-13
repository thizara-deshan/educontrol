import asyncio
from typing import Literal

from app.contracts import HwEnvelope, HwHeartbeatEvent
from app.events import EventBus, event_stream, heartbeat, to_sse
from tests.helpers import next_event


class FakeSnapshotEvent(HwEnvelope):
    type: Literal["snapshot"] = "snapshot"


def test_publish_reaches_every_subscriber() -> None:
    bus = EventBus(8)
    first, second = bus.subscribe(), bus.subscribe()
    event = HwHeartbeatEvent()
    bus.publish(event)
    assert first.queue.get_nowait() is event
    assert second.queue.get_nowait() is event


def test_unsubscribe_stops_delivery() -> None:
    bus = EventBus(8)
    sub = bus.subscribe()
    bus.unsubscribe(sub)
    bus.publish(HwHeartbeatEvent())
    assert sub.queue.empty()
    assert bus.subscriber_count == 0


def test_slow_subscriber_is_dropped_others_keep_going() -> None:
    bus = EventBus(2)
    slow, fast = bus.subscribe(), bus.subscribe()
    for _ in range(2):
        bus.publish(HwHeartbeatEvent())
    fast.queue.get_nowait()
    fast.queue.get_nowait()
    bus.publish(HwHeartbeatEvent())  # slow is full → dropped
    assert bus.subscriber_count == 1
    assert slow.queue.get_nowait() is None
    assert slow.queue.empty()
    assert isinstance(fast.queue.get_nowait(), HwHeartbeatEvent)


async def test_heartbeat_publishes_on_its_interval() -> None:
    bus = EventBus(8)
    sub = bus.subscribe()
    task = asyncio.create_task(heartbeat(bus, 0.01))
    try:
        await next_event(sub, HwHeartbeatEvent)
        await next_event(sub, HwHeartbeatEvent)
    finally:
        task.cancel()


def test_to_sse_uses_type_as_event_name() -> None:
    event = HwHeartbeatEvent()
    sse = to_sse(event)
    assert sse.event == "heartbeat"
    assert sse.data == event.model_dump_json()


async def test_stream_sends_snapshot_first_then_bus_events() -> None:
    bus = EventBus(8)
    stream = event_stream(bus, FakeSnapshotEvent)
    first = await anext(stream)
    assert first.event == "snapshot"
    assert bus.subscriber_count == 1
    bus.publish(HwHeartbeatEvent())
    second = await anext(stream)
    assert second.event == "heartbeat"
    await stream.aclose()
    assert bus.subscriber_count == 0


async def test_stream_ends_when_its_subscriber_is_dropped() -> None:
    bus = EventBus(1)
    stream = event_stream(bus, FakeSnapshotEvent)
    await anext(stream)
    bus.publish(HwHeartbeatEvent())
    bus.publish(HwHeartbeatEvent())  # queue of 1 overflows → dropped
    assert [item async for item in stream] == []
    assert bus.subscriber_count == 0
