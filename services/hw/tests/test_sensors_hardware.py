"""[ON PI] RealSensorsDriver against the real broker, zigbee2mqtt and the paired SNZB-02P.

Run on the R-101 Pi only: `uv run --directory services/hw pytest -m hardware`. The sensor reports
only on change, so this checks the link (broker connected, `r101_temp` online), not a reading.
"""

import asyncio

import pytest

from app.config import Settings
from app.events import EventBus
from app.modules.sensors.driver_real import RealSensorsDriver
from app.modules.sensors.service import SensorsService
from app.transports.mqtt import MqttTransport

pytestmark = pytest.mark.hardware

ONLINE = {"state": "online"}  # zigbee2mqtt 2.x availability payload


async def test_climate_sensor_is_online_within_5_s() -> None:
    settings = Settings(_env_file=None)  # 127.0.0.1:1883, zigbee2mqtt, r101_temp
    mqtt = MqttTransport(settings)
    service = SensorsService(RealSensorsDriver(settings, mqtt), EventBus(64))
    online = asyncio.Event()

    def on_availability(payload: object) -> None:
        if payload == ONLINE:
            online.set()

    # Retained by zigbee2mqtt, so it arrives right after the subscribe.
    availability = f"{settings.z2m_base_topic}/{settings.temp_node}/availability"
    mqtt.subscribe(availability, on_availability)
    await service.start()
    await mqtt.start()
    try:
        async with asyncio.timeout(5):
            await online.wait()
        assert mqtt.connected
    finally:
        await mqtt.stop()
        await service.stop()
