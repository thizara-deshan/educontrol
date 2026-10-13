"""projector_power contract. Mirrors packages/contracts/src/hw (HwProjectorPowerRelayRequest,
HwRelayStateData, HwPowerReadingData, HwPowerSample)."""

from typing import Annotated, Literal

from pydantic import Field

from app.contracts import HwEnvelope, HwModel, Timestamp

NonNegative = Annotated[float, Field(ge=0)]


class HwProjectorPowerRelayRequest(HwModel):
    on: bool


class HwRelayStateData(HwModel):
    on: bool


class HwPowerReadingData(HwModel):
    watts: NonNegative
    volts: NonNegative
    energy_kwh_total: NonNegative  # core-api derives kwh_today


class HwPowerSample(HwModel):
    at: Timestamp
    watts: NonNegative
    volts: NonNegative
    energy_kwh_total: NonNegative


class HwProjectorPowerRelayEvent(HwEnvelope):
    type: Literal["projector_power.relay"] = "projector_power.relay"
    data: HwRelayStateData


class HwProjectorPowerReadingEvent(HwEnvelope):
    type: Literal["projector_power.reading"] = "projector_power.reading"
    data: HwPowerReadingData


class HwProjectorPowerSnapshot(HwModel):
    """HwSnapshot.projector_power. None = not reported yet."""

    relay: bool | None
    reading: HwPowerSample | None
