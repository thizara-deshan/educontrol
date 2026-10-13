from fastapi import APIRouter

from app.contracts import HwAck
from app.modules.projection_screen.schemas import HwProjectionScreenMoveRequest
from app.modules.projection_screen.service import ProjectionScreenService


def build_router(service: ProjectionScreenService) -> APIRouter:
    router = APIRouter(prefix="/v1/projection_screen", tags=["projection_screen"])

    @router.post("/move")
    async def move(body: HwProjectionScreenMoveRequest) -> HwAck:
        return await service.move(body)

    return router
