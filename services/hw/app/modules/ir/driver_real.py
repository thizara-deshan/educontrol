"""Real IR driver: stub until hardware intake.

[ASSUMED] ZS06 via zigbee2mqtt `ir_code_to_send` / `learn_ir_code`; `ir_mcu` = ESP32 on GPIO 16/17
via serial (ARCHITECTURE §7.2).
"""

from app.config import Settings
from app.contracts import INTAKE_PENDING, HwAck, HwDriverKind
from app.modules.ir.schemas import HwIrLearnRequest, HwIrLearnResult, HwIrSendRequest
from app.modules.ir.service import IrEmit


class RealIrDriver:
    kind: HwDriverKind = "real"

    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    async def start(self, emit: IrEmit) -> None:
        """Nothing to start before intake; the module reports nothing (snapshot stays null)."""

    async def stop(self) -> None:
        """Nothing to stop."""

    async def send(self, request: HwIrSendRequest) -> HwAck:
        raise NotImplementedError(INTAKE_PENDING)

    async def learn(self, request: HwIrLearnRequest) -> HwIrLearnResult:
        raise NotImplementedError(INTAKE_PENDING)

    async def cancel_learn(self) -> HwAck:
        raise NotImplementedError(INTAKE_PENDING)
