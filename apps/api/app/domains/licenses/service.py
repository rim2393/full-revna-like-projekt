from datetime import UTC, datetime

from fastapi import status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.core.errors import APIError
from app.domains.licenses.models import License
from app.domains.nodes.models import Node


def utc_now() -> datetime:
    return datetime.now(UTC)


def ensure_aware(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value


def is_active_license(license_record: License, *, now: datetime | None = None) -> bool:
    checked_at = now or utc_now()
    starts_at = (
        ensure_aware(license_record.starts_at) if license_record.starts_at is not None else None
    )
    expires_at = (
        ensure_aware(license_record.expires_at) if license_record.expires_at is not None else None
    )
    if license_record.status != "active":
        return False
    if starts_at is not None and starts_at > checked_at:
        return False
    return not (expires_at is not None and expires_at <= checked_at)


async def get_effective_node_limit(session: AsyncSession, settings: Settings) -> int:
    result = await session.execute(select(License))
    active_limits = [
        license_record.max_devices
        for license_record in result.scalars()
        if is_active_license(license_record)
    ]
    return max([settings.free_license_node_limit, *active_limits])


async def count_policy_nodes(session: AsyncSession) -> int:
    result = await session.execute(
        select(func.count()).select_from(Node).where(Node.status != "deleted")
    )
    return result.scalar_one()


async def enforce_free_node_policy(
    session: AsyncSession,
    settings: Settings,
    *,
    requested_nodes: int = 1,
) -> None:
    current_nodes = await count_policy_nodes(session)
    effective_limit = await get_effective_node_limit(session, settings)
    if current_nodes + requested_nodes > effective_limit:
        raise APIError(
            code="license_node_limit_exceeded",
            message="The current license policy does not allow more nodes.",
            status_code=status.HTTP_403_FORBIDDEN,
            details=[
                f"current_nodes={current_nodes}",
                f"requested_nodes={requested_nodes}",
                f"effective_limit={effective_limit}",
            ],
        )


def not_implemented() -> APIError:
    return APIError(
        code="licenses_not_implemented",
        message="License service is not implemented yet.",
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
    )
