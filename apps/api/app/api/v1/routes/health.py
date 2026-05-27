from datetime import UTC, datetime

from fastapi import APIRouter

from app.schemas.health import HealthResponse, ReadinessResponse

router = APIRouter()


@router.get("/health/live", response_model=HealthResponse)
async def liveness() -> HealthResponse:
    return HealthResponse(status="ok", checked_at=datetime.now(UTC))


@router.get("/health/ready", response_model=ReadinessResponse)
async def readiness() -> ReadinessResponse:
    return ReadinessResponse(status="ok", dependencies={"api": "ok"})

