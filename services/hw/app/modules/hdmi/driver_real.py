"""Real HDMI switch driver: the 2x1 switch behind the podium MCU (PLAN-H06 D8, answers SPEC Q1).

The MCU presses the switch's button through a PC817 and reads the switch's two input LEDs back
(fw:setSource, fw:readSource), so every reported input is the one the LEDs show.

- `select`: `src <n>` → `src=<now>` then `ok`, or `err switch_did_not_confirm` after 4 tries.
  `<now>` 1 or 2 is reported either way; 0 (LEDs disagree) reports nothing.
- `evt src changed <was> <now>`: a press by hand, or the first LED poll after a reset (fw:loop).
- After every MCU boot / port open: `src?`.
- `HW_HDMI_PODIUM_PC_INPUT` maps inputs 1/2 to `podium_pc` / `smart_board` ([ASSUMED] 1).
"""

from app.config import Settings
from app.contracts import ACK_OK, HwAck, HwDriverKind, ack_error, logger
from app.modules.hdmi.schemas import (
    HdmiInput,
    HwHdmiSelectRequest,
    HwHdmiStateData,
    HwHdmiStateEvent,
)
from app.modules.hdmi.service import HdmiEmit
from app.transports.podium_mcu import McuError, McuOffline, McuTimeout, PodiumMcuLink


def parse_src(lines: list[str]) -> int | None:
    """The `src=<n>` data line (fw:handle "src", "src?"), or None when there is none."""
    for line in lines:
        if line.startswith("src="):
            value = line.removeprefix("src=")
            return int(value) if value.isdigit() else None
    return None


class RealHdmiDriver:
    kind: HwDriverKind = "real"

    def __init__(self, settings: Settings, mcu: PodiumMcuLink) -> None:
        self._settings = settings
        self._mcu = mcu
        self._emit: HdmiEmit | None = None
        pc = settings.hdmi_podium_pc_input
        self._inputs: dict[int, HdmiInput] = {pc: "podium_pc", 3 - pc: "smart_board"}
        self._numbers: dict[HdmiInput, int] = {name: n for n, name in self._inputs.items()}
        mcu.subscribe("src changed ", self._on_src_changed)
        mcu.on_ready(self._on_ready)

    async def start(self, emit: HdmiEmit) -> None:
        self._emit = emit

    async def stop(self) -> None:
        self._emit = None

    async def select(self, request: HwHdmiSelectRequest) -> HwAck:
        number = self._numbers[request.input]
        try:
            lines = await self._mcu.command(
                f"src {number}", timeout_s=self._settings.podium_src_timeout_s
            )
        except McuError as exc:
            self._report(parse_src(exc.lines))
            return ack_error("transport", f"HDMI switch did not confirm input {number}: {exc}")
        except McuTimeout as exc:
            return ack_error("timeout", str(exc))
        except McuOffline as exc:
            return ack_error("device_offline", str(exc))
        self._report(parse_src(lines))
        return ACK_OK

    async def _on_ready(self) -> None:
        try:
            lines = await self._mcu.command("src?")
        except (McuError, McuTimeout, McuOffline) as exc:
            logger.warning("hdmi: src? after MCU start failed: %s", exc)
            return
        self._report(parse_src(lines))

    def _on_src_changed(self, text: str) -> None:
        # "src changed <was> <now>"
        now = text.split()[-1]
        self._report(int(now) if now.isdigit() else None)

    def _report(self, number: int | None) -> None:
        name = self._inputs.get(number) if number is not None else None
        if name is None:
            return  # 0: the LEDs agree on no input; keep the last report
        if self._emit is not None:
            self._emit(HwHdmiStateEvent(data=HwHdmiStateData(input=name)))
