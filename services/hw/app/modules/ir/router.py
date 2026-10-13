from fastapi import APIRouter

from app.contracts import HwAck
from app.modules.ir.schemas import HwIrLearnRequest, HwIrLearnResult, HwIrSendRequest
from app.modules.ir.service import IrService


def build_router(service: IrService) -> APIRouter:
    router = APIRouter(prefix="/v1/ir", tags=["ir"])

    @router.post("/send")
    async def send(body: HwIrSendRequest) -> HwAck:
        return await service.send(body)

    @router.post("/learn")
    async def learn(body: HwIrLearnRequest) -> HwIrLearnResult:
        return await service.learn(body)

    @router.post("/learn/cancel")
    async def cancel_learn() -> HwAck:
        return await service.cancel_learn()

    return router
