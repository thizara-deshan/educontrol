"""Fake projector plug: relay echo, a power meter and a projector that reacts to IR codes.

The fake IR driver calls `ir_received(code)` for every code it sends (wired in app/registry.py).
`HW_FAKE_PROJECTOR_ON_CODE` starts the warm-up ramp, `HW_FAKE_PROJECTOR_OFF_CODE` the cool-down.
"""

import asyncio
from typing import Literal

from fastapi import APIRouter

from app.config import Settings
from app.contracts import ACK_OK, HwAck, HwAckOk, HwDriverKind, HwModel, ack_error
from app.fake_support import FakeTasks, scaled
from app.modules.projector_power.schemas import (
    HwPowerReadingData,
    HwProjectorPowerReadingEvent,
    HwProjectorPowerRelayEvent,
    HwProjectorPowerRelayRequest,
    HwRelayStateData,
)
from app.modules.projector_power.service import ProjectorPowerEmit

# [ASSUMED] projector draw profile. R1: >50 W running, <5 W standby, between = transition.
STANDBY_W = 3.0
RUNNING_W = 287.0
VOLTS = 231.0
STEP_S = 10.0  # simulated seconds between ramp steps
WARM_UP_W = (12.0, 24.0, 36.0, 48.0, 160.0, RUNNING_W)
COOL_DOWN_W = (120.0, 45.0, 38.0, 30.0, 22.0, 14.0, 6.0, STANDBY_W)

Phase = Literal["off", "standby", "warming_up", "running", "cooling_down"]
WARMS_FROM: tuple[Phase, ...] = ("standby", "cooling_down")
COOLS_FROM: tuple[Phase, ...] = ("running", "warming_up")


class FakeProjectorPowerDriver:
    kind: HwDriverKind = "fake"

    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._relay = True
        self._phase: Phase = "standby"
        self._watts = STANDBY_W
        self._energy = settings.fake_energy_kwh_total
        self._meter_online = True
        self._emit: ProjectorPowerEmit | None = None
        self._tasks = FakeTasks()
        self._ramp: asyncio.Task[None] | None = None

    async def start(self, emit: ProjectorPowerEmit) -> None:
        self._emit = emit
        self._emit(HwProjectorPowerRelayEvent(data=HwRelayStateData(on=self._relay)))
        self._report_reading()
        self._tasks.spawn(self._periodic())

    async def stop(self) -> None:
        await self._tasks.cancel_all()
        self._emit = None

    async def relay(self, request: HwProjectorPowerRelayRequest) -> HwAck:
        if not self._meter_online:
            return ack_error("device_offline", f"{self._settings.proj_plug_node} is offline")
        self._relay = request.on
        self._cancel_ramp()
        self._phase = "standby" if request.on else "off"
        self._watts = STANDBY_W if request.on else 0.0
        if self._emit is not None:
            self._emit(HwProjectorPowerRelayEvent(data=HwRelayStateData(on=self._relay)))
        self._report_reading()
        return ACK_OK

    def ir_received(self, code: str) -> None:
        """The projector saw an IR code. Without mains (relay off) it ignores everything."""
        if code == self._settings.fake_projector_on_code and self._phase in WARMS_FROM:
            self._run_ramp("warming_up", WARM_UP_W, "running")
        elif code == self._settings.fake_projector_off_code and self._phase in COOLS_FROM:
            self._run_ramp("cooling_down", COOL_DOWN_W, "standby")

    def set_meter_online(self, online: bool) -> None:
        """Offline = no readings and relay commands fail with `device_offline`."""
        self._meter_online = online
        if online:
            self._report_reading()

    def _run_ramp(self, during: Phase, steps: tuple[float, ...], after: Phase) -> None:
        self._cancel_ramp()
        self._phase = during
        self._ramp = self._tasks.spawn(self._ramp_steps(steps, after))

    async def _ramp_steps(self, steps: tuple[float, ...], after: Phase) -> None:
        for watts in steps:
            await asyncio.sleep(scaled(self._settings, STEP_S))
            self._watts = watts
            self._report_reading()
        self._phase = after
        self._ramp = None

    def _cancel_ramp(self) -> None:
        if self._ramp is not None:
            self._ramp.cancel()
            self._ramp = None

    async def _periodic(self) -> None:
        interval = self._settings.fake_report_interval_s
        while True:
            await asyncio.sleep(interval)
            simulated_s = interval * self._settings.fake_time_scale
            self._energy += self._watts * simulated_s / 3_600_000  # W·s → kWh
            self._report_reading()

    def _report_reading(self) -> None:
        if self._emit is None or not self._meter_online:
            return
        energy = round(self._energy, 4)
        data = HwPowerReadingData(watts=self._watts, volts=VOLTS, energy_kwh_total=energy)
        self._emit(HwProjectorPowerReadingEvent(data=data))


class FakeOnlineRequest(HwModel):
    online: bool = False


def build_fake_router(driver: FakeProjectorPowerDriver) -> APIRouter:
    router = APIRouter(prefix="/v1/_fake/projector_power", tags=["fake"])

    @router.post("/meter_offline")
    async def meter_offline(body: FakeOnlineRequest | None = None) -> HwAckOk:
        driver.set_meter_online((body or FakeOnlineRequest()).online)
        return ACK_OK

    return router
