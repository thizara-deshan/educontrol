"""Serial link to the podium MCU (ESP32, firmware `eduscope-podium-mcu 2.x`, PLAN-H06 D1).

The only opener of `HW_PODIUM_PORT`. Protocol (fw header, fw:handle): one command per line; every
command answers data lines then exactly one final `ok` / `err <reason>`. Lines starting `evt ` are
unsolicited and may arrive between a command and its reply; they go to `subscribe()` handlers.

- One command in flight at a time (async lock); per-command timeout. A reply that arrives after
  its timeout is skipped (its final line is counted off); after `MAX_UNANSWERED` unanswered
  commands in a row the port is reopened.
- Opening the port resets the board (observed in PLAN-H06 T0), which prints ROM boot text and then
  `evt ready`. Nothing is sent before `evt ready` (or `podium_boot_wait_s` without one). Every
  `evt ready` fails the command in flight and runs the `on_ready()` handlers, in order, in a task.
- `ping` every `podium_ping_s` while idle, so the firmware never reports `host_silent` (fw:loop).
- Reopens with a doubling backoff after a failed open or a lost port.
"""

import asyncio
import time
from collections.abc import Awaitable, Callable
from contextlib import suppress
from dataclasses import dataclass, field
from typing import Protocol

import serial
from serial_asyncio_fast import SerialTransport

from app.config import Settings
from app.contracts import logger
from app.transports.mqtt import next_backoff

EventHandler = Callable[[str], None]
ReadyHandler = Callable[[], Awaitable[None]]

# Unanswered commands in a row before the link is treated as dead and reopened.
MAX_UNANSWERED = 3


class McuOffline(ConnectionError):
    """Port closed, not ready yet, or lost / reset while the command was in flight."""


class McuTimeout(TimeoutError):
    """No final line within the command's timeout."""


class McuError(Exception):
    """The firmware answered `err <reason>`. `lines` = data lines before it (e.g. `src=1`)."""

    def __init__(self, reason: str, lines: list[str]) -> None:
        super().__init__(reason)
        self.reason = reason
        self.lines = lines


class PodiumMcuLink(Protocol):
    """What the real audio and hdmi drivers need. Tests use the real transport on a fake MCU."""

    @property
    def connected(self) -> bool: ...

    def subscribe(self, prefix: str, handler: EventHandler) -> None: ...

    def on_ready(self, handler: ReadyHandler) -> None: ...

    async def command(self, line: str, timeout_s: float | None = None) -> list[str]: ...


class SerialReader(Protocol):
    async def readline(self) -> bytes: ...


class SerialWriter(Protocol):
    def write(self, data: bytes) -> None: ...

    async def drain(self) -> None: ...

    def close(self) -> None: ...


Opener = Callable[[], Awaitable[tuple[SerialReader, SerialWriter]]]


@dataclass
class _Pending:
    reply: asyncio.Future[list[str]]
    lines: list[str] = field(default_factory=list)


def is_final(line: str) -> bool:
    return line == "ok" or line == "err" or line.startswith("err ")


class PodiumMcuTransport:
    def __init__(self, settings: Settings, opener: Opener | None = None) -> None:
        self._settings = settings
        self._opener = opener or self._open_serial
        self._handlers: list[tuple[str, EventHandler]] = []
        self._ready_handlers: list[ReadyHandler] = []
        self._writer: SerialWriter | None = None
        self._ready = asyncio.Event()
        self._lock = asyncio.Lock()
        self._pending: _Pending | None = None
        self._skip_finals = 0
        self._unanswered = 0
        self._last_cmd = time.monotonic()
        self._task: asyncio.Task[None] | None = None
        self._ready_task: asyncio.Task[None] | None = None
        self._lost = asyncio.Event()
        self._heard = False

    @property
    def connected(self) -> bool:
        return self._writer is not None and self._ready.is_set()

    def subscribe(self, prefix: str, handler: EventHandler) -> None:
        """`handler(text)` for every `evt <text>` whose text starts with `prefix`."""
        self._handlers.append((prefix, handler))

    def on_ready(self, handler: ReadyHandler) -> None:
        """Awaited after every MCU boot / port open, once the link accepts commands."""
        self._ready_handlers.append(handler)

    async def command(self, line: str, timeout_s: float | None = None) -> list[str]:
        """Sends one command; returns its data lines on `ok`. Raises McuError, McuTimeout,
        McuOffline."""
        timeout = self._settings.podium_cmd_timeout_s if timeout_s is None else timeout_s
        async with self._lock:
            writer = self._writer
            if writer is None or not self._ready.is_set():
                raise McuOffline("podium MCU not connected")
            pending = _Pending(asyncio.get_running_loop().create_future())
            self._pending = pending
            self._last_cmd = time.monotonic()
            try:
                try:
                    writer.write(line.encode("ascii") + b"\n")
                    await writer.drain()
                except (OSError, serial.SerialException) as exc:
                    self._lost.set()
                    raise McuOffline(f"podium MCU write failed: {exc}") from exc
                return await asyncio.wait_for(pending.reply, timeout)
            except McuOffline:
                raise
            except TimeoutError:
                # Its reply may still come; skip that final line so it is not taken as the next
                # command's answer.
                self._skip_finals += 1
                self._unanswered += 1
                if self._unanswered >= MAX_UNANSWERED:
                    logger.warning("podium: %d commands unanswered; reopening", self._unanswered)
                    self._lost.set()
                raise McuTimeout(f"podium MCU did not answer {line.split(' ', 1)[0]!r}") from None
            finally:
                if self._pending is pending:
                    self._pending = None

    async def start(self) -> None:
        """Starts the open/read loop in the background; never waits for the board."""
        if self._task is None:
            self._task = asyncio.create_task(self._run())

    async def stop(self) -> None:
        for task in (self._ready_task, self._task):
            if task is not None:
                task.cancel()
                with suppress(asyncio.CancelledError):
                    await task
        self._ready_task = None
        self._task = None

    async def _open_serial(self) -> tuple[SerialReader, SerialWriter]:
        """8N1 at `podium_baud`, DTR/RTS deasserted before open (the board still resets, T0)."""
        port = serial.Serial()
        port.port = self._settings.podium_port
        port.baudrate = self._settings.podium_baud
        port.dtr = False
        port.rts = False
        await asyncio.to_thread(port.open)
        loop = asyncio.get_running_loop()
        reader = asyncio.StreamReader(loop=loop)
        protocol = asyncio.StreamReaderProtocol(reader, loop=loop)
        transport = SerialTransport(loop, protocol, port)
        return reader, asyncio.StreamWriter(transport, protocol, reader, loop)

    async def _run(self) -> None:
        delay = self._settings.podium_reconnect_min_s
        while True:
            try:
                reader, writer = await self._opener()
            except (OSError, serial.SerialException) as exc:
                logger.warning("podium: cannot open %s: %s", self._settings.podium_port, exc)
            else:
                logger.info("podium: opened %s", self._settings.podium_port)
                if await self._session(reader, writer):  # heard the board: start backoff over
                    delay = self._settings.podium_reconnect_min_s
            await asyncio.sleep(delay)
            delay = next_backoff(delay, self._settings.podium_reconnect_max_s)

    async def _session(self, reader: SerialReader, writer: SerialWriter) -> bool:
        """One open port until it is lost. True if any line was heard from the board."""
        self._writer = writer
        self._ready.clear()
        self._lost.clear()
        self._skip_finals = 0
        self._unanswered = 0
        self._heard = False
        read = asyncio.create_task(self._read(reader))
        lost = asyncio.create_task(self._lost.wait())
        tasks = [
            read,
            lost,
            asyncio.create_task(self._boot_wait()),
            asyncio.create_task(self._keepalive()),
        ]
        try:
            await asyncio.wait((read, lost), return_when=asyncio.FIRST_COMPLETED)
            if read.done() and not read.cancelled() and read.exception() is not None:
                logger.warning("podium: read failed: %s", read.exception())
        finally:
            for task in tasks:
                task.cancel()
            for task in tasks:
                with suppress(asyncio.CancelledError, Exception):
                    await task
            self._writer = None
            self._ready.clear()
            self._fail_pending("podium MCU connection lost")
            if self._ready_task is not None:
                self._ready_task.cancel()
            with suppress(OSError, serial.SerialException):
                writer.close()
            logger.warning("podium: %s closed", self._settings.podium_port)
        return self._heard

    async def _read(self, reader: SerialReader) -> None:
        while True:
            raw = await reader.readline()
            if not raw:
                return  # EOF: the port is gone
            self._heard = True
            self._on_line(raw.decode("ascii", errors="replace").strip())

    async def _boot_wait(self) -> None:
        """Ready after `podium_boot_wait_s` without `evt ready` (a board that did not reset)."""
        await asyncio.sleep(self._settings.podium_boot_wait_s)
        if not self._ready.is_set():
            logger.info("podium: no `evt ready` after open; assuming the board is running")
            self._became_ready()

    async def _keepalive(self) -> None:
        interval = self._settings.podium_ping_s
        while True:
            await asyncio.sleep(interval)
            if not self.connected or time.monotonic() - self._last_cmd < interval:
                continue
            with suppress(McuError, McuTimeout, McuOffline):
                await self.command("ping")

    def _on_line(self, line: str) -> None:
        if not line:
            return
        if line.startswith("evt "):
            self._on_event(line[4:])
            return
        if not self._ready.is_set():
            logger.debug("podium: boot: %s", line)  # ROM boot text after a reset
            return
        if self._skip_finals > 0:
            if is_final(line):
                self._skip_finals -= 1
            logger.debug("podium: late reply dropped: %s", line)
            return
        pending = self._pending
        if pending is None or pending.reply.done():
            logger.warning("podium: unexpected line dropped: %s", line)
            return
        if line == "ok":
            self._unanswered = 0
            pending.reply.set_result(pending.lines)
        elif is_final(line):
            self._unanswered = 0
            reason = line[4:] if line.startswith("err ") else ""
            pending.reply.set_exception(McuError(reason, pending.lines))
        else:
            pending.lines.append(line)

    def _on_event(self, text: str) -> None:
        if text == "ready":
            if self._ready.is_set():
                logger.warning("podium: the MCU restarted")
            self._fail_pending("podium MCU restarted")
            self._skip_finals = 0
            self._unanswered = 0
            self._became_ready()
            return
        if text.startswith("fault "):
            logger.warning("podium: %s", text)
        handled = False
        for prefix, handler in list(self._handlers):
            if text.startswith(prefix):
                handled = True
                try:
                    handler(text)
                except Exception:
                    logger.exception("podium: handler for %r failed", text)
        if not handled:
            logger.debug("podium: evt %s", text)

    def _became_ready(self) -> None:
        self._ready.set()
        if self._ready_task is not None:
            self._ready_task.cancel()
        self._ready_task = asyncio.create_task(self._run_ready_handlers())

    async def _run_ready_handlers(self) -> None:
        for handler in list(self._ready_handlers):
            try:
                await handler()
            except asyncio.CancelledError:
                raise
            except Exception:
                logger.exception("podium: ready handler failed")

    def _fail_pending(self, why: str) -> None:
        pending = self._pending
        if pending is not None and not pending.reply.done():
            pending.reply.set_exception(McuOffline(why))
