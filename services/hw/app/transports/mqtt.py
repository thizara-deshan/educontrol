"""Shared zigbee2mqtt client for the real zigbee drivers (D-13, ARCHITECTURE §7.1, INTAKE-01 §5B).

One `aiomqtt` client per process. Drivers register exact topics with `subscribe()` before
`start()` (the registry starts the services first) and get every message on them. `publish()`
sends one JSON object with QoS 1, so it returns only once the broker accepted it (the ZS06 itself
never acknowledges, §2C). The connection loop reconnects with a doubling backoff
(`HW_MQTT_RECONNECT_MIN_S` → `HW_MQTT_RECONNECT_MAX_S`) and reports every up/down change to the
`on_connection` listeners.
"""

import asyncio
import json
from collections.abc import AsyncIterator, Callable, Mapping
from contextlib import AbstractAsyncContextManager, suppress
from typing import Protocol

import aiomqtt

from app.config import Settings
from app.contracts import logger

# A message payload: the parsed JSON value, or the decoded text when it is not JSON.
MessageHandler = Callable[[object], None]
ConnectionHandler = Callable[[bool], None]


class MqttNotConnected(ConnectionError):
    """`publish()` while the broker is not connected (drivers answer `transport`)."""

    def __init__(self) -> None:
        super().__init__("MQTT broker not connected")


class MqttLink(Protocol):
    """What a real zigbee driver needs from the transport. Tests inject an in-memory one."""

    @property
    def connected(self) -> bool: ...

    def subscribe(self, topic: str, handler: MessageHandler) -> None: ...

    def on_connection(self, handler: ConnectionHandler) -> None: ...

    async def publish(self, topic: str, payload: Mapping[str, object]) -> None: ...


class MqttMessage(Protocol):
    @property
    def topic(self) -> object: ...  # aiomqtt.Topic; str() gives the topic text

    @property
    def payload(self) -> object: ...


class MqttClient(Protocol):
    """The part of `aiomqtt.Client` this transport uses (a fake in tests/test_mqtt.py)."""

    @property
    def messages(self) -> AsyncIterator[MqttMessage]: ...

    async def subscribe(self, topic: str, qos: int = 0) -> object: ...

    async def publish(
        self,
        topic: str,
        payload: str,
        qos: int = 0,
        *,
        timeout: float | None = None,  # noqa: ASYNC109 - aiomqtt.Client.publish's own parameter
    ) -> None: ...


ClientFactory = Callable[[], AbstractAsyncContextManager[MqttClient]]


def next_backoff(delay_s: float, max_s: float) -> float:
    """1 → 2 → 4 → … → max_s (INTAKE-01 §5B: 1 → 30 s)."""
    return min(delay_s * 2, max_s)


def decode_payload(raw: object) -> object:
    """MQTT bytes → parsed JSON, or the plain text when it is not JSON (e.g. legacy `online`)."""
    text = raw.decode("utf-8", errors="replace") if isinstance(raw, bytes | bytearray) else raw
    if not isinstance(text, str):
        return text
    try:
        parsed: object = json.loads(text)
    except ValueError:
        return text
    return parsed


class MqttTransport:
    def __init__(self, settings: Settings, client_factory: ClientFactory | None = None) -> None:
        self._settings = settings
        self._client_factory = client_factory or self._aiomqtt_client
        self._handlers: dict[str, list[MessageHandler]] = {}
        self._connection_handlers: list[ConnectionHandler] = []
        self._client: MqttClient | None = None
        self._connected = False
        self._task: asyncio.Task[None] | None = None

    @property
    def connected(self) -> bool:
        return self._connected

    def subscribe(self, topic: str, handler: MessageHandler) -> None:
        """Registers `handler` for exactly `topic`; subscribed again on every connect."""
        if self._task is not None:
            raise RuntimeError(f"mqtt: subscribe({topic!r}) after start()")
        self._handlers.setdefault(topic, []).append(handler)

    def on_connection(self, handler: ConnectionHandler) -> None:
        self._connection_handlers.append(handler)

    async def publish(self, topic: str, payload: Mapping[str, object]) -> None:
        client = self._client
        if client is None or not self._connected:
            raise MqttNotConnected
        await client.publish(
            topic, json.dumps(payload), qos=1, timeout=self._settings.mqtt_publish_timeout_s
        )

    async def start(self) -> None:
        """Starts the connection loop in the background; never waits for the broker."""
        if self._task is None:
            self._task = asyncio.create_task(self._run())

    async def stop(self) -> None:
        task, self._task = self._task, None
        if task is not None:
            task.cancel()
            with suppress(asyncio.CancelledError):
                await task

    def _aiomqtt_client(self) -> AbstractAsyncContextManager[MqttClient]:
        # No fixed client id: hw-service and the [ON PI] hardware tests may connect side by side.
        return aiomqtt.Client(hostname=self._settings.mqtt_host, port=self._settings.mqtt_port)

    async def _run(self) -> None:
        delay = self._settings.mqtt_reconnect_min_s
        while True:
            try:
                async with self._client_factory() as client:
                    for topic in list(self._handlers):
                        await client.subscribe(topic, qos=1)
                    self._client = client
                    self._set_connected(True)
                    logger.info(
                        "mqtt: connected to %s:%d",
                        self._settings.mqtt_host,
                        self._settings.mqtt_port,
                    )
                    delay = self._settings.mqtt_reconnect_min_s
                    async for message in client.messages:
                        self._dispatch(str(message.topic), message.payload)
            except (aiomqtt.MqttError, OSError) as exc:
                logger.warning("mqtt: %s; reconnecting in %.0f s", exc, delay)
            finally:
                self._client = None
                self._set_connected(False)
            await asyncio.sleep(delay)
            delay = next_backoff(delay, self._settings.mqtt_reconnect_max_s)

    def _dispatch(self, topic: str, raw: object) -> None:
        payload = decode_payload(raw)
        for handler in list(self._handlers.get(topic, [])):
            try:
                handler(payload)
            except Exception:
                logger.exception("mqtt: handler for %s failed", topic)

    def _set_connected(self, connected: bool) -> None:
        if connected == self._connected:
            return
        self._connected = connected
        for handler in list(self._connection_handlers):
            handler(connected)
