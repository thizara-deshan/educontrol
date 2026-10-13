"""Shared hw contract pieces. Mirrors packages/contracts/src/hw/common.ts and the hw parts of
packages/contracts/src/common.ts (Level, Timestamp). Field names are identical to zod.
"""

import logging
from collections.abc import Awaitable
from datetime import UTC, datetime
from typing import Annotated, Literal

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field

logger = logging.getLogger("hw")

INTAKE_PENDING = "hardware intake pending"


def utc_now() -> datetime:
    return datetime.now(UTC)


class HwModel(BaseModel):
    """Base of every contract model: unknown fields are rejected, like zod strictObject."""

    model_config = ConfigDict(extra="forbid")


Timestamp = AwareDatetime
Level = Annotated[int, Field(ge=0, le=100)]

HwModule = Literal[
    "lights",
    "projector_power",
    "ir",
    "hdmi",
    "projection_screen",
    "audio",
    "sensors",
    "zigbee_status",
]
HwDriverKind = Literal["fake", "real"]
HwErrorCode = Literal["device_offline", "timeout", "transport", "invalid"]


class HwError(HwModel):
    code: HwErrorCode
    message: str


class HwAckOk(HwModel):
    ok: Literal[True]


class HwAckError(HwModel):
    ok: Literal[False]
    error: HwError


# "Accepted by the transport", not "state changed". State changes arrive only as events.
HwAck = Annotated[HwAckOk | HwAckError, Field(discriminator="ok")]

ACK_OK = HwAckOk(ok=True)


def ack_error(code: HwErrorCode, message: str) -> HwAckError:
    return HwAckError(ok=False, error=HwError(code=code, message=message))


class HwHealthModules(HwModel):
    lights: HwDriverKind
    projector_power: HwDriverKind
    ir: HwDriverKind
    hdmi: HwDriverKind
    projection_screen: HwDriverKind
    audio: HwDriverKind
    sensors: HwDriverKind
    zigbee_status: HwDriverKind


class HwHealth(HwModel):
    ok: bool
    mode: HwDriverKind
    modules: HwHealthModules


class HwEnvelope(HwModel):
    """Base of every SSE event `{type, at, data}`. Subclasses narrow `type` and add `data`."""

    type: str
    at: Timestamp = Field(default_factory=utc_now)


class HwErrorData(HwModel):
    module: HwModule
    code: HwErrorCode
    message: str


class HwHeartbeatData(HwModel):
    pass


class HwErrorEvent(HwEnvelope):
    type: Literal["hw.error"] = "hw.error"
    data: HwErrorData


class HwHeartbeatEvent(HwEnvelope):
    type: Literal["heartbeat"] = "heartbeat"
    data: HwHeartbeatData = Field(default_factory=HwHeartbeatData)


async def guard(module: HwModule, command: Awaitable[HwAck]) -> HwAck:
    """Await a driver command; a driver exception becomes a `transport` ack instead of a 500."""
    try:
        return await command
    except NotImplementedError as exc:
        return ack_error("transport", f"{module}: {exc}")
    except Exception as exc:
        logger.exception("%s driver failed", module)
        return ack_error("transport", f"{module}: {type(exc).__name__}: {exc}")
