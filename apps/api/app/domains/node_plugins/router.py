from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.rbac import Permission, Principal, require_permission
from app.db.session import get_db_session
from app.domains.node_plugins.schemas import (
    NodePluginApplyRequest,
    NodePluginCloneRequest,
    NodePluginCreateRequest,
    NodePluginListResponse,
    NodePluginRecord,
    NodePluginReorderRequest,
    NodePluginUpdateRequest,
)
from app.domains.node_plugins.service import (
    apply_plugins_to_node,
    clone_plugin,
    create_plugin,
    delete_plugin,
    list_plugins,
    reorder_plugins,
    update_plugin,
)
from app.domains.nodes.models import NodeCommand
from app.domains.nodes.schemas import NodeCommandResponse

router = APIRouter()
NodePluginManager = Annotated[Principal, Depends(require_permission(Permission.NODE_MANAGE))]
DatabaseSession = Annotated[AsyncSession, Depends(get_db_session)]


def node_command_response(command: NodeCommand) -> NodeCommandResponse:
    return NodeCommandResponse(
        id=command.id,
        node_id=command.node_id,
        command_type=command.command_type,
        status=command.status,
        payload_json=command.payload_json,
        result_json=command.result_json,
        error_code=command.error_code,
        error_message=command.error_message,
        claimed_at=command.claimed_at,
        completed_at=command.completed_at,
        created_at=command.created_at,
        updated_at=command.updated_at,
    )


@router.get("", response_model=NodePluginListResponse)
async def read_node_plugins(
    _: NodePluginManager,
    session: DatabaseSession,
    node_id: Annotated[UUID | None, Query()] = None,
) -> NodePluginListResponse:
    return await list_plugins(session, node_id=node_id)


@router.post("", response_model=NodePluginRecord, status_code=201)
async def create_node_plugin(
    request: NodePluginCreateRequest,
    principal: NodePluginManager,
    session: DatabaseSession,
) -> NodePluginRecord:
    return await create_plugin(session, request=request, principal=principal)


@router.post("/reorder", response_model=NodePluginListResponse)
async def reorder_node_plugins(
    request: NodePluginReorderRequest,
    principal: NodePluginManager,
    session: DatabaseSession,
) -> NodePluginListResponse:
    return await reorder_plugins(session, request=request, principal=principal)


@router.post("/apply", response_model=NodeCommandResponse, status_code=201)
async def apply_node_plugins(
    request: NodePluginApplyRequest,
    principal: NodePluginManager,
    session: DatabaseSession,
) -> NodeCommandResponse:
    command = await apply_plugins_to_node(session, request=request, principal=principal)
    return node_command_response(command)


@router.post("/{plugin_id}/clone", response_model=NodePluginRecord, status_code=201)
async def clone_node_plugin(
    plugin_id: UUID,
    request: NodePluginCloneRequest,
    principal: NodePluginManager,
    session: DatabaseSession,
) -> NodePluginRecord:
    return await clone_plugin(session, plugin_id=plugin_id, request=request, principal=principal)


@router.patch("/{plugin_id}", response_model=NodePluginRecord)
async def update_node_plugin(
    plugin_id: UUID,
    request: NodePluginUpdateRequest,
    principal: NodePluginManager,
    session: DatabaseSession,
) -> NodePluginRecord:
    return await update_plugin(session, plugin_id=plugin_id, request=request, principal=principal)


@router.delete("/{plugin_id}", status_code=204)
async def delete_node_plugin(
    plugin_id: UUID,
    principal: NodePluginManager,
    session: DatabaseSession,
) -> None:
    await delete_plugin(session, plugin_id=plugin_id, principal=principal)
