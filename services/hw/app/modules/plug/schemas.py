"""plug contract (D-34). Mirrors packages/contracts/src/hw (HwPlugSetRequest, HwPlugStateData)."""

from typing import Annotated, Literal

from pydantic import Field

from app.contracts import HwEnvelope, HwModel

NonNegative = Annotated[float, Field(ge=0)]


class HwPlugSetRequest(HwModel):
    on: bool


class HwPlugStateData(HwModel):
    """The smart plug's full state as last reported; None = not reported yet."""

    online: bool
    on: bool | None
    watts: NonNegative | None
    volts: NonNegative | None
    amps: NonNegative | None
    kwh_today: NonNegative | None


class HwPlugStateEvent(HwEnvelope):
    type: Literal["plug.state"] = "plug.state"
    data: HwPlugStateData
