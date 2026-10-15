"""[ON PI] RealIrDriver against the real broker, zigbee2mqtt and the paired ZS06 `r101_ir`.

Run on the R-101 Pi only: `uv run --directory services/hw pytest -m hardware`. hw-service may run
at the same time (the transport uses no fixed MQTT client id). No remote may be pressed during
the learn test.
"""

import asyncio
import logging
import time

import pytest

from app.config import Settings
from app.contracts import HwErrorEvent
from app.events import EventBus, Subscription
from app.modules.ir.driver_real import RealIrDriver
from app.modules.ir.schemas import HwIrLearnEvent, HwIrLearnRequest, HwIrLearnTimeout
from app.modules.ir.service import IrService
from app.transports.mqtt import MqttTransport
from tests.helpers import drain

pytestmark = pytest.mark.hardware


async def start_real() -> tuple[IrService, MqttTransport, Subscription]:
    settings = Settings(_env_file=None)  # 127.0.0.1:1883, zigbee2mqtt, r101_ir
    bus = EventBus(64)
    sub = bus.subscribe()
    mqtt = MqttTransport(settings)
    service = IrService(RealIrDriver(settings, mqtt), bus)
    await service.start()
    await mqtt.start()
    return service, mqtt, sub


async def stop_real(service: IrService, mqtt: MqttTransport) -> None:
    await mqtt.stop()
    await service.stop()


async def wait_online(service: IrService, within_s: float) -> None:
    async with asyncio.timeout(within_s):
        while True:
            blaster = service.snapshot().blaster
            if blaster is not None and blaster.online:
                return
            await asyncio.sleep(0.05)


async def test_blaster_is_online_within_5_s() -> None:
    service, mqtt, _ = await start_real()
    try:
        await wait_online(service, 5)
        blaster = service.snapshot().blaster
        assert blaster is not None
        assert blaster.lqi is None or 0 <= blaster.lqi <= 255
    finally:
        await stop_real(service, mqtt)


async def test_learn_with_no_press_times_out_cleanly(caplog: pytest.LogCaptureFixture) -> None:
    service, mqtt, sub = await start_real()
    try:
        await wait_online(service, 5)
        drain(sub)
        caplog.set_level(logging.WARNING, logger="hw")
        started = time.monotonic()
        result = await service.learn(HwIrLearnRequest(transport="ir_zs06", timeout_s=3))
        elapsed = time.monotonic() - started
        assert result == HwIrLearnTimeout(status="timeout")
        assert 3 <= elapsed < 6
        events = drain(sub)
        statuses = [e.data.status for e in events if isinstance(e, HwIrLearnEvent)]
        assert statuses == ["listening", "timeout"]
        assert not [e for e in events if isinstance(e, HwErrorEvent)]
        assert "could not switch learn mode off" not in caplog.text
    finally:
        await stop_real(service, mqtt)
