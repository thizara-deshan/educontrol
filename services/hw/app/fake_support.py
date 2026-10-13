"""Helpers shared by the fake drivers: scaled time and owned background tasks."""

import asyncio
from collections.abc import Coroutine
from typing import Any

from app.config import Settings


def scaled(settings: Settings, seconds: float) -> float:
    """A simulated duration in real seconds (`HW_FAKE_TIME_SCALE=60` makes 60 s take 1 s)."""
    return seconds / settings.fake_time_scale


class FakeTasks:
    """Background tasks owned by one fake driver; `cancel_all()` runs on driver stop."""

    def __init__(self) -> None:
        self._tasks: set[asyncio.Task[None]] = set()

    def spawn(self, coro: Coroutine[Any, Any, None]) -> asyncio.Task[None]:
        task = asyncio.create_task(coro)
        self._tasks.add(task)
        task.add_done_callback(self._tasks.discard)
        return task

    async def cancel_all(self) -> None:
        tasks = list(self._tasks)
        for task in tasks:
            task.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)
