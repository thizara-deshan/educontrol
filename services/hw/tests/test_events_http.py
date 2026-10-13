"""GET /v1/events end to end against a real uvicorn (TestClient cannot read an endless stream)."""

import json
import threading
import time
from collections.abc import Iterator

import httpx
import pytest
import uvicorn
from pydantic import TypeAdapter

from app.main import create_app
from app.snapshot import HwEvent
from tests.helpers import make_settings

hw_event: TypeAdapter[HwEvent] = TypeAdapter(HwEvent)


@pytest.fixture
def base_url() -> Iterator[str]:
    app = create_app(make_settings(heartbeat_s=0.2, fake_report_interval_s=0.1))
    server = uvicorn.Server(uvicorn.Config(app, host="127.0.0.1", port=0, log_level="warning"))
    thread = threading.Thread(target=server.run, daemon=True)
    thread.start()
    deadline = time.monotonic() + 5
    while not server.started:
        assert time.monotonic() < deadline, "uvicorn did not start"
        time.sleep(0.01)
    port = server.servers[0].sockets[0].getsockname()[1]
    yield f"http://127.0.0.1:{port}"
    server.should_exit = True
    thread.join(5)


def read_events(lines: Iterator[str]) -> Iterator[tuple[str, dict[str, object]]]:
    """(SSE event name, parsed data) per event; comment lines (pings) are skipped."""
    name = ""
    for line in lines:
        if line.startswith("event: "):
            name = line.removeprefix("event: ")
        elif line.startswith("data: "):
            yield name, json.loads(line.removeprefix("data: "))


def test_stream_starts_with_snapshot_then_heartbeats_and_readings(base_url: str) -> None:
    seen: list[str] = []
    with httpx.stream("GET", f"{base_url}/v1/events", timeout=5) as response:
        assert response.headers["content-type"].startswith("text/event-stream")
        for name, data in read_events(response.iter_lines()):
            assert data["type"] == name
            hw_event.validate_python(data)  # every frame matches the contract
            seen.append(name)
            if "heartbeat" in seen and "sensors.reading" in seen:
                break
    assert seen[0] == "snapshot"


def test_command_shows_up_on_the_stream(base_url: str) -> None:
    with httpx.stream("GET", f"{base_url}/v1/events", timeout=5) as response:
        events = read_events(response.iter_lines())
        assert next(events)[0] == "snapshot"
        ack = httpx.post(f"{base_url}/v1/lights/set", json={"gang": "rear", "on": True})
        assert ack.json() == {"ok": True}
        for name, data in events:
            if name == "lights.state":
                assert data["data"] == {"gang": "rear", "on": True}
                break
