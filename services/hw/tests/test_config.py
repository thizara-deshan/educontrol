import pytest
from pydantic import ValidationError

from app.config import Settings


def test_defaults_are_fake_on_loopback() -> None:
    settings = Settings(_env_file=None)
    assert settings.mode == "fake"
    assert settings.host == "127.0.0.1"
    assert settings.heartbeat_s == 5.0
    assert settings.fake_time_scale == 1.0
    assert [node.friendly_name for node in settings.zigbee_nodes] == [
        "r101_lights",
        "r101_proj_plug",
        "r101_temp",
        "r101_motion",
        "r101_door",
    ]
    assert settings.coordinator.model == "ZG-808Z"


def test_reads_hw_prefixed_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("HW_MODE", "real")
    monkeypatch.setenv("HW_DRIVERS", "lights=fake")
    monkeypatch.setenv("HW_FAKE_TIME_SCALE", "60")
    monkeypatch.setenv("HW_TEMP_NODE", "r102_temp")
    settings = Settings(_env_file=None)
    assert settings.mode == "real"
    assert settings.drivers == "lights=fake"
    assert settings.fake_time_scale == 60.0
    assert settings.temp_node == "r102_temp"


def test_ignores_unprefixed_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("MODE", "real")
    assert Settings(_env_file=None).mode == "fake"


def test_node_list_comes_from_json_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv(
        "HW_ZIGBEE_NODES",
        '[{"ieee":"0x01","friendly_name":"r102_lights","model":"ZBM5-2C-86W",'
        '"role":"router","power_source":"mains","lqi":200,"battery_pct":null}]',
    )
    nodes = Settings(_env_file=None).zigbee_nodes
    assert [node.friendly_name for node in nodes] == ["r102_lights"]


def test_rejects_bad_values() -> None:
    with pytest.raises(ValidationError):
        Settings(_env_file=None, mode="simulated")
    with pytest.raises(ValidationError):
        Settings(_env_file=None, fake_time_scale=0)
