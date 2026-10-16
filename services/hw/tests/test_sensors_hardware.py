"""[ON PI] RealSensorsDriver against the real broker, zigbee2mqtt and the paired sensors.

Run on the R-101 Pi only: `uv run --directory services/hw pytest -m hardware`. The sensors report
only on change, so this checks the link (broker connected, node online), not a reading:
`r101_temp` (SNZB-02P, H03), `r101_motion` (SNZB-03P) and `r101_door` (SNZB-04PR2, H04).
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


@pytest.mark.parametrize("node", ["temp_node", "motion_node", "door_node"])
async def test_sensor_is_online_within_5_s(node: str) -> None:
    settings = Settings(_env_file=None)  # 127.0.0.1:1883, zigbee2mqtt, r101_temp/motion/door
    mqtt = MqttTransport(settings)
    service = SensorsService(RealSensorsDriver(settings, mqtt), EventBus(64))
    online = asyncio.Event()

    def on_availability(payload: object) -> None:
        if payload == ONLINE:
            online.set()

    # Retained by zigbee2mqtt, so it arrives right after the subscribe.
    friendly_name = {
        "temp_node": settings.temp_node,
        "motion_node": settings.motion_node,
        "door_node": settings.door_node,
    }[node]
    availability = f"{settings.z2m_base_topic}/{friendly_name}/availability"
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
