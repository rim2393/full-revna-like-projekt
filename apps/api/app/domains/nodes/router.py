from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, status

from app.core.rbac import Permission, Principal, require_permission
from app.domains.nodes.schemas import NodeCreateRequest, NodeListResponse, NodeResponse
from app.domains.nodes.service import not_implemented

router = APIRouter()
NodeManager = Annotated[Principal, Depends(require_permission(Permission.NODE_MANAGE))]


@router.get("", response_model=NodeListResponse)
async def list_nodes(
    _: NodeManager,
) -> NodeListResponse:
    raise not_implemented()


@router.post("", response_model=NodeResponse, status_code=status.HTTP_201_CREATED)
async def create_node(
    __: NodeCreateRequest,
    _: NodeManager,
) -> NodeResponse:
    raise not_implemented()


@router.get("/{node_id}", response_model=NodeResponse)
async def get_node(
    node_id: UUID,
    _: NodeManager,
) -> NodeResponse:
    _ = node_id
    raise not_implemented()
