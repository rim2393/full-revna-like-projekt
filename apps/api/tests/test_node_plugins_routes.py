from collections.abc import AsyncIterator
from dataclasses import dataclass
from uuid import UUID

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

import app.db.models  # noqa: F401
from app.core.config import Settings, get_settings
from app.core.rbac import Permission, Principal, Role, get_current_principal
from app.db.base import Base
from app.db.session import create_engine, get_db_session
from app.domains.nodes.models import Node, NodeCommand
from app.main import create_app


@dataclass(frozen=True)
class RouteApp:
    client: AsyncClient
    sessionmaker: async_sessionmaker[AsyncSession]


@pytest.fixture
async def route_app(tmp_path) -> AsyncIterator[RouteApp]:
    settings = Settings(
        environment="test",
        database_url=f"sqlite+aiosqlite:///{tmp_path / 'api.db'}",
    )
    engine = create_engine(settings)
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    sessionmaker = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)

    async def override_db_session() -> AsyncIterator[AsyncSession]:
        async with sessionmaker() as session:
            yield session

    async def override_principal() -> Principal:
        return Principal(
            subject="owner",
            email="owner@example.com",
            roles={Role.OWNER},
            permissions={Permission.NODE_MANAGE},
        )

    app = create_app(settings)
    app.dependency_overrides[get_db_session] = override_db_session
    app.dependency_overrides[get_current_principal] = override_principal
    app.dependency_overrides[get_settings] = lambda: settings
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://testserver",
    ) as client:
        yield RouteApp(client=client, sessionmaker=sessionmaker)
    app.dependency_overrides.clear()
    await engine.dispose()


async def test_node_plugin_crud(route_app: RouteApp) -> None:
    created = await route_app.client.post(
        "/api/v1/node-plugins",
        json={
            "kind": "torrent-blocker",
            "name": "Global torrent blocker",
            "config_json": {"mode": "drop", "log": True},
            "sort_order": 20,
        },
    )
    assert created.status_code == 201
    plugin = created.json()
    assert plugin["node_id"] is None
    assert plugin["config_json"]["mode"] == "drop"
    assert plugin["sort_order"] == 20
    plugin_id = plugin["id"]

    listed = await route_app.client.get("/api/v1/node-plugins")
    assert listed.status_code == 200
    assert len(listed.json()["items"]) == 1

    updated = await route_app.client.patch(
        f"/api/v1/node-plugins/{plugin_id}",
        json={"enabled": False, "config_json": {"mode": "log-only"}, "node_id": None},
    )
    assert updated.status_code == 200
    assert updated.json()["enabled"] is False
    assert updated.json()["config_json"]["mode"] == "log-only"

    deleted = await route_app.client.delete(f"/api/v1/node-plugins/{plugin_id}")
    assert deleted.status_code == 204
    final = await route_app.client.get("/api/v1/node-plugins")
    assert final.json()["items"] == []


async def test_node_plugin_rejects_inline_secret_config(route_app: RouteApp) -> None:
    response = await route_app.client.post(
        "/api/v1/node-plugins",
        json={
            "kind": "domain-filter",
            "name": "Bad plugin",
            "config_json": {"nested": {"private_key": "not-allowed"}},
        },
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "node_plugin_inline_secret_rejected"


async def test_node_plugin_clone_reorder_and_apply_queue_real_policy(
    route_app: RouteApp,
) -> None:
    async with route_app.sessionmaker() as session:
        node = Node(
            name="node-plugin-runtime",
            region="test",
            public_address="203.0.113.44",
            status="active",
        )
        session.add(node)
        await session.commit()
        node_id = str(node.id)

    first = await route_app.client.post(
        "/api/v1/node-plugins",
        json={
            "kind": "domain-filter",
            "name": "Domain filter",
            "config_json": {"domains": ["ads.example"]},
            "sort_order": 30,
        },
    )
    second = await route_app.client.post(
        "/api/v1/node-plugins",
        json={
            "kind": "torrent-blocker",
            "name": "Torrent blocker",
            "node_id": node_id,
            "config_json": {"mode": "drop"},
            "sort_order": 10,
        },
    )
    assert first.status_code == 201
    assert second.status_code == 201
    first_id = first.json()["id"]
    second_id = second.json()["id"]

    cloned = await route_app.client.post(
        f"/api/v1/node-plugins/{first_id}/clone",
        json={"name": "Domain filter copy", "node_id": node_id, "enabled": False},
    )
    assert cloned.status_code == 201
    assert cloned.json()["name"] == "Domain filter copy"
    assert cloned.json()["node_id"] == node_id
    assert cloned.json()["enabled"] is False

    reordered = await route_app.client.post(
        "/api/v1/node-plugins/reorder",
        json={
            "items": [
                {"id": first_id, "sort_order": 0},
                {"id": second_id, "sort_order": 40},
            ]
        },
    )
    assert reordered.status_code == 200
    reordered_items = reordered.json()["items"]
    orders_by_name = {item["name"]: item["sort_order"] for item in reordered_items}
    assert orders_by_name["Domain filter"] == 0
    assert orders_by_name["Torrent blocker"] == 40

    applied = await route_app.client.post(
        "/api/v1/node-plugins/apply",
        json={"node_id": node_id, "reason": "qa apply"},
    )
    assert applied.status_code == 201
    command = applied.json()
    assert command["command_type"] == "firewall.plan.apply"
    assert command["status"] == "queued"
    assert command["payload_json"]["reason"] == "qa apply"
    policy = command["payload_json"]["nodePolicy"]
    assert policy["modelVersion"] == "lumen.node-policy.v1"
    assert [plugin["name"] for plugin in policy["plugins"]] == [
        "Domain filter",
        "Torrent blocker",
    ]
    assert policy["plugins"][0]["sortOrder"] == 0

    async with route_app.sessionmaker() as session:
        stored_command = await session.get(NodeCommand, UUID(command["id"]))
        assert stored_command is not None
        assert stored_command.command_type == "firewall.plan.apply"


async def test_node_plugin_missing_returns_404(route_app: RouteApp) -> None:
    response = await route_app.client.patch(
        "/api/v1/node-plugins/00000000-0000-0000-0000-000000000000",
        json={"enabled": False},
    )
    assert response.status_code == 404
