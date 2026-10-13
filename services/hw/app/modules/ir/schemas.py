"""ir contract. Mirrors packages/contracts/src/hw (HwIrSendRequest, HwIrLearnRequest,
HwIrLearnResult, HwIrBlasterData, HwIrLearnStateData)."""

from typing import Annotated, Literal

from pydantic import Field

from app.contracts import HwEnvelope, HwModel

IrTransport = Literal["ir_zs06", "ir_mcu"]
IrCode = Annotated[str, Field(min_length=1)]  # opaque Tuya base64 [ASSUMED]
IrLearnStatus = Literal["listening", "captured", "timeout", "cancelled"]


class HwIrSendRequest(HwModel):
    transport: IrTransport
    code_format: Literal["tuya"]
    code: IrCode


class HwIrLearnRequest(HwModel):
    """Blocks up to timeout_s. POST /v1/ir/learn/cancel has no body."""

    transport: IrTransport
    timeout_s: int = Field(ge=1, le=60)


class HwIrLearnCaptured(HwModel):
    status: Literal["captured"]
    code_format: Literal["tuya"]
    code: IrCode


class HwIrLearnTimeout(HwModel):
    status: Literal["timeout"]


class HwIrLearnCancelled(HwModel):
    status: Literal["cancelled"]


HwIrLearnResult = Annotated[
    HwIrLearnCaptured | HwIrLearnTimeout | HwIrLearnCancelled, Field(discriminator="status")
]


class HwIrBlasterData(HwModel):
    online: bool
    lqi: int | None = Field(ge=0, le=255)


class HwIrLearnStateData(HwModel):
    status: IrLearnStatus


class HwIrBlasterEvent(HwEnvelope):
    type: Literal["ir.blaster"] = "ir.blaster"
    data: HwIrBlasterData


class HwIrLearnEvent(HwEnvelope):
    type: Literal["ir.learn"] = "ir.learn"
    data: HwIrLearnStateData


class HwIrSnapshot(HwModel):
    """HwSnapshot.ir. None = blaster not reported yet."""

    blaster: HwIrBlasterData | None
