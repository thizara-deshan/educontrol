"""Shared test helpers: settings without env/.env surprises, event waiting, an in-process client."""

import asyncio
from typing import TypeVar

import httpx
from fastapi import APIRouter, FastAPI

from app.config import Settings
from app.contracts import HwEnvelope
from app.events import Subscription

E = TypeVar("E", bound=HwEnvelope)


def make_settings(**overrides: object) -> Settings:
    """Fast fake time (1000x), periodic readings and heartbeat effectively off unless overridden."""
    values: dict[str, object] = {
        "mode": "fake",
        "drivers": "",
        "host": "127.0.0.1",
        "fake_time_scale": 1000.0,
        "fake_report_interval_s": 3600.0,
        "heartbeat_s": 3600.0,
        **overrides,
    }
    return Settings(_env_file=None, **values)


async def next_event(sub: Subscription, cls: type[E], within: float = 1.0) -> E:
    """The next queued event of type `cls` (others are skipped)."""
    async with asyncio.timeout(within):
        while True:
            event = await sub.queue.get()
            assert event is not None, "subscription was dropped"
            if isinstance(event, cls):
                return event


def drain(sub: Subscription) -> list[HwEnvelope]:
    """Everything queued right now, without waiting."""
    events: list[HwEnvelope] = []
    while not sub.queue.empty():
        event = sub.queue.get_nowait()
        if event is not None:
            events.append(event)
    return events


def http_client(*routers: APIRouter) -> httpx.AsyncClient:
    """An in-process client for just these routers (no lifespan: start services yourself)."""
    app = FastAPI()
    for router in routers:
        app.include_router(router)
    return httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://hw")
