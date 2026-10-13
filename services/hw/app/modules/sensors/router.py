from fastapi import APIRouter

from app.modules.sensors.service import SensorsService


def build_router(service: SensorsService) -> APIRouter:
    """Sensors have no commands; readings arrive only on GET /v1/events."""
    return APIRouter(prefix="/v1/sensors", tags=["sensors"])
