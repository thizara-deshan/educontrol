"""Builds every capability service with its fake or real driver (ARCHITECTURE §7.1, D-19).

`HW_MODE` picks the default; `HW_DRIVERS="lights=real,ir=fake"` overrides single modules.
"""

from dataclasses import dataclass, field
from typing import get_args

from fastapi import APIRouter

from app.config import Settings
from app.contracts import HwDriverKind, HwHealth, HwHealthModules, HwModule
from app.events import EventBus
from app.modules.audio import driver_fake as audio_fake
from app.modules.audio import router as audio_router
from app.modules.audio.driver_real import RealAudioDriver
from app.modules.audio.service import AudioService
from app.modules.hdmi import router as hdmi_router
from app.modules.hdmi.driver_fake import FakeHdmiDriver
from app.modules.hdmi.driver_real import RealHdmiDriver
from app.modules.hdmi.service import HdmiService
from app.modules.ir import driver_fake as ir_fake
from app.modules.ir import router as ir_router
from app.modules.ir.driver_real import RealIrDriver
from app.modules.ir.service import IrService
from app.modules.lights import driver_fake as lights_fake
from app.modules.lights import router as lights_router
from app.modules.lights.driver_real import RealLightsDriver
from app.modules.lights.service import LightsService
from app.modules.projection_screen import router as screen_router
from app.modules.projection_screen.driver_fake import FakeProjectionScreenDriver
from app.modules.projection_screen.driver_real import RealProjectionScreenDriver
from app.modules.projection_screen.service import ProjectionScreenService
from app.modules.projector_power import driver_fake as power_fake
from app.modules.projector_power import router as power_router
from app.modules.projector_power.driver_real import RealProjectorPowerDriver
from app.modules.projector_power.service import ProjectorPowerService
from app.modules.sensors import driver_fake as sensors_fake
from app.modules.sensors import router as sensors_router
from app.modules.sensors.driver_real import RealSensorsDriver
from app.modules.sensors.service import SensorsService
from app.modules.zigbee_status import driver_fake as zigbee_fake
from app.modules.zigbee_status import router as zigbee_router
from app.modules.zigbee_status.driver_real import RealZigbeeStatusDriver
from app.modules.zigbee_status.service import ZigbeeStatusService
from app.snapshot import HwSnapshot, HwSnapshotEvent
from app.transports.mqtt import MqttTransport

MODULES: tuple[HwModule, ...] = get_args(HwModule)
# Modules whose real driver talks to zigbee2mqtt; any of them real ⇒ the MQTT transport runs.
ZIGBEE_MODULES: tuple[HwModule, ...] = (
    "lights",
    "projector_power",
    "ir",
    "sensors",
    "zigbee_status",
)


def parse_driver_overrides(raw: str) -> dict[HwModule, HwDriverKind]:
    """ "lights=real, ir=fake" → {"lights": "real", "ir": "fake"}. Raises ValueError on typos."""
    overrides: dict[HwModule, HwDriverKind] = {}
    for item in raw.split(","):
        if not item.strip():
            continue
        name, _, kind = (part.strip() for part in item.partition("="))
        module = next((m for m in MODULES if m == name), None)
        driver = next((k for k in get_args(HwDriverKind) if k == kind), None)
        if module is None or driver is None:
            raise ValueError(
                f"HW_DRIVERS: bad entry {item.strip()!r}; expected <module>=fake|real with "
                f"<module> one of {', '.join(MODULES)}"
            )
        overrides[module] = driver
    return overrides


def driver_kinds(settings: Settings) -> dict[HwModule, HwDriverKind]:
    overrides = parse_driver_overrides(settings.drivers)
    return {module: overrides.get(module, settings.mode) for module in MODULES}


@dataclass
class Registry:
    settings: Settings
    lights: LightsService
    projector_power: ProjectorPowerService
    ir: IrService
    hdmi: HdmiService
    projection_screen: ProjectionScreenService
    audio: AudioService
    sensors: SensorsService
    zigbee_status: ZigbeeStatusService
    fake_routers: list[APIRouter] = field(default_factory=list)
    mqtt: MqttTransport | None = None

    def routers(self) -> list[APIRouter]:
        return [
            lights_router.build_router(self.lights),
            power_router.build_router(self.projector_power),
            ir_router.build_router(self.ir),
            hdmi_router.build_router(self.hdmi),
            screen_router.build_router(self.projection_screen),
            audio_router.build_router(self.audio),
            sensors_router.build_router(self.sensors),
            zigbee_router.build_router(self.zigbee_status),
            *self.fake_routers,
        ]

    async def start(self) -> None:
        await self.lights.start()
        await self.projector_power.start()
        await self.ir.start()
        await self.hdmi.start()
        await self.projection_screen.start()
        await self.audio.start()
        await self.sensors.start()
        await self.zigbee_status.start()
        # After the services: their drivers subscribe their topics in start().
        if self.mqtt is not None:
            await self.mqtt.start()

    async def stop(self) -> None:
        if self.mqtt is not None:
            await self.mqtt.stop()
        await self.zigbee_status.stop()
        await self.sensors.stop()
        await self.audio.stop()
        await self.projection_screen.stop()
        await self.hdmi.stop()
        await self.ir.stop()
        await self.projector_power.stop()
        await self.lights.stop()

    def health(self) -> HwHealth:
        modules = HwHealthModules(
            lights=self.lights.driver.kind,
            projector_power=self.projector_power.driver.kind,
            ir=self.ir.driver.kind,
            hdmi=self.hdmi.driver.kind,
            projection_screen=self.projection_screen.driver.kind,
            audio=self.audio.driver.kind,
            sensors=self.sensors.driver.kind,
            zigbee_status=self.zigbee_status.driver.kind,
        )
        return HwHealth(ok=True, mode=self.settings.mode, modules=modules)

    def snapshot(self) -> HwSnapshot:
        return HwSnapshot(
            lights=self.lights.snapshot(),
            projector_power=self.projector_power.snapshot(),
            hdmi=self.hdmi.snapshot(),
            projection_screen=self.projection_screen.snapshot(),
            audio=self.audio.snapshot(),
            sensors=self.sensors.snapshot(),
            zigbee=self.zigbee_status.snapshot(),
            ir=self.ir.snapshot(),
        )

    def snapshot_event(self) -> HwSnapshotEvent:
        return HwSnapshotEvent(data=self.snapshot())


def build_registry(settings: Settings, bus: EventBus) -> Registry:
    kinds = driver_kinds(settings)
    fake_routers: list[APIRouter] = []
    # Building the transport does no I/O; it only connects when the registry starts it.
    mqtt = MqttTransport(settings)
    zigbee_real = any(kinds[module] == "real" for module in ZIGBEE_MODULES)

    lights_fake_driver: lights_fake.FakeLightsDriver | None = None
    if kinds["lights"] == "fake":
        lights_fake_driver = lights_fake.FakeLightsDriver(settings)
        fake_routers.append(lights_fake.build_fake_router(lights_fake_driver))
    lights = LightsService(lights_fake_driver or RealLightsDriver(settings), bus)

    power_fake_driver: power_fake.FakeProjectorPowerDriver | None = None
    if kinds["projector_power"] == "fake":
        power_fake_driver = power_fake.FakeProjectorPowerDriver(settings)
        fake_routers.append(power_fake.build_fake_router(power_fake_driver))
    projector_power = ProjectorPowerService(
        power_fake_driver or RealProjectorPowerDriver(settings), bus
    )

    ir_fake_driver: ir_fake.FakeIrDriver | None = None
    if kinds["ir"] == "fake":
        ir_fake_driver = ir_fake.FakeIrDriver(settings)
        fake_routers.append(ir_fake.build_fake_router(ir_fake_driver))
        if power_fake_driver is not None:
            # The fake projector "sees" every code the fake blaster sends.
            ir_fake_driver.add_listener(power_fake_driver.ir_received)
    ir = IrService(ir_fake_driver or RealIrDriver(settings, mqtt), bus)

    hdmi = HdmiService(
        FakeHdmiDriver(settings) if kinds["hdmi"] == "fake" else RealHdmiDriver(settings), bus
    )
    projection_screen = ProjectionScreenService(
        FakeProjectionScreenDriver(settings)
        if kinds["projection_screen"] == "fake"
        else RealProjectionScreenDriver(settings),
        bus,
    )
    audio = AudioService(
        audio_fake.FakeAudioDriver(settings)
        if kinds["audio"] == "fake"
        else RealAudioDriver(settings),
        bus,
    )

    sensors_fake_driver: sensors_fake.FakeSensorsDriver | None = None
    if kinds["sensors"] == "fake":
        sensors_fake_driver = sensors_fake.FakeSensorsDriver(settings)
        fake_routers.append(sensors_fake.build_fake_router(sensors_fake_driver))
    sensors = SensorsService(sensors_fake_driver or RealSensorsDriver(settings, mqtt), bus)

    zigbee_fake_driver: zigbee_fake.FakeZigbeeStatusDriver | None = None
    if kinds["zigbee_status"] == "fake":
        zigbee_fake_driver = zigbee_fake.FakeZigbeeStatusDriver(settings)
        fake_routers.append(zigbee_fake.build_fake_router(zigbee_fake_driver))
    zigbee_status = ZigbeeStatusService(zigbee_fake_driver or RealZigbeeStatusDriver(settings), bus)

    return Registry(
        settings=settings,
        lights=lights,
        projector_power=projector_power,
        ir=ir,
        hdmi=hdmi,
        projection_screen=projection_screen,
        audio=audio,
        sensors=sensors,
        zigbee_status=zigbee_status,
        fake_routers=fake_routers,
        mqtt=mqtt if zigbee_real else None,
    )
