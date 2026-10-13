"""hw-service entry point: `uv run uvicorn app.main:app --host 127.0.0.1 --port 8081`."""

import asyncio
import ipaddress
import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager, suppress

from fastapi import FastAPI
from sse_starlette import EventSourceResponse

from app.config import Settings
from app.contracts import HwHealth
from app.events import EventBus, event_stream, heartbeat
from app.registry import build_registry
from app.snapshot import HwSnapshot


def require_loopback(host: str) -> None:
    """hw-service is core-api's private backend and never listens on the LAN."""
    try:
        loopback = host == "localhost" or ipaddress.ip_address(host).is_loopback
    except ValueError:
        loopback = False
    if not loopback:
        raise SystemExit(f"HW_HOST must be a loopback address (127.0.0.1), got {host!r}")


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or Settings()
    require_loopback(settings.host)
    logging.basicConfig(level=logging.INFO)
    bus = EventBus(settings.subscriber_queue)
    try:
        registry = build_registry(settings, bus)
    except ValueError as exc:
        raise SystemExit(str(exc)) from exc

    @asynccontextmanager
    async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
        await registry.start()
        beat = asyncio.create_task(heartbeat(bus, settings.heartbeat_s))
        try:
            yield
        finally:
            beat.cancel()
            with suppress(asyncio.CancelledError):
                await beat
            await registry.stop()

    app = FastAPI(title="Eduscope hw-service", version="0.0.0", lifespan=lifespan)
    app.state.bus = bus
    app.state.registry = registry
    for router in registry.routers():
        app.include_router(router)

    @app.get("/v1/health")
    async def health() -> HwHealth:
        return registry.health()

    @app.get("/v1/snapshot")
    async def snapshot() -> HwSnapshot:
        return registry.snapshot()

    @app.get("/v1/events")
    async def events() -> EventSourceResponse:
        return EventSourceResponse(event_stream(bus, registry.snapshot_event))

    return app


app = create_app()
