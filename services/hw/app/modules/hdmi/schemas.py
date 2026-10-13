"""hdmi contract. Mirrors packages/contracts/src/hw (HwHdmiSelectRequest, HwHdmiStateData)."""

from typing import Literal

from app.contracts import HwEnvelope, HwModel

HdmiInput = Literal["podium_pc", "smart_board"]


class HwHdmiSelectRequest(HwModel):
    input: HdmiInput


class HwHdmiStateData(HwModel):
    input: HdmiInput


class HwHdmiStateEvent(HwEnvelope):
    type: Literal["hdmi.state"] = "hdmi.state"
    data: HwHdmiStateData


class HwHdmiSnapshot(HwModel):
    """HwSnapshot.hdmi. None = not reported yet."""

    input: HdmiInput | None
