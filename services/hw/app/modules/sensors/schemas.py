"""sensors contract. Mirrors packages/contracts/src/hw (HwSensorReadingData, HwSensorSample)."""

from typing import Annotated, Literal

from pydantic import Field

from app.contracts import HwEnvelope, HwModel, Timestamp


class HwTemperatureReading(HwModel):
    node: str
    kind: Literal["temperature"]
    value: float


class HwHumidityReading(HwModel):
    node: str
    kind: Literal["humidity"]
    value: int = Field(ge=0, le=100)


class HwOccupancyReading(HwModel):
    node: str
    kind: Literal["occupancy"]
    value: Literal["detected", "clear"]


class HwContactReading(HwModel):
    node: str
    kind: Literal["contact"]
    value: Literal["open", "closed"]


HwSensorReadingData = Annotated[
    HwTemperatureReading | HwHumidityReading | HwOccupancyReading | HwContactReading,
    Field(discriminator="kind"),
]


class HwSensorSample(HwModel):
    at: Timestamp
    reading: HwSensorReadingData


class HwSensorsReadingEvent(HwEnvelope):
    type: Literal["sensors.reading"] = "sensors.reading"
    data: HwSensorReadingData
