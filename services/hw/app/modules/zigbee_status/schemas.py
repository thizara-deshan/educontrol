"""zigbee_status contract. Mirrors packages/contracts/src/hw (HwZigbeeStatusPermitJoinRequest,
HwZigbeeNode, HwCoordinator, HwMeshData). Events are named `zigbee.*`."""

from typing import Literal

from pydantic import Field

from app.contracts import HwEnvelope, HwModel, Timestamp


class HwZigbeeStatusPermitJoinRequest(HwModel):
    seconds: int = Field(ge=0, le=254)  # 0 closes joining


class HwZigbeeNode(HwModel):
    ieee: str
    friendly_name: str
    model: str
    role: Literal["router", "end_device"]
    power_source: Literal["mains", "battery"]
    lqi: int | None = Field(ge=0, le=255)
    battery_pct: int | None = Field(ge=0, le=100)
    last_seen: Timestamp | None
    online: bool


class HwCoordinator(HwModel):
    model: str
    chipset: str
    firmware: str
    channel: int = Field(ge=11, le=26)
    tx_power_dbm: float
    port: str
    antenna: str
    status: Literal["online", "offline", "starting"]


class HwMeshData(HwModel):
    """Counts are derived by core-api from the node list."""

    joining_until: Timestamp | None


class HwZigbeeNodeEvent(HwEnvelope):
    type: Literal["zigbee.node"] = "zigbee.node"
    data: HwZigbeeNode


class HwZigbeeCoordinatorEvent(HwEnvelope):
    type: Literal["zigbee.coordinator"] = "zigbee.coordinator"
    data: HwCoordinator


class HwZigbeeMeshEvent(HwEnvelope):
    type: Literal["zigbee.mesh"] = "zigbee.mesh"
    data: HwMeshData


class HwZigbeeSnapshot(HwModel):
    """HwSnapshot.zigbee."""

    coordinator: HwCoordinator | None
    nodes: list[HwZigbeeNode]
    joining_until: Timestamp | None
