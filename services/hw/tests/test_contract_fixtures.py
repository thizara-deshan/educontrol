"""Every packages/contracts/fixtures/hw/*.json parses with its pydantic model and round-trips
unchanged (ARCHITECTURE §3.4). File name → model rule: packages/contracts/fixtures/README.md."""

import json
from pathlib import Path
from types import ModuleType

import pytest
from pydantic import TypeAdapter

from app import contracts, snapshot
from app.modules.audio import schemas as audio
from app.modules.hdmi import schemas as hdmi
from app.modules.ir import schemas as ir
from app.modules.lights import schemas as lights
from app.modules.projection_screen import schemas as projection_screen
from app.modules.projector_power import schemas as projector_power
from app.modules.sensors import schemas as sensors
from app.modules.zigbee_status import schemas as zigbee_status

FIXTURES = Path(__file__).resolve().parents[3] / "packages" / "contracts" / "fixtures" / "hw"
SCHEMA_MODULES: tuple[ModuleType, ...] = (
    contracts,
    snapshot,
    lights,
    projector_power,
    ir,
    hdmi,
    projection_screen,
    audio,
    sensors,
    zigbee_status,
)


def pascal(part: str) -> str:
    return "".join(word.capitalize() for word in part.split("_"))


def schema_for(file_name: str) -> tuple[str, str | None]:
    """(schema name, expected event type or None) for a fixture file name."""
    parts = file_name.removesuffix(".json").split(".")
    match parts:
        case ["event", *event_type] if event_type:
            return "HwEvent", ".".join(event_type)
        case ["request", module, action]:
            return f"Hw{pascal(module)}{pascal(action)}Request", None
        case ["response", name] | ["response", name, _]:
            return f"Hw{pascal(name)}", None
    raise ValueError(f"{file_name} does not follow the fixture naming rule")


def find_schema(name: str) -> object:
    for module in SCHEMA_MODULES:
        if hasattr(module, name):
            return getattr(module, name)
    raise LookupError(f"no pydantic model named {name} (zod and pydantic names must match)")


FIXTURE_FILES = sorted(FIXTURES.glob("*.json"))


def test_naming_rule_examples() -> None:
    assert schema_for("event.lights.state.json") == ("HwEvent", "lights.state")
    assert schema_for("request.zigbee_status.permit_join.json") == (
        "HwZigbeeStatusPermitJoinRequest",
        None,
    )
    assert schema_for("response.ack.error.json") == ("HwAck", None)
    assert schema_for("response.ir_learn_result.timeout.json") == ("HwIrLearnResult", None)


def test_fixture_directory_is_found() -> None:
    assert len(FIXTURE_FILES) >= 31, f"expected the M01 fixtures in {FIXTURES}"


@pytest.mark.parametrize("path", FIXTURE_FILES, ids=lambda path: path.name)
def test_fixture_round_trips(path: Path) -> None:
    name, event_type = schema_for(path.name)
    adapter: TypeAdapter[object] = TypeAdapter(find_schema(name))
    raw = json.loads(path.read_text())
    parsed = adapter.validate_python(raw)
    assert adapter.dump_python(parsed, mode="json") == raw
    if event_type is not None:
        assert raw["type"] == event_type
