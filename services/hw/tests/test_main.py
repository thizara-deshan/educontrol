import json
from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import create_app, require_loopback
from tests.helpers import make_settings

FIXTURES = Path(__file__).resolve().parents[3] / "packages" / "contracts" / "fixtures" / "hw"


@pytest.fixture
def client() -> Iterator[TestClient]:
    with TestClient(create_app(make_settings())) as http:
        yield http


@pytest.mark.parametrize("host", ["127.0.0.1", "127.0.0.2", "::1", "localhost"])
def test_loopback_hosts_are_accepted(host: str) -> None:
    require_loopback(host)


@pytest.mark.parametrize("host", ["0.0.0.0", "192.168.1.20", "::", "r-101.local"])
def test_other_hosts_refuse_to_start(host: str) -> None:
    with pytest.raises(SystemExit, match="HW_HOST must be a loopback address"):
        create_app(make_settings(host=host))


def test_bad_driver_override_refuses_to_start() -> None:
    with pytest.raises(SystemExit, match="HW_DRIVERS"):
        create_app(make_settings(drivers="lights=on"))


def test_health_in_fake_mode_matches_the_contract_fixture(client: TestClient) -> None:
    expected = json.loads((FIXTURES / "response.health.json").read_text())
    assert client.get("/v1/health").json() == expected


def test_snapshot_has_every_module(client: TestClient) -> None:
    body = client.get("/v1/snapshot").json()
    assert body["lights"] == {"front": True, "rear": False}
    assert body["hdmi"] == {"input": "podium_pc"}
    assert body["projection_screen"] == {"position": "lowered"}
    assert body["ir"]["blaster"] == {"online": True, "lqi": 196}
    assert len(body["zigbee"]["nodes"]) == 5
    assert len(body["sensors"]) == 4


def test_commands_change_the_snapshot(client: TestClient) -> None:
    ack = client.post("/v1/lights/set", json={"gang": "rear", "on": True})
    assert ack.status_code == 200
    assert ack.json() == {"ok": True}
    assert client.get("/v1/snapshot").json()["lights"]["rear"] is True


def test_invalid_body_is_422(client: TestClient) -> None:
    assert client.post("/v1/lights/set", json={"gang": "middle"}).status_code == 422


def test_real_lights_answer_transport_error_without_crashing() -> None:
    with TestClient(create_app(make_settings(drivers="lights=real"))) as http:
        assert http.get("/v1/health").json()["modules"]["lights"] == "real"
        ack = http.post("/v1/lights/set", json={"gang": "rear", "on": True})
        assert ack.status_code == 200
        assert ack.json() == {
            "ok": False,
            "error": {"code": "transport", "message": "lights: hardware intake pending"},
        }
        assert http.get("/v1/snapshot").json()["lights"] == {"front": None, "rear": None}


def test_real_mode_has_no_fake_routes() -> None:
    with TestClient(create_app(make_settings(mode="real"))) as http:
        assert http.get("/v1/health").json()["mode"] == "real"
        assert http.post("/v1/_fake/lights/by_hand").status_code == 404
