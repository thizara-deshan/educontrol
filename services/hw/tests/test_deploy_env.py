"""M10: /etc/eduscope/hw.env is created from deploy/pi/env/hw.env.example; it must stay valid."""

from pathlib import Path

import pytest

from app.config import Settings
from app.registry import driver_kinds

EXAMPLE = Path(__file__).resolve().parents[3] / "deploy" / "pi" / "env" / "hw.env.example"


def test_hw_env_example_is_real_zigbee_modules_on_loopback() -> None:
    settings = Settings(_env_file=EXAMPLE)
    assert settings.mode == "fake"
    assert settings.host == "127.0.0.1"
    real = [module for module, kind in driver_kinds(settings).items() if kind == "real"]
    assert real == ["ir", "sensors", "zigbee_status"]  # H01, H03, H05; each Hxx adds its module
    assert settings.motion_timeout_s == 15


def test_hw_env_example_has_no_placeholders() -> None:
    assert "@" not in EXAMPLE.read_text(encoding="utf-8")


@pytest.mark.parametrize(
    "line", ["HW_MODE=fake", "HW_DRIVERS=ir=real,sensors=real,zigbee_status=real"]
)
def test_hw_env_example_sets(line: str) -> None:
    assert line in EXAMPLE.read_text(encoding="utf-8").splitlines()
