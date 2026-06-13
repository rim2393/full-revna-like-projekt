from uuid import UUID

from fastapi import status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import APIError
from app.core.rbac import Principal
from app.domains.audit.service import record_audit_event
from app.domains.node_plugins.models import NodePlugin
from app.domains.node_plugins.schemas import (
    NodePluginApplyRequest,
    NodePluginCloneRequest,
    NodePluginCreateRequest,
    NodePluginListResponse,
    NodePluginRecord,
    NodePluginReorderRequest,
    NodePluginUpdateRequest,
)
from app.domains.nodes.models import NodeCommand
from app.domains.nodes.schemas import NodeCommandCreateRequest
from app.domains.nodes.service import enqueue_node_command

SECRET_FIELD_FRAGMENTS = frozenset(
    {
        "password",
        "privatekey",
        "private_key",
        "secret",
        "token",
        "subscription_url",
        "runtime_config",
    }
)


def _record(plugin: NodePlugin) -> NodePluginRecord:
    return NodePluginRecord(
        id=plugin.id,
        node_id=plugin.node_id,
        kind=plugin.kind,
        name=plugin.name,
        config_json=plugin.config_json or {},
        enabled=plugin.enabled,
        sort_order=plugin.sort_order,
        created_at=plugin.created_at,
        updated_at=plugin.updated_at,
    )


async def list_plugins(
    session: AsyncSession,
    *,
    node_id: UUID | None = None,
) -> NodePluginListResponse:
    stmt = select(NodePlugin).order_by(NodePlugin.sort_order.asc(), NodePlugin.name.asc())
    if node_id is not None:
        # Return both node-specific and global (null-bound) plugins for a node.
        stmt = stmt.where(
            (NodePlugin.node_id == node_id) | (NodePlugin.node_id.is_(None))
        )
    result = await session.execute(stmt)
    return NodePluginListResponse(items=[_record(p) for p in result.scalars().all()])


async def list_effective_node_plugins(
    session: AsyncSession,
    *,
    node_id: UUID,
) -> list[NodePlugin]:
    """Return enabled global and node-bound plugins that must reach node-agent."""

    result = await session.execute(
        select(NodePlugin)
        .where(NodePlugin.enabled.is_(True))
        .where((NodePlugin.node_id == node_id) | (NodePlugin.node_id.is_(None)))
        .order_by(
            NodePlugin.node_id.is_(None).desc(),
            NodePlugin.sort_order.asc(),
            NodePlugin.name.asc(),
        )
    )
    return list(result.scalars().all())


def plugin_policy_records(plugins: list[NodePlugin]) -> list[dict[str, object]]:
    return [
        {
            "id": str(plugin.id),
            "nodeId": str(plugin.node_id) if plugin.node_id is not None else None,
            "kind": plugin.kind,
            "name": plugin.name,
            "config": dict(plugin.config_json or {}),
            "enabled": plugin.enabled,
            "sortOrder": plugin.sort_order,
        }
        for plugin in plugins
    ]


def _ensure_plugin_config_has_no_inline_secrets(config: dict[str, object]) -> None:
    def visit(value: object, path: str) -> None:
        if isinstance(value, dict):
            for key, child in value.items():
                normalized = str(key).replace("-", "_").lower()
                if any(fragment in normalized for fragment in SECRET_FIELD_FRAGMENTS):
                    raise APIError(
                        code="node_plugin_inline_secret_rejected",
                        message="Inline secret-like fields are not accepted in node plugin config.",
                        status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                        details=[f"{path}.{key}"],
                    )
                visit(child, f"{path}.{key}")
        elif isinstance(value, list):
            for index, child in enumerate(value):
                visit(child, f"{path}[{index}]")

    visit(config, "config_json")


async def _next_sort_order(session: AsyncSession) -> int:
    result = await session.execute(
        select(NodePlugin.sort_order).order_by(NodePlugin.sort_order.desc())
    )
    current = result.scalars().first()
    return 0 if current is None else current + 10


async def create_plugin(
    session: AsyncSession,
    *,
    request: NodePluginCreateRequest,
    principal: Principal,
) -> NodePluginRecord:
    _ensure_plugin_config_has_no_inline_secrets(request.config_json)
    plugin = NodePlugin(
        node_id=request.node_id,
        kind=request.kind,
        name=request.name,
        config_json=request.config_json,
        enabled=request.enabled,
        sort_order=request.sort_order
        if request.sort_order is not None
        else await _next_sort_order(session),
    )
    session.add(plugin)
    await session.flush()
    await record_audit_event(
        session,
        principal=principal,
        action="node_plugin.created",
        resource_type="node_plugin",
        resource_id=str(plugin.id),
        metadata_json={"kind": plugin.kind},
    )
    await session.commit()
    return _record(plugin)


async def _get_plugin(session: AsyncSession, plugin_id: UUID) -> NodePlugin:
    plugin = await session.get(NodePlugin, plugin_id)
    if plugin is None:
        raise APIError(
            code="node_plugin_not_found",
            message="Node plugin not found",
            status_code=status.HTTP_404_NOT_FOUND,
        )
    return plugin


async def update_plugin(
    session: AsyncSession,
    *,
    plugin_id: UUID,
    request: NodePluginUpdateRequest,
    principal: Principal,
) -> NodePluginRecord:
    plugin = await _get_plugin(session, plugin_id)
    if "config_json" in request.model_fields_set:
        if request.config_json is None:
            raise APIError(
                code="node_plugin_config_required",
                message="Node plugin config_json must be an object.",
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                details=["config_json"],
            )
        _ensure_plugin_config_has_no_inline_secrets(request.config_json)
    if "node_id" in request.model_fields_set:
        plugin.node_id = request.node_id
    if request.kind is not None:
        plugin.kind = request.kind
    if request.name is not None:
        plugin.name = request.name
    if "config_json" in request.model_fields_set:
        plugin.config_json = request.config_json
    if request.enabled is not None:
        plugin.enabled = request.enabled
    if request.sort_order is not None:
        plugin.sort_order = request.sort_order
    await record_audit_event(
        session,
        principal=principal,
        action="node_plugin.updated",
        resource_type="node_plugin",
        resource_id=str(plugin.id),
    )
    await session.commit()
    return _record(plugin)


async def clone_plugin(
    session: AsyncSession,
    *,
    plugin_id: UUID,
    request: NodePluginCloneRequest,
    principal: Principal,
) -> NodePluginRecord:
    source = await _get_plugin(session, plugin_id)
    plugin = NodePlugin(
        node_id=request.node_id if request.node_id is not None else source.node_id,
        kind=source.kind,
        name=request.name or f"{source.name} copy",
        config_json=dict(source.config_json or {}),
        enabled=source.enabled if request.enabled is None else request.enabled,
        sort_order=await _next_sort_order(session),
    )
    session.add(plugin)
    await session.flush()
    await record_audit_event(
        session,
        principal=principal,
        action="node_plugin.cloned",
        resource_type="node_plugin",
        resource_id=str(plugin.id),
        metadata_json={"source_id": str(source.id), "kind": plugin.kind},
    )
    await session.commit()
    return _record(plugin)


async def reorder_plugins(
    session: AsyncSession,
    *,
    request: NodePluginReorderRequest,
    principal: Principal,
) -> NodePluginListResponse:
    plugin_ids = [item.id for item in request.items]
    result = await session.execute(select(NodePlugin).where(NodePlugin.id.in_(plugin_ids)))
    plugins_by_id = {plugin.id: plugin for plugin in result.scalars().all()}
    missing_ids = [plugin_id for plugin_id in plugin_ids if plugin_id not in plugins_by_id]
    if missing_ids:
        raise APIError(
            code="node_plugin_not_found",
            message="One or more node plugins were not found.",
            status_code=status.HTTP_404_NOT_FOUND,
            details=[str(plugin_id) for plugin_id in missing_ids],
        )
    for item in request.items:
        plugins_by_id[item.id].sort_order = item.sort_order
    await record_audit_event(
        session,
        principal=principal,
        action="node_plugin.reordered",
        resource_type="node_plugin",
        resource_id="node_plugins",
        metadata_json={"count": len(request.items)},
    )
    await session.commit()
    return await list_plugins(session)


async def apply_plugins_to_node(
    session: AsyncSession,
    *,
    request: NodePluginApplyRequest,
    principal: Principal,
) -> NodeCommand:
    from app.domains.ip_control.service import build_ip_control_policy

    plugins = await list_effective_node_plugins(session, node_id=request.node_id)
    ip_control = await build_ip_control_policy(session)
    node_policy: dict[str, object] = {
        "modelVersion": "lumen.node-policy.v1",
        "plugins": plugin_policy_records(plugins),
    }
    if ip_control is not None:
        node_policy["ipControl"] = ip_control
    command = await enqueue_node_command(
        session,
        node_id=request.node_id,
        request=NodeCommandCreateRequest(
            command_type="firewall.plan.apply",
            payload_json={
                "nodePolicy": node_policy,
                "reason": request.reason or "operator applied node plugin policy",
            },
        ),
    )
    await record_audit_event(
        session,
        principal=principal,
        action="node_plugin.policy_apply_queued",
        resource_type="node",
        resource_id=str(request.node_id),
        metadata_json={"command_id": str(command.id), "plugins": len(plugins)},
    )
    await session.commit()
    return command


async def delete_plugin(
    session: AsyncSession,
    *,
    plugin_id: UUID,
    principal: Principal,
) -> None:
    plugin = await _get_plugin(session, plugin_id)
    await session.delete(plugin)
    await record_audit_event(
        session,
        principal=principal,
        action="node_plugin.deleted",
        resource_type="node_plugin",
        resource_id=str(plugin_id),
    )
    await session.commit()
