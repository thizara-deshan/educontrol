"""lights contract. Mirrors packages/contracts/src/hw (HwLightsSetRequest, HwLightsStateData)."""

from typing import Literal

from app.contracts import HwEnvelope, HwModel

LightGang = Literal["front", "rear"]


class HwLightsSetRequest(HwModel):
    gang: LightGang
    on: bool


class HwLightsStateData(HwModel):
    gang: LightGang
    on: bool


class HwLightsStateEvent(HwEnvelope):
    type: Literal["lights.state"] = "lights.state"
    data: HwLightsStateData


class HwLightsSnapshot(HwModel):
    """HwSnapshot.lights. None = not reported yet."""

    front: bool | None
    rear: bool | None
