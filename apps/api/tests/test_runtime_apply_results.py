from datetime import UTC, datetime
from uuid import uuid4

import pytest
from pydantic import SecretStr
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.core.config import Settings
from app.db.base import Base
from app.db.models import Node, NodeCommand
from app.db.session import create_engine
from app.domains.nodes.schemas import NodeCommandResultRequest
from app.domains.nodes.service import complete_node_command, hash_node_token
from app.domains.protocols.models import Host, ProtocolProfile
from app.domains.protocols.service import record_outbound_apply_result


@pytest.mark.asyncio
@pytest.mark.parametrize("command_status", ["skipped", "cancelled"])
async def test_terminal_apply_result_clears_pending_runtime_sync(tmp_path, command_status: str):
    engine = create_engine(Settings(database_url=f"sqlite+aiosqlite:///{tmp_path / 'api.db'}"))
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)

    sessionmaker = async_sessionmaker(engine, expire_on_commit=False, autoflush=False)
    try:
        async with sessionmaker() as session:
            node_id = uuid4()
            profile_id = uuid4()
            node = Node(
                id=node_id,
                name=f"node-{command_status}",
                region="test",
                public_address="127.0.0.1",
                status="active",
            )
            profile = ProtocolProfile(
                id=profile_id,
                name=f"profile-{command_status}",
                node_id=node_id,
                adapter="vless-reality",
                config_json={},
                metadata_json={"runtime_sync": {"pending_apply": True, "status": "pending_apply"}},
                port_reservations=[],
            )
            host = Host(
                name=f"host-{command_status}",
                hostname=f"{command_status}.example.test",
                node_id=node_id,
                protocol_profile_id=profile_id,
                status="active",
                metadata_json={"runtime_sync": {"pending_apply": True, "status": "pending_apply"}},
            )
            command = NodeCommand(
                node_id=node_id,
                command_type="outbound.apply",
                status=command_status,
                payload_json={"profileIds": [str(profile_id)]},
                result_json={},
                error_code=f"apply_{command_status}",
                error_message=f"Apply {command_status}",
                completed_at=datetime(2026, 6, 13, tzinfo=UTC),
            )
            session.add_all([node, profile, host, command])
            await session.flush()

            await record_outbound_apply_result(session, command=command)

            assert profile.metadata_json["runtime_sync"] == {
                "error_code": f"apply_{command_status}",
                "error_message": f"Apply {command_status}",
                "last_command_id": str(command.id),
                "last_terminal_at": "2026-06-13T00:00:00+00:00",
                "node_id": str(node.id),
                "pending_apply": False,
                "status": f"apply_{command_status}",
                "terminal_command_id": str(command.id),
            }
            assert host.metadata_json["runtime_sync"]["pending_apply"] is False
            assert host.metadata_json["runtime_sync"]["status"] == f"apply_{command_status}"
    finally:
        await engine.dispose()


@pytest.mark.asyncio
async def test_node_agent_successful_apply_result_marks_profile_and_host_applied(tmp_path):
    settings = Settings(
        database_url=f"sqlite+aiosqlite:///{tmp_path / 'api.db'}",
        node_token_hash_pepper=SecretStr("test-node-token-pepper"),
    )
    engine = create_engine(settings)
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)

    sessionmaker = async_sessionmaker(engine, expire_on_commit=False, autoflush=False)
    try:
        async with sessionmaker() as session:
            node_id = uuid4()
            profile_id = uuid4()
            node_token = "node-token-for-apply-result"  # noqa: S105 - synthetic test credential.
            node = Node(
                id=node_id,
                name="node-apply-success",
                region="test",
                public_address="127.0.0.1",
                status="active",
                agent_token_hash=hash_node_token(node_token, settings),
            )
            profile = ProtocolProfile(
                id=profile_id,
                name="profile-apply-success",
                node_id=node_id,
                adapter="vless-reality",
                config_json={},
                metadata_json={
                    "runtime_sync": {
                        "changed_fields": ["config_json"],
                        "pending_apply": True,
                        "status": "apply_queued",
                    }
                },
                port_reservations=[],
            )
            host = Host(
                name="host-apply-success",
                hostname="apply-success.example.test",
                node_id=node_id,
                protocol_profile_id=profile_id,
                status="active",
                metadata_json={
                    "runtime_sync": {
                        "changed_fields": ["hostname"],
                        "pending_apply": True,
                        "status": "apply_queued",
                    }
                },
            )
            command = NodeCommand(
                node_id=node_id,
                command_type="outbound.apply",
                status="claimed",
                payload_json={"adapter": "vless-reality", "profileIds": [str(profile_id)]},
                claimed_at=datetime(2026, 6, 13, 0, 0, tzinfo=UTC),
            )
            session.add_all([node, profile, host, command])
            await session.flush()

            completed = await complete_node_command(
                session,
                node_id=node_id,
                command_id=command.id,
                node_token=SecretStr(node_token),
                request=NodeCommandResultRequest(
                    status="succeeded",
                    result_json={"implementationStatus": "applied"},
                ),
                settings=settings,
            )

            assert completed.status == "succeeded"
            assert profile.metadata_json["runtime_sync"]["status"] == "applied"
            assert profile.metadata_json["runtime_sync"]["pending_apply"] is False
            assert profile.metadata_json["runtime_sync"]["applied_command_id"] == str(command.id)
            assert "changed_fields" not in profile.metadata_json["runtime_sync"]
            assert host.metadata_json["runtime_sync"]["status"] == "applied"
            assert host.metadata_json["runtime_sync"]["pending_apply"] is False
            assert host.metadata_json["runtime_sync"]["applied_command_id"] == str(command.id)
    finally:
        await engine.dispose()
