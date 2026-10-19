from fastapi import APIRouter

from app.contracts import HwAck
from app.modules.plug.schemas import HwPlugSetRequest
from app.modules.plug.service import PlugService


def build_router(service: PlugService) -> APIRouter:
    router = APIRouter(prefix="/v1/plug", tags=["plug"])

    @router.post("/set")
    async def set_relay(body: HwPlugSetRequest) -> HwAck:
        return await service.set(body)

    return router
