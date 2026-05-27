from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, status

from app.core.rbac import Permission, Principal, require_permission
from app.domains.api_keys.schemas import (
    ApiKeyCreateRequest,
    ApiKeyCreateResponse,
    ApiKeyListResponse,
)
from app.domains.api_keys.service import not_implemented

router = APIRouter()
ApiKeyManager = Annotated[Principal, Depends(require_permission(Permission.API_KEY_MANAGE))]


@router.get("", response_model=ApiKeyListResponse)
async def list_api_keys(
    _: ApiKeyManager,
) -> ApiKeyListResponse:
    raise not_implemented()


@router.post("", response_model=ApiKeyCreateResponse, status_code=status.HTTP_201_CREATED)
async def create_api_key(
    __: ApiKeyCreateRequest,
    _: ApiKeyManager,
) -> ApiKeyCreateResponse:
    raise not_implemented()


@router.delete("/{api_key_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_api_key(
    api_key_id: UUID,
    _: ApiKeyManager,
) -> None:
    _ = api_key_id
    raise not_implemented()
