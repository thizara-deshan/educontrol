"""MqttTransport with an injected aiomqtt-like client: subscribe on connect, dispatch, publish,
reconnect with backoff."""

import asyncio
import json
from collections.abc import AsyncIterator, Callable
from contextlib import AbstractAsyncContextManager, asynccontextmanager
from dataclasses import dataclass

import aiomqtt
import pytest

from app.transports.mqtt import (
    MqttClient,
    MqttNotConnected,
    MqttTransport,
    decode_payload,
    next_backoff,
)
from tests.helpers import make_settings


@dataclass
class Message:
    topic: str
    payload: object


class FakeClient:
    """One connection. `drop()` ends it the way aiomqtt does: the message iterator raises."""

    def __init__(self) -> None:
        self.subscribed: list[str] = []
        self.published: list[tuple[str, str, int]] = []
        self._queue: asyncio.Queue[Message | None] = asyncio.Queue()

    async def subscribe(self, topic: str, qos: int = 0) -> object:
        self.subscribed.append(topic)
        return None

    async def publish(
        self,
        topic: str,
        payload: str,
        qos: int = 0,
        *,
        timeout: float | None = None,  # noqa: ASYNC109 - mirrors aiomqtt.Client.publish
    ) -> None:
        self.published.append((topic, payload, qos))

    def push(self, topic: str, payload: object) -> None:
        self._queue.put_nowait(Message(topic, payload))

    def drop(self) -> None:
        self._queue.put_nowait(None)

    @property
    def messages(self) -> AsyncIterator[Message]:
        return self._iterate()

    async def _iterate(self) -> AsyncIterator[Message]:
        while True:
            message = await self._queue.get()
            if message is None:
                raise aiomqtt.MqttError("Disconnected during message iteration")
            yield message


class Broker:
    """Client factory: each connect hands out a new FakeClient; `refuse` = broker down."""

    def __init__(self) -> None:
        self.clients: list[FakeClient] = []
        self.refuse = 0
        self.connects = asyncio.Event()

    def factory(self) -> AbstractAsyncContextManager[MqttClient]:
        return self._connect()

    @asynccontextmanager
    async def _connect(self) -> AsyncIterator[MqttClient]:
        if self.refuse > 0:
            self.refuse -= 1
            raise aiomqtt.MqttError("[Errno 111] Connection refused")
        client = FakeClient()
        self.clients.append(client)
        self.connects.set()
        yield client


async def until(condition: Callable[[], object], within: float = 1.0) -> None:
    async with asyncio.timeout(within):
        while not condition():  # noqa: ASYNC110 - polls state another task changes
            await asyncio.sleep(0.001)


def test_backoff_doubles_up_to_the_max() -> None:
    delays = [1.0]
    for _ in range(6):
        delays.append(next_backoff(delays[-1], 30.0))
    assert delays == [1.0, 2.0, 4.0, 8.0, 16.0, 30.0, 30.0]


def test_decode_payload() -> None:
    assert decode_payload(b'{"state":"online"}') == {"state": "online"}
    assert decode_payload(b"online") == "online"
    assert decode_payload(bytearray(b"[1, 2]")) == [1, 2]
    assert decode_payload(None) is None


async def test_subscribes_dispatches_and_publishes_json_with_qos_1() -> None:
    broker = Broker()
    transport = MqttTransport(make_settings(), broker.factory)
    seen: list[object] = []
    states: list[bool] = []
    transport.subscribe("zigbee2mqtt/r101_ir", seen.append)
    transport.on_connection(states.append)
    assert transport.connected is False
    await transport.start()
    await until(lambda: transport.connected)
    client = broker.clients[0]
    assert client.subscribed == ["zigbee2mqtt/r101_ir"]
    client.push("zigbee2mqtt/r101_ir", b'{"linkquality":170}')
    client.push("zigbee2mqtt/other", b"{}")
    await until(lambda: seen)
    assert seen == [{"linkquality": 170}]
    await transport.publish("zigbee2mqtt/r101_ir/set", {"learn_ir_code": "ON"})
    topic, payload, qos = client.published[0]
    assert (topic, json.loads(payload), qos) == (
        "zigbee2mqtt/r101_ir/set",
        {"learn_ir_code": "ON"},
        1,
    )
    await transport.stop()
    assert transport.connected is False
    assert states == [True, False]


async def test_publish_without_a_connection_raises() -> None:
    transport = MqttTransport(make_settings(), Broker().factory)
    with pytest.raises(MqttNotConnected, match="MQTT broker not connected"):
        await transport.publish("t", {})


async def test_reconnects_and_resubscribes_after_a_drop() -> None:
    broker = Broker()
    broker.refuse = 2  # broker down at start: two refused connects, then up
    transport = MqttTransport(make_settings(), broker.factory)
    states: list[bool] = []
    transport.subscribe("zigbee2mqtt/bridge/state", lambda _payload: None)
    transport.on_connection(states.append)
    await transport.start()
    await until(lambda: transport.connected)
    broker.clients[0].drop()
    await until(lambda: len(broker.clients) == 2 and transport.connected)
    assert broker.clients[1].subscribed == ["zigbee2mqtt/bridge/state"]
    assert states == [True, False, True]
    await transport.stop()


async def test_a_failing_handler_does_not_stop_the_others() -> None:
    broker = Broker()
    transport = MqttTransport(make_settings(), broker.factory)
    seen: list[object] = []

    def broken(_payload: object) -> None:
        raise ValueError("boom")

    transport.subscribe("t", broken)
    transport.subscribe("t", seen.append)
    await transport.start()
    await until(lambda: transport.connected)
    broker.clients[0].push("t", b"1")
    await until(lambda: seen)
    assert seen == [1]
    await transport.stop()


async def test_subscribe_after_start_is_a_bug() -> None:
    transport = MqttTransport(make_settings(), Broker().factory)
    await transport.start()
    with pytest.raises(RuntimeError):
        transport.subscribe("t", lambda _payload: None)
    await transport.stop()
