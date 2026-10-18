from app.contracts import ACK_OK
from app.events import EventBus, Subscription
from app.modules.hdmi.driver_fake import FakeHdmiDriver
from app.modules.hdmi.router import build_router
from app.modules.hdmi.schemas import HwHdmiSelectRequest, HwHdmiSnapshot, HwHdmiStateEvent
from app.modules.hdmi.service import HdmiService
from tests.helpers import drain, http_client, make_settings, next_event


async def start_fake() -> tuple[HdmiService, Subscription]:
    bus = EventBus(64)
    sub = bus.subscribe()
    service = HdmiService(FakeHdmiDriver(make_settings()), bus)
    await service.start()
    return service, sub


async def test_fake_starts_on_podium_pc() -> None:
    service, _ = await start_fake()
    assert service.snapshot() == HwHdmiSnapshot(input="podium_pc")


async def test_select_is_echoed_as_state() -> None:
    service, sub = await start_fake()
    drain(sub)
    assert await service.select(HwHdmiSelectRequest(input="smart_board")) == ACK_OK
    assert (await next_event(sub, HwHdmiStateEvent)).data.input == "smart_board"
    assert service.snapshot() == HwHdmiSnapshot(input="smart_board")


async def test_route() -> None:
    service, _ = await start_fake()
    async with http_client(build_router(service)) as http:
        ok = await http.post("/v1/hdmi/select", json={"input": "smart_board"})
        assert ok.json() == {"ok": True}
        assert (await http.post("/v1/hdmi/select", json={"input": "vga"})).status_code == 422
