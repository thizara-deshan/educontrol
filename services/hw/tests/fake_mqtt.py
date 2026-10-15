"""In-memory `MqttLink` for real-driver tests: records publishes, delivers messages by hand."""

from collections.abc import Mapping

from app.transports.mqtt import ConnectionHandler, MessageHandler, MqttNotConnected


class FakeMqtt:
    def __init__(self, connected: bool = True) -> None:
        self._connected = connected
        self.handlers: dict[str, list[MessageHandler]] = {}
        self.connection_handlers: list[ConnectionHandler] = []
        self.published: list[tuple[str, dict[str, object]]] = []
        self.fail_publish: Exception | None = None

    @property
    def connected(self) -> bool:
        return self._connected

    def subscribe(self, topic: str, handler: MessageHandler) -> None:
        self.handlers.setdefault(topic, []).append(handler)

    def on_connection(self, handler: ConnectionHandler) -> None:
        self.connection_handlers.append(handler)

    async def publish(self, topic: str, payload: Mapping[str, object]) -> None:
        if not self._connected:
            raise MqttNotConnected
        if self.fail_publish is not None:
            raise self.fail_publish
        self.published.append((topic, dict(payload)))

    def deliver(self, topic: str, payload: object) -> None:
        """A message from the broker, payload already decoded (as MqttTransport passes it)."""
        for handler in list(self.handlers.get(topic, [])):
            handler(payload)

    def set_connected(self, connected: bool) -> None:
        self._connected = connected
        for handler in list(self.connection_handlers):
            handler(connected)
