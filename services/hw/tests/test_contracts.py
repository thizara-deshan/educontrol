from datetime import UTC

import pytest
from pydantic import TypeAdapter, ValidationError

from app.contracts import (
    ACK_OK,
    HwAck,
    HwAckError,
    HwAckOk,
    HwError,
    HwHeartbeatEvent,
    ack_error,
    guard,
)

ack = TypeAdapter(HwAck)


def test_ack_parses_both_variants() -> None:
    assert ack.validate_python({"ok": True}) == HwAckOk(ok=True)
    parsed = ack.validate_python({"ok": False, "error": {"code": "timeout", "message": "late"}})
    assert parsed == HwAckError(ok=False, error=HwError(code="timeout", message="late"))


def test_models_reject_unknown_fields() -> None:
    with pytest.raises(ValidationError):
        ack.validate_python({"ok": True, "extra": 1})


def test_ack_error_builds_the_wire_shape() -> None:
    assert ack_error("device_offline", "r101_lights is offline").model_dump() == {
        "ok": False,
        "error": {"code": "device_offline", "message": "r101_lights is offline"},
    }


def test_envelope_stamps_aware_utc_time() -> None:
    event = HwHeartbeatEvent()
    assert event.at.tzinfo is UTC
    dumped = event.model_dump(mode="json")
    assert dumped["type"] == "heartbeat"
    assert dumped["data"] == {}
    assert dumped["at"].endswith("Z")


async def test_guard_passes_acks_through() -> None:
    async def ok() -> HwAckOk:
        return ACK_OK

    assert await guard("lights", ok()) == ACK_OK


async def test_guard_turns_intake_stub_into_transport_error() -> None:
    async def stub() -> HwAckOk:
        raise NotImplementedError("hardware intake pending")

    assert await guard("lights", stub()) == ack_error(
        "transport", "lights: hardware intake pending"
    )


async def test_guard_turns_driver_crash_into_transport_error() -> None:
    async def broken() -> HwAckOk:
        raise RuntimeError("serial port gone")

    assert await guard("hdmi", broken()) == ack_error(
        "transport", "hdmi: RuntimeError: serial port gone"
    )
