from fastapi import APIRouter

from app.contracts import HwAck
from app.modules.audio.schemas import HwAudioLevelRequest, HwAudioMuteRequest
from app.modules.audio.service import AudioService


def build_router(service: AudioService) -> APIRouter:
    router = APIRouter(prefix="/v1/audio", tags=["audio"])

    @router.post("/level")
    async def level(body: HwAudioLevelRequest) -> HwAck:
        return await service.level(body)

    @router.post("/mute")
    async def mute(body: HwAudioMuteRequest) -> HwAck:
        return await service.mute(body)

    return router
