from fastapi import APIRouter

from app.contracts import HwAck
from app.modules.lights.schemas import HwLightsSetRequest
from app.modules.lights.service import LightsService


def build_router(service: LightsService) -> APIRouter:
    router = APIRouter(prefix="/v1/lights", tags=["lights"])

    @router.post("/set")
    async def set_gang(body: HwLightsSetRequest) -> HwAck:
        return await service.set(body)

    return router
