"""In-process event bus and the SSE stream behind GET /v1/events (ARCHITECTURE §3.4, §7.1)."""

import asyncio
from collections.abc import AsyncIterator, Callable

from sse_starlette import ServerSentEvent

from app.contracts import HwEnvelope, HwHeartbeatEvent, logger


class Subscription:
    """One SSE client. `None` in the queue means "you were dropped, close the stream"."""

    def __init__(self, maxsize: int) -> None:
        self.queue: asyncio.Queue[HwEnvelope | None] = asyncio.Queue(maxsize=maxsize)


class EventBus:
    def __init__(self, queue_size: int) -> None:
        self._queue_size = queue_size
        self._subscribers: set[Subscription] = set()

    @property
    def subscriber_count(self) -> int:
        return len(self._subscribers)

    def subscribe(self) -> Subscription:
        sub = Subscription(self._queue_size)
        self._subscribers.add(sub)
        return sub

    def unsubscribe(self, sub: Subscription) -> None:
        self._subscribers.discard(sub)

    def publish(self, event: HwEnvelope) -> None:
        for sub in list(self._subscribers):
            try:
                sub.queue.put_nowait(event)
            except asyncio.QueueFull:
                self._drop(sub)

    def _drop(self, sub: Subscription) -> None:
        """A slow subscriber is disconnected; its client reconnects and gets a fresh snapshot."""
        self._subscribers.discard(sub)
        while not sub.queue.empty():
            sub.queue.get_nowait()
        sub.queue.put_nowait(None)
        logger.warning("events: dropped a slow subscriber (%d queued)", self._queue_size)


async def heartbeat(bus: EventBus, interval_s: float) -> None:
    """Publishes `heartbeat` every `interval_s` until cancelled (lifespan task)."""
    while True:
        await asyncio.sleep(interval_s)
        bus.publish(HwHeartbeatEvent())


def to_sse(event: HwEnvelope) -> ServerSentEvent:
    return ServerSentEvent(event=event.type, data=event.model_dump_json())


async def event_stream(
    bus: EventBus, snapshot: Callable[[], HwEnvelope]
) -> AsyncIterator[ServerSentEvent]:
    """`snapshot` first, then every bus event, until the client leaves or is dropped.

    Subscribing and building the snapshot happen without an `await` in between, so no event can
    fall between the snapshot and the first queued event.
    """
    sub = bus.subscribe()
    try:
        yield to_sse(snapshot())
        while True:
            event = await sub.queue.get()
            if event is None:
                return
            yield to_sse(event)
    finally:
        bus.unsubscribe(sub)
