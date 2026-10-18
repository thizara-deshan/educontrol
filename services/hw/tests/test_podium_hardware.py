"""[ON PI] The podium MCU on its real port, read-only (PLAN-H06).

Run on the R-101 Pi only: `uv run --directory services/hw pytest -m hardware`. Opening the port
resets the board (PLAN-H06 T0), so its digipots are un-homed afterwards until hw-service sets the
start levels again. The port is opened exclusively: with hw-service running with `audio=real` or
`hdmi=real`, this test fails to open it; stop hw-service first. `HW_PODIUM_PORT` overrides
`/dev/podium-mcu`.
"""

import asyncio

import pytest

from app.config import Settings
from app.transports.podium_mcu import PodiumMcuTransport

pytestmark = pytest.mark.hardware


async def test_podium_mcu_answers_read_only_commands() -> None:
    settings = Settings(_env_file=None)
    link = PodiumMcuTransport(settings)
    await link.start()
    try:
        async with asyncio.timeout(5):
            while not link.connected:  # noqa: ASYNC110 - the transport's own task opens it
                await asyncio.sleep(0.01)
        assert await link.command("ping") == []
        (version,) = await link.command("ver")
        assert version.startswith("eduscope-podium-mcu 2.")
        (src,) = await link.command("src?")
        assert src in ("src=0", "src=1", "src=2")
        levels = await link.command("vol?")
        assert [line.split("=")[0] for line in levels] == ["a", "b"]
    finally:
        await link.stop()
