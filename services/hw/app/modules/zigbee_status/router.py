from fastapi import APIRouter

from app.contracts import HwAck
from app.modules.zigbee_status.schemas import HwZigbeeStatusPermitJoinRequest
from app.modules.zigbee_status.service import ZigbeeStatusService


def build_router(service: ZigbeeStatusService) -> APIRouter:
    router = APIRouter(prefix="/v1/zigbee_status", tags=["zigbee_status"])

    @router.post("/permit_join")
    async def permit_join(body: HwZigbeeStatusPermitJoinRequest) -> HwAck:
        return await service.permit_join(body)

    return router
