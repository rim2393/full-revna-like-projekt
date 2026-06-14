from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

import pytest
from pydantic import SecretStr
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.core.config import Settings
from app.core.errors import APIError
from app.db.base import Base
from app.db.models import Node, NodeCommand, NodeInstallToken, NodeMetric, NodeProvisioningJob
from app.db.session import create_engine
from app.domains.nodes.schemas import (
    InstallTokenExchangeRequest,
    NodeCommandCreateRequest,
    NodeCommandResultRequest,
    NodeHeartbeatRequest,
    NodeResumeRequest,
    NodeStatus,
)
from app.domains.nodes.service import (
    claim_next_node_command,
    complete_node_command,
    enqueue_node_command,
    exchange_install_token,
    get_node_overview,
    hash_node_token,
    issue_install_token,
    record_node_heartbeat,
    resume_node,
)


def _settings(database_url: str) -> Settings:
    return Settings(
        database_url=database_url,
        node_token_hash_pepper=SecretStr("test-node-token-pepper"),
    )


@pytest.mark.asyncio
async def test_enqueue_node_command_rejects_inline_secret_payload(tmp_path):
    settings = _settings(f"sqlite+aiosqlite:///{tmp_path / 'api.db'}")
    engine = create_engine(settings)
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)

    sessionmaker = async_sessionmaker(engine, expire_on_commit=False, autoflush=False)
    try:
        async with sessionmaker() as session:
            node = Node(
                id=uuid4(),
                name="secret-payload-node",
                region="test",
                public_address="127.0.0.1",
                status="active",
            )
            session.add(node)
            await session.flush()

            with pytest.raises(APIError) as error:
                await enqueue_node_command(
                    session,
                    node_id=node.id,
                    request=NodeCommandCreateRequest(
                        command_type="outbound.apply",
                        payload_json={
                            "adapter": "vless-reality",
                            "api_token": "must-not-inline",
                            "xrayConfig": {"inbounds": []},
                        },
                    ),
                )

            assert error.value.code == "inline_secret_rejected"
            assert "payload_json.api_token" in error.value.details
            assert not session.new
    finally:
        await engine.dispose()


async def _create_expired_install_token(
    session,
    settings: Settings,
) -> tuple[NodeProvisioningJob, NodeInstallToken, str]:
    job_id = uuid4()
    node = Node(
        id=uuid4(),
        name="expired-token-node",
        region="test",
        public_address="127.0.0.1",
        status="provisioning",
    )
    job = NodeProvisioningJob(
        id=job_id,
        idempotency_key="expired-token-job",
        node_id=node.id,
        kind="node.provision",
        status="install_token_issued",
        preflight_status="passed",
        ssh_host="127.0.0.1",
        ssh_port=22,
        ssh_username="root",
        ssh_credentials_ref="secret-store://node/test",
        requested_capabilities={},
        preflight_result={},
        token_issued_at=datetime(2026, 6, 13, tzinfo=UTC) - timedelta(hours=1),
    )
    plaintext = "lumen_it_expired_test_token"
    token = NodeInstallToken(
        provisioning_job_id=job_id,
        token_prefix=plaintext[:18],
        token_hash=hash_node_token(plaintext, settings),
        expires_at=datetime(2026, 6, 13, tzinfo=UTC) - timedelta(minutes=1),
    )
    session.add_all([node, job, token])
    await session.flush()
    return job, token, plaintext


@pytest.mark.asyncio
async def test_issue_install_token_marks_expired_existing_token_failed(tmp_path):
    settings = _settings(f"sqlite+aiosqlite:///{tmp_path / 'api.db'}")
    engine = create_engine(settings)
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)

    sessionmaker = async_sessionmaker(engine, expire_on_commit=False, autoflush=False)
    try:
        async with sessionmaker() as session:
            job, token, _ = await _create_expired_install_token(session, settings)

            with pytest.raises(APIError) as error:
                await issue_install_token(session, job_id=job.id, settings=settings)

            assert error.value.code == "install_token_expired"
            assert job.status == "failed"
            assert job.error_code == "install_token_expired"
            assert token.used_at is not None
            node = await session.get(Node, job.node_id)
            assert node is not None
            assert node.status == "failed"
    finally:
        await engine.dispose()


@pytest.mark.asyncio
async def test_resume_command_pending_control_clears_after_node_success(tmp_path):
    settings = _settings(f"sqlite+aiosqlite:///{tmp_path / 'api.db'}")
    engine = create_engine(settings)
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)

    sessionmaker = async_sessionmaker(engine, expire_on_commit=False, autoflush=False)
    try:
        async with sessionmaker() as session:
            node_token = "node-token-for-control-command"  # noqa: S105 - synthetic test credential.
            node = Node(
                id=uuid4(),
                name="control-node",
                region="test",
                public_address="127.0.0.1",
                status=NodeStatus.PAUSED.value,
                agent_token_hash=hash_node_token(node_token, settings),
            )
            session.add(node)
            await session.flush()

            resumed = await resume_node(
                session,
                node_id=node.id,
                request=NodeResumeRequest(target_status=NodeStatus.ACTIVE),
            )
            assert resumed.status == NodeStatus.PAUSED.value
            assert resumed.capabilities["pending_control_command_type"] == "node.resume"
            assert resumed.capabilities["pending_control_target_status"] == NodeStatus.ACTIVE.value

            command = await session.get(
                NodeCommand,
                UUID(str(resumed.capabilities["pending_control_command_id"])),
            )
            assert command is not None
            assert command.status == "queued"
            command.status = "claimed"
            command.claimed_at = datetime(2026, 6, 13, tzinfo=UTC)

            completed = await complete_node_command(
                session,
                node_id=node.id,
                command_id=command.id,
                node_token=SecretStr(node_token),
                request=NodeCommandResultRequest(
                    status="succeeded",
                    result_json={"status": "resumed"},
                ),
                settings=settings,
            )

            assert completed.status == "succeeded"
            assert node.status == NodeStatus.ACTIVE.value
            assert "pending_control_command_id" not in node.capabilities
            assert "pending_control_command_type" not in node.capabilities
            assert "pending_control_target_status" not in node.capabilities
    finally:
        await engine.dispose()


@pytest.mark.asyncio
async def test_claim_next_node_command_requeues_stale_claimed_command(tmp_path):
    settings = _settings(f"sqlite+aiosqlite:///{tmp_path / 'api.db'}")
    engine = create_engine(settings)
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)

    sessionmaker = async_sessionmaker(engine, expire_on_commit=False, autoflush=False)
    try:
        async with sessionmaker() as session:
            node_token = "node-token-for-command-claim"  # noqa: S105 - synthetic test credential.
            node = Node(
                id=uuid4(),
                name="claim-node",
                region="test",
                public_address="127.0.0.1",
                status=NodeStatus.ACTIVE.value,
                agent_token_hash=hash_node_token(node_token, settings),
            )
            stale = NodeCommand(
                node_id=node.id,
                command_type="capabilities.report",
                status="claimed",
                payload_json={},
                claimed_at=datetime(2026, 6, 13, tzinfo=UTC) - timedelta(minutes=10),
            )
            queued = NodeCommand(
                node_id=node.id,
                command_type="conflict.scan",
                status="queued",
                payload_json={},
                created_at=datetime(2026, 6, 13, tzinfo=UTC),
            )
            session.add_all([node, stale, queued])
            await session.flush()

            claimed = await claim_next_node_command(
                session,
                node_id=node.id,
                node_token=SecretStr(node_token),
                settings=settings,
            )

            assert claimed is not None
            assert claimed.id == queued.id
            assert claimed.status == "claimed"
            assert claimed.claimed_at is not None
            assert stale.status == "queued"
            assert stale.claimed_at is None
    finally:
        await engine.dispose()


@pytest.mark.asyncio
async def test_exchange_install_token_marks_expired_token_failed(tmp_path):
    settings = _settings(f"sqlite+aiosqlite:///{tmp_path / 'api.db'}")
    engine = create_engine(settings)
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)

    sessionmaker = async_sessionmaker(engine, expire_on_commit=False, autoflush=False)
    try:
        async with sessionmaker() as session:
            job, token, plaintext = await _create_expired_install_token(session, settings)

            with pytest.raises(APIError) as error:
                await exchange_install_token(
                    session,
                    request=InstallTokenExchangeRequest(install_token=SecretStr(plaintext)),
                    settings=settings,
                )

            assert error.value.code == "invalid_install_token"
            assert job.status == "failed"
            assert job.error_code == "install_token_expired"
            assert token.used_at is not None
            node = await session.get(Node, job.node_id)
            assert node is not None
            assert node.status == "failed"
    finally:
        await engine.dispose()


@pytest.mark.asyncio
async def test_install_token_exchange_heartbeat_and_overview_lifecycle(tmp_path):
    settings = _settings(f"sqlite+aiosqlite:///{tmp_path / 'api.db'}")
    engine = create_engine(settings)
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)

    sessionmaker = async_sessionmaker(engine, expire_on_commit=False, autoflush=False)
    try:
        async with sessionmaker() as session:
            node = Node(
                id=uuid4(),
                name="lifecycle-node",
                region="test",
                public_address="127.0.0.1",
                status="provisioning",
            )
            job = NodeProvisioningJob(
                id=uuid4(),
                idempotency_key="lifecycle-token-job",
                node_id=node.id,
                kind="node.provision",
                status="preflight_passed",
                preflight_status="passed",
                ssh_host="127.0.0.1",
                ssh_port=22,
                ssh_username="root",
                ssh_credentials_ref="secret-store://node/lifecycle",
                requested_capabilities={},
                preflight_result={},
            )
            session.add_all([node, job])
            await session.flush()

            issued = await issue_install_token(session, job_id=job.id, settings=settings)
            assert issued.plaintext.startswith("lumen_it_")
            assert issued.token.token_prefix == issued.plaintext[:18]
            assert issued.token.token_hash != issued.plaintext
            assert job.status == "install_token_issued"
            assert job.token_issued_at is not None

            exchanged = await exchange_install_token(
                session,
                request=InstallTokenExchangeRequest(install_token=SecretStr(issued.plaintext)),
                settings=settings,
            )
            assert exchanged.node_token.startswith("lumen_node_")
            assert issued.token.used_at is not None
            assert job.status == "installing"
            assert job.token_exchanged_at is not None
            assert node.status == "installing"
            assert node.agent_token_prefix == exchanged.node.agent_token_prefix
            assert node.agent_token_hash != exchanged.node_token

            await record_node_heartbeat(
                session,
                node_id=node.id,
                node_token=SecretStr(exchanged.node_token),
                request=NodeHeartbeatRequest(
                    status="active",
                    capabilities={"runtime.xray_core": "true"},
                ),
                settings=settings,
            )
            assert node.status == "active"
            assert node.last_seen_at is not None
            assert job.status == "active"

            metric = NodeMetric(
                node_id=node.id,
                metric_kind="traffic",
                values_json={"download_bytes": 120.0, "upload_bytes": 30.0},
                observed_at=datetime(2026, 6, 13, tzinfo=UTC),
            )
            session.add(metric)
            await session.flush()

            overview = await get_node_overview(session, node_id=node.id)
            assert overview.node.status == "active"
            assert overview.node.last_seen_at == node.last_seen_at
            assert overview.latest_metrics[0].metric_kind == "traffic"
            assert overview.traffic.download_bytes == 120.0
            assert overview.traffic.upload_bytes == 30.0
            assert overview.traffic.total_bytes == 150.0
    finally:
        await engine.dispose()
