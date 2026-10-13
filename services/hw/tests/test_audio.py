from app.contracts import ACK_OK, ack_error
from app.events import EventBus, Subscription
from app.modules.audio.driver_fake import FakeAudioDriver
from app.modules.audio.driver_real import RealAudioDriver
from app.modules.audio.router import build_router
from app.modules.audio.schemas import (
    HwAudioChannelState,
    HwAudioLevelRequest,
    HwAudioMuteRequest,
    HwAudioSnapshot,
    HwAudioStateData,
    HwAudioStateEvent,
)
from app.modules.audio.service import AudioService
from tests.helpers import drain, http_client, make_settings, next_event


async def start_fake() -> tuple[AudioService, Subscription]:
    bus = EventBus(64)
    sub = bus.subscribe()
    service = AudioService(FakeAudioDriver(make_settings()), bus)
    await service.start()
    return service, sub


async def test_fake_starts_with_screenshot_levels() -> None:
    service, _ = await start_fake()
    assert service.snapshot() == HwAudioSnapshot(
        mic=HwAudioChannelState(level=62, muted=False),
        pc=HwAudioChannelState(level=38, muted=False),
    )


async def test_level_keeps_mute_and_mute_keeps_level() -> None:
    service, sub = await start_fake()
    drain(sub)
    assert await service.mute(HwAudioMuteRequest(channel="pc", muted=True)) == ACK_OK
    assert (await next_event(sub, HwAudioStateEvent)).data == HwAudioStateData(
        channel="pc", level=38, muted=True
    )
    assert await service.level(HwAudioLevelRequest(channel="pc", level=50)) == ACK_OK
    assert (await next_event(sub, HwAudioStateEvent)).data == HwAudioStateData(
        channel="pc", level=50, muted=True
    )
    assert service.snapshot().pc == HwAudioChannelState(level=50, muted=True)
    assert service.snapshot().mic == HwAudioChannelState(level=62, muted=False)


async def test_real_driver_answers_transport_error() -> None:
    service = AudioService(RealAudioDriver(make_settings()), EventBus(8))
    await service.start()
    ack = await service.level(HwAudioLevelRequest(channel="mic", level=10))
    assert ack == ack_error("transport", "audio: hardware intake pending")
    assert service.snapshot() == HwAudioSnapshot(mic=None, pc=None)


async def test_routes() -> None:
    service, _ = await start_fake()
    async with http_client(build_router(service)) as http:
        level = await http.post("/v1/audio/level", json={"channel": "mic", "level": 70})
        assert level.json() == {"ok": True}
        mute = await http.post("/v1/audio/mute", json={"channel": "mic", "muted": True})
        assert mute.json() == {"ok": True}
        too_loud = await http.post("/v1/audio/level", json={"channel": "mic", "level": 101})
        assert too_loud.status_code == 422
    assert service.snapshot().mic == HwAudioChannelState(level=70, muted=True)
