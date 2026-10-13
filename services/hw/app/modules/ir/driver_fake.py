"""Fake IR blaster. Sent codes go to listeners (the fake projector); learning "captures" a
random opaque code after LEARN_CAPTURE_S (scaled), seeded by HW_FAKE_SEED."""

import asyncio
import base64
import random
from collections.abc import Callable

from fastapi import APIRouter

from app.config import Settings
from app.contracts import ACK_OK, HwAck, HwAckOk, HwDriverKind, HwModel, ack_error
from app.fake_support import scaled
from app.modules.ir.schemas import (
    HwIrBlasterData,
    HwIrBlasterEvent,
    HwIrLearnCancelled,
    HwIrLearnCaptured,
    HwIrLearnEvent,
    HwIrLearnRequest,
    HwIrLearnResult,
    HwIrLearnStateData,
    HwIrLearnTimeout,
    HwIrSendRequest,
    IrLearnStatus,
)
from app.modules.ir.service import IrEmit

BLASTER_LQI = 196  # screenshot 03
LEARN_CAPTURE_S = 3.0  # simulated seconds until the fake "receives" a remote press

CodeListener = Callable[[str], None]


class FakeIrDriver:
    kind: HwDriverKind = "fake"

    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._rng = random.Random(settings.fake_seed)
        self._online = True
        self._listeners: list[CodeListener] = []
        self._learn_cancel: asyncio.Event | None = None
        self._emit: IrEmit | None = None

    def add_listener(self, listener: CodeListener) -> None:
        self._listeners.append(listener)

    async def start(self, emit: IrEmit) -> None:
        self._emit = emit
        self._report_blaster()

    async def stop(self) -> None:
        if self._learn_cancel is not None:
            self._learn_cancel.set()
        self._emit = None

    async def send(self, request: HwIrSendRequest) -> HwAck:
        if not self._online:
            return ack_error("device_offline", f"{self._settings.ir_node} is offline")
        for listener in self._listeners:
            listener(request.code)
        return ACK_OK

    async def learn(self, request: HwIrLearnRequest) -> HwIrLearnResult:
        """One capture at a time: a new learn cancels the one in progress. Offline or a timeout
        shorter than LEARN_CAPTURE_S ends in `timeout`."""
        if self._learn_cancel is not None:
            self._learn_cancel.set()
        cancel = asyncio.Event()
        self._learn_cancel = cancel
        self._report_learn("listening")
        captures = self._online and LEARN_CAPTURE_S <= request.timeout_s
        wait_s = LEARN_CAPTURE_S if captures else request.timeout_s
        result: HwIrLearnResult
        try:
            await asyncio.wait_for(cancel.wait(), timeout=scaled(self._settings, wait_s))
            result = HwIrLearnCancelled(status="cancelled")
        except TimeoutError:
            if captures:
                code = base64.b64encode(self._rng.randbytes(12)).decode()
                result = HwIrLearnCaptured(status="captured", code_format="tuya", code=code)
            else:
                result = HwIrLearnTimeout(status="timeout")
        finally:
            if self._learn_cancel is cancel:
                self._learn_cancel = None
        self._report_learn(result.status)
        return result

    async def cancel_learn(self) -> HwAck:
        if self._learn_cancel is not None:
            self._learn_cancel.set()
        return ACK_OK

    def set_online(self, online: bool) -> None:
        self._online = online
        self._report_blaster()

    def _report_blaster(self) -> None:
        if self._emit is not None:
            lqi = BLASTER_LQI if self._online else None
            self._emit(HwIrBlasterEvent(data=HwIrBlasterData(online=self._online, lqi=lqi)))

    def _report_learn(self, status: IrLearnStatus) -> None:
        if self._emit is not None:
            self._emit(HwIrLearnEvent(data=HwIrLearnStateData(status=status)))


class FakeOnlineRequest(HwModel):
    online: bool = False


def build_fake_router(driver: FakeIrDriver) -> APIRouter:
    router = APIRouter(prefix="/v1/_fake/ir", tags=["fake"])

    @router.post("/blaster_offline")
    async def blaster_offline(body: FakeOnlineRequest | None = None) -> HwAckOk:
        driver.set_online((body or FakeOnlineRequest()).online)
        return ACK_OK

    return router
