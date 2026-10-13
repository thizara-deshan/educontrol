from fastapi import APIRouter

from app.contracts import HwAck
from app.modules.hdmi.schemas import HwHdmiSelectRequest
from app.modules.hdmi.service import HdmiService


def build_router(service: HdmiService) -> APIRouter:
    router = APIRouter(prefix="/v1/hdmi", tags=["hdmi"])

    @router.post("/select")
    async def select(body: HwHdmiSelectRequest) -> HwAck:
        return await service.select(body)

    return router
