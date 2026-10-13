"""projection_screen contract. Mirrors packages/contracts/src/hw (HwProjectionScreenMoveRequest,
HwScreenStateData, HwScreenPosition)."""

from typing import Literal

from app.contracts import HwEnvelope, HwModel

HwScreenPosition = Literal["raised", "lowered", "moving", "unknown"]


class HwProjectionScreenMoveRequest(HwModel):
    to: Literal["raise", "lower"]


class HwScreenStateData(HwModel):
    position: HwScreenPosition


class HwProjectionScreenStateEvent(HwEnvelope):
    type: Literal["projection_screen.state"] = "projection_screen.state"
    data: HwScreenStateData


class HwProjectionScreenSnapshot(HwModel):
    """HwSnapshot.projection_screen. "unknown" = not reported yet."""

    position: HwScreenPosition
