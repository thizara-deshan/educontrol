"""HwSnapshot and the HwEvent union. Mirrors packages/contracts/src/hw/snapshot.ts and events.ts.

Lives apart from app/contracts.py because it needs every module's schemas.
"""

from typing import Annotated, Literal

from pydantic import Field

from app.contracts import HwEnvelope, HwErrorEvent, HwHeartbeatEvent, HwModel
from app.modules.audio.schemas import HwAudioSnapshot, HwAudioStateEvent
from app.modules.hdmi.schemas import HwHdmiSnapshot, HwHdmiStateEvent
from app.modules.ir.schemas import HwIrBlasterEvent, HwIrLearnEvent, HwIrSnapshot
from app.modules.lights.schemas import HwLightsSnapshot, HwLightsStateEvent
from app.modules.projection_screen.schemas import (
    HwProjectionScreenSnapshot,
    HwProjectionScreenStateEvent,
)
from app.modules.projector_power.schemas import (
    HwProjectorPowerReadingEvent,
    HwProjectorPowerRelayEvent,
    HwProjectorPowerSnapshot,
)
from app.modules.sensors.schemas import HwSensorSample, HwSensorsReadingEvent
from app.modules.zigbee_status.schemas import (
    HwZigbeeCoordinatorEvent,
    HwZigbeeMeshEvent,
    HwZigbeeNodeEvent,
    HwZigbeeSnapshot,
)


class HwSnapshot(HwModel):
    """GET /v1/snapshot and the first SSE event. null = not known yet."""

    lights: HwLightsSnapshot
    projector_power: HwProjectorPowerSnapshot
    hdmi: HwHdmiSnapshot
    projection_screen: HwProjectionScreenSnapshot
    audio: HwAudioSnapshot
    sensors: list[HwSensorSample]  # latest reading per (node, kind)
    zigbee: HwZigbeeSnapshot
    ir: HwIrSnapshot


class HwSnapshotEvent(HwEnvelope):
    type: Literal["snapshot"] = "snapshot"
    data: HwSnapshot


# One SSE event from GET /v1/events. SSE `event:` equals `type`.
HwEvent = Annotated[
    HwSnapshotEvent
    | HwLightsStateEvent
    | HwProjectorPowerRelayEvent
    | HwProjectorPowerReadingEvent
    | HwHdmiStateEvent
    | HwProjectionScreenStateEvent
    | HwAudioStateEvent
    | HwSensorsReadingEvent
    | HwZigbeeNodeEvent
    | HwZigbeeCoordinatorEvent
    | HwZigbeeMeshEvent
    | HwIrBlasterEvent
    | HwIrLearnEvent
    | HwErrorEvent
    | HwHeartbeatEvent,
    Field(discriminator="type"),
]
