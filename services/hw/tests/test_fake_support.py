import asyncio

from app.fake_support import FakeTasks, scaled
from tests.helpers import make_settings


def test_scaled_divides_by_the_time_scale() -> None:
    assert scaled(make_settings(fake_time_scale=60.0), 120.0) == 2.0
    assert scaled(make_settings(fake_time_scale=1.0), 3.0) == 3.0


async def test_cancel_all_stops_running_tasks() -> None:
    tasks = FakeTasks()
    task = tasks.spawn(asyncio.sleep(60))
    await tasks.cancel_all()
    assert task.cancelled()


async def test_finished_tasks_are_forgotten() -> None:
    tasks = FakeTasks()
    await tasks.spawn(asyncio.sleep(0))
    await tasks.cancel_all()  # nothing left to cancel, must not raise
