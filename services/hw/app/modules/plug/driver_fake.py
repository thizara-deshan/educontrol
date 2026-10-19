"""Fake smart plug: a relay that echoes every change as `plug.state`; a steady load while on."""

from app.config import Settings
from app.contracts import ACK_OK, HwAck, HwDriverKind
from app.modules.plug.schemas import HwPlugSetRequest, HwPlugStateData, HwPlugStateEvent
from app.modules.plug.service import PlugEmit

FAKE_LOAD_W = 42.5
FAKE_VOLTS = 231.0


class FakePlugDriver:
    kind: HwDriverKind = "fake"

    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._on = True
        self._emit: PlugEmit | None = None

    async def start(self, emit: PlugEmit) -> None:
        self._emit = emit
        self._report()

    async def stop(self) -> None:
        self._emit = None

    async def set(self, request: HwPlugSetRequest) -> HwAck:
        self._on = request.on
        self._report()
        return ACK_OK

    def _report(self) -> None:
        if self._emit is None:
            return
        watts = FAKE_LOAD_W if self._on else 0.0
        data = HwPlugStateData(
            online=True,
            on=self._on,
            watts=watts,
            volts=FAKE_VOLTS,
            amps=round(watts / FAKE_VOLTS, 2),
            kwh_today=0.34,
        )
        self._emit(HwPlugStateEvent(data=data))
