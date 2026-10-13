from fastapi import APIRouter

from app.contracts import HwAck
from app.modules.projector_power.schemas import HwProjectorPowerRelayRequest
from app.modules.projector_power.service import ProjectorPowerService


def build_router(service: ProjectorPowerService) -> APIRouter:
    router = APIRouter(prefix="/v1/projector_power", tags=["projector_power"])

    @router.post("/relay")
    async def relay(body: HwProjectorPowerRelayRequest) -> HwAck:
        return await service.relay(body)

    return router
