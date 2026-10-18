"""In-memory podium MCU speaking firmware `eduscope-podium-mcu 2.1`
(reference/hardware-drops/2026-10-18-podium-mcu/podium_mcu.ino), for transport and driver tests.

`opener()` plugs into `PodiumMcuTransport(settings, opener)`. As on the Pi (PLAN-H06 T0), every
open resets the board: ROM boot text, `evt ready`, then `evt src changed 0 <n>` from the first
LED poll. Board state that survives a reset is the physical switch input; the digipot tap counts
go back to -1 (fw:setup).
"""

import asyncio
import math
from collections.abc import Callable

from app.config import Settings
from tests.helpers import make_settings

FW = "eduscope-podium-mcu 2.1"
BOOT_TEXT = [
    "ets Jul 29 2019 12:21:46",
    "",
    "rst:0x1 (POWERON_RESET),boot:0x13 (SPI_FAST_FLASH_BOOT)",
    "entry 0x400805b4",
]
TAPER = 2.5


def podium_settings(**overrides: object) -> Settings:
    values: dict[str, object] = {
        "podium_boot_wait_s": 0.05,
        "podium_cmd_timeout_s": 0.2,
        "podium_ping_s": 3600.0,
        "podium_reconnect_min_s": 0.01,
        "podium_reconnect_max_s": 0.05,
        **overrides,
    }
    return make_settings(**values)


async def until(condition: Callable[[], object], within: float = 1.0) -> None:
    async with asyncio.timeout(within):
        while not condition():  # noqa: ASYNC110 - polls state another task changes
            await asyncio.sleep(0.001)


def vol_to_tap(vol: int) -> int:
    """fw:volToTap (lroundf rounds half away from zero; floor(x + 0.5) for x ≥ 0)."""
    vol = max(0, min(100, vol))
    if vol == 0:
        return 0
    if vol >= 100:
        return 99
    return max(0, min(99, math.floor((vol / 100) ** TAPER * 99 + 0.5)))


def tap_to_vol(tap: int) -> int:
    """fw:tapToVol."""
    if tap <= 0:
        return 0
    return max(0, min(100, math.floor((tap / 99) ** (1 / TAPER) * 100 + 0.5)))


class FakeWriter:
    def __init__(self, mcu: "FakePodiumMcu") -> None:
        self._mcu = mcu
        self._buffer = b""
        self.closed = False

    def write(self, data: bytes) -> None:
        if self.closed or self._mcu.unplugged:
            raise OSError("[Errno 5] Input/output error")
        self._buffer += data
        while b"\n" in self._buffer:
            line, self._buffer = self._buffer.split(b"\n", 1)
            self._mcu.inbox.put_nowait(line.decode("ascii").strip())

    async def drain(self) -> None:
        return None

    def close(self) -> None:
        self.closed = True


class FakePodiumMcu:
    def __init__(self, src: int = 2, resets_on_open: bool = True) -> None:
        self.src = src  # the switch's real input (1 or 2), as its LEDs show it
        self.leds_agree = True  # False: readSource() == 0
        self.switch_stuck = False  # presses do nothing (src <n> → err switch_did_not_confirm)
        self.resets_on_open = resets_on_open
        self.taps: dict[str, int] = {"a": -1, "b": -1}
        self.received: list[str] = []  # every command line, in order
        self.silent: set[str] = set()  # command words that get no reply at all
        self.delay_s: dict[str, float] = {}  # command word → seconds before the reply
        self.errors: dict[str, str] = {}  # command word → `err <reason>` instead of running it
        self.before_reply: list[str] = []  # evt lines sent before the next reply
        self.refuse_opens = 0
        self.opens = 0
        self.unplugged = False
        self.inbox: asyncio.Queue[str] = asyncio.Queue()
        self._reader: asyncio.StreamReader | None = None
        self._writer: FakeWriter | None = None
        self._worker: asyncio.Task[None] | None = None

    # ------------------------------------------------------------------ transport side

    async def opener(self) -> tuple[asyncio.StreamReader, FakeWriter]:
        if self.refuse_opens > 0:
            self.refuse_opens -= 1
            raise OSError("[Errno 2] could not open port /dev/podium-mcu")
        self.opens += 1
        self.unplugged = False
        if self._worker is not None:
            self._worker.cancel()
        self.inbox = asyncio.Queue()
        self._reader = asyncio.StreamReader()
        self._writer = FakeWriter(self)
        self._worker = asyncio.create_task(self._work())
        if self.resets_on_open:
            self.reset()
        return self._reader, self._writer

    # ------------------------------------------------------------------ test controls

    def reset(self) -> None:
        """Board reboot (fw:setup): boot text, `evt ready`, then the first LED poll's event."""
        self.taps = {"a": -1, "b": -1}
        for line in BOOT_TEXT:
            self.send(line)
        self.send("evt ready")
        if self.leds_agree:
            self.send(f"evt src changed 0 {self.src}")

    def press_by_hand(self) -> None:
        """Someone presses the switch button: the next LED poll reports it (fw:loop)."""
        was = self.src
        self.src = 2 if self.src == 1 else 1
        self.send(f"evt src changed {was} {self.src}")

    def unplug(self) -> None:
        self.unplugged = True
        if self._reader is not None:
            self._reader.feed_eof()

    def send(self, line: str) -> None:
        if self._reader is not None and not self.unplugged:
            self._reader.feed_data(line.encode("ascii") + b"\r\n")

    def tap(self, ch: str) -> int:
        return self.taps[ch]

    def level(self, ch: str) -> int:
        """`vol?` for one channel: -1 until homed."""
        tap = self.taps[ch]
        return -1 if tap < 0 else tap_to_vol(tap)

    # ------------------------------------------------------------------ firmware

    async def _work(self) -> None:
        while True:
            line = await self.inbox.get()
            if not line:
                self.send("ok")
                continue
            self.received.append(line)
            word = line.split(" ", 1)[0].lower()
            if word in self.silent:
                continue
            delay = self.delay_s.get(word, 0.0)
            if delay:
                await asyncio.sleep(delay)
            for evt in self.before_reply:
                self.send(evt)
            self.before_reply = []
            if word in self.errors:
                self.send(f"err {self.errors[word]}")
                continue
            for reply in self._handle(line):
                self.send(reply)

    def _read_source(self) -> int:
        return self.src if self.leds_agree else 0

    def _handle(self, line: str) -> list[str]:
        args = line.split()
        cmd = args[0].lower()
        if cmd == "ping":
            return ["ok"]
        if cmd == "ver":
            return [FW, "ok"]
        if cmd in ("vol", "tap"):
            if len(args) < 2 or args[1].lower() not in ("a", "b"):
                return ["err bad_channel"]
            ch = args[1].lower()
            if len(args) < 3:
                return ["err missing_value"]
            if args[2] in ("up", "down"):
                if self.taps[ch] < 0:
                    return ["err not_homed"]
                n = int(args[3]) if len(args) > 3 else 1
                self.taps[ch] = max(0, min(99, self.taps[ch] + (n if args[2] == "up" else -n)))
                return ["ok"]
            value = int(args[2])
            self.taps[ch] = vol_to_tap(value) if cmd == "vol" else max(0, min(99, value))
            return ["ok"]
        if cmd == "vol?":
            return [f"a={self.level('a')}", f"b={self.level('b')}", "ok"]
        if cmd == "src":
            if len(args) < 2:
                return ["err missing_value"]
            want = int(args[1])
            if want not in (1, 2):
                return ["err bad_source"]
            if not self.switch_stuck and self.leds_agree:
                self.src = want
            now = self._read_source()
            return [f"src={now}", "ok" if now == want else "err switch_did_not_confirm"]
        if cmd == "src?":
            return [f"src={self._read_source()}", "ok"]
        return ["err unknown_command"]
