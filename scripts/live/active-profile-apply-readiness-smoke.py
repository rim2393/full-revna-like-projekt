from __future__ import annotations

import asyncio
import json
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.core.config import get_settings
from app.db.session import create_engine
from app.domains.nodes.models import Node, NodeCommand
from app.domains.protocols.models import Host, ProtocolProfile
from app.domains.protocols.service import (
    RUNTIME_SYNC_METADATA_KEY,
    list_profile_runtime_clients,
)


NODE_NAME = "node-01"
APPLY_STATUSES_DONE = {"succeeded", "failed", "cancelled", "skipped"}


def _json_default(value: object) -> str:
    if isinstance(value, datetime):
        return value.astimezone(UTC).isoformat()
    if isinstance(value, UUID):
        return str(value)
    return str(value)


def _runtime_sync(metadata: dict[str, object] | None) -> dict[str, object]:
    if not isinstance(metadata, dict):
        return {}
    value = metadata.get(RUNTIME_SYNC_METADATA_KEY)
    return value if isinstance(value, dict) else {}


def _command_mentions_profile(command: NodeCommand, profile_id: UUID) -> bool:
    payload = command.payload_json if isinstance(command.payload_json, dict) else {}
    profile_id_text = str(profile_id)
    if str(payload.get("profileId") or "") == profile_id_text:
        return True
    profile_ids = payload.get("profileIds")
    return isinstance(profile_ids, list) and profile_id_text in {str(item) for item in profile_ids}


async def _latest_apply_command(session, *, node_id: UUID, profile_id: UUID) -> NodeCommand | None:
    result = await session.execute(
        select(NodeCommand)
        .where(NodeCommand.node_id == node_id)
        .where(NodeCommand.command_type == "outbound.apply")
        .order_by(NodeCommand.created_at.desc())
        .limit(250)
    )
    for command in result.scalars().all():
        if _command_mentions_profile(command, profile_id):
            return command
    return None


async def _active_host_count(session, *, profile_id: UUID) -> int:
    result = await session.execute(
        select(Host)
        .where(Host.protocol_profile_id == profile_id)
        .where(Host.status == "active")
        .where(Host.hidden.is_(False))
        .where(Host.subscription_excluded.is_(False))
    )
    return len(result.scalars().all())


def _command_record(command: NodeCommand | None) -> dict[str, Any] | None:
    if command is None:
        return None
    result = command.result_json if isinstance(command.result_json, dict) else {}
    return {
        "id": str(command.id),
        "status": command.status,
        "created_at": command.created_at,
        "claimed_at": command.claimed_at,
        "completed_at": command.completed_at,
        "error_code": command.error_code,
        "implementation_status": result.get("implementationStatus"),
        "adapter": (
            command.payload_json.get("adapter")
            if isinstance(command.payload_json, dict)
            else None
        ),
    }


async def main() -> None:
    settings = get_settings()
    engine = create_engine(settings)
    sessionmaker = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
    try:
        async with sessionmaker() as session:
            node = (
                await session.execute(
                    select(Node).where(Node.name == NODE_NAME).order_by(Node.created_at.desc())
                )
            ).scalar_one_or_none()
            if node is None:
                raise RuntimeError(f"Real node {NODE_NAME!r} was not found")
            if node.status != "active":
                raise RuntimeError(f"Real node {NODE_NAME!r} is not active: {node.status}")

            profiles = (
                (
                    await session.execute(
                        select(ProtocolProfile)
                        .where(ProtocolProfile.node_id == node.id)
                        .where(ProtocolProfile.status == "active")
                        .order_by(ProtocolProfile.adapter.asc(), ProtocolProfile.created_at.asc())
                    )
                )
                .scalars()
                .all()
            )
            if not profiles:
                raise RuntimeError(f"No active real profiles exist on {NODE_NAME!r}")

            records: list[dict[str, Any]] = []
            for profile in profiles:
                runtime_clients = await list_profile_runtime_clients(session, profile=profile)
                host_count = await _active_host_count(session, profile_id=profile.id)
                latest_command = await _latest_apply_command(
                    session,
                    node_id=node.id,
                    profile_id=profile.id,
                )
                latest_record = _command_record(latest_command)
                sync = _runtime_sync(profile.metadata_json)
                apply_ready = host_count > 0 and len(runtime_clients) > 0
                applied = (
                    latest_record is not None
                    and latest_record["status"] == "succeeded"
                    and sync.get("pending_apply") is not True
                    and sync.get("status") in {"applied", "apply_succeeded", "succeeded"}
                )
                records.append(
                    {
                        "profile_id": str(profile.id),
                        "name": profile.name,
                        "adapter": profile.adapter,
                        "active_hosts": host_count,
                        "runtime_clients": len(runtime_clients),
                        "apply_ready": apply_ready,
                        "runtime_sync_status": sync.get("status"),
                        "pending_apply": sync.get("pending_apply"),
                        "last_command_id": sync.get("last_command_id"),
                        "latest_apply_command": latest_record,
                        "latest_apply_done": (
                            latest_record is not None
                            and latest_record["status"] in APPLY_STATUSES_DONE
                        ),
                        "applied_evidence": applied,
                    }
                )

            summary = {
                "node": {
                    "id": str(node.id),
                    "name": node.name,
                    "status": node.status,
                    "last_seen_at": node.last_seen_at,
                },
                "total_active_profiles": len(records),
                "apply_ready_profiles": sum(1 for item in records if item["apply_ready"]),
                "profiles_without_runtime_clients": [
                    item["name"] for item in records if item["runtime_clients"] == 0
                ],
                "profiles_without_active_hosts": [
                    item["name"] for item in records if item["active_hosts"] == 0
                ],
                "profiles_with_failed_latest_apply": [
                    item["name"]
                    for item in records
                    if item["latest_apply_command"]
                    and item["latest_apply_command"]["status"] == "failed"
                ],
                "profiles_with_pending_apply": [
                    item["name"] for item in records if item["pending_apply"] is True
                ],
                "applied_evidence_profiles": sum(
                    1 for item in records if item["applied_evidence"]
                ),
                "records": records,
            }
            print(json.dumps(summary, indent=2, ensure_ascii=False, default=_json_default))
    finally:
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
