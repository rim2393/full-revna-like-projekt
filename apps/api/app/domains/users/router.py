from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends

from app.core.rbac import Permission, Principal, require_permission
from app.domains.users.schemas import UserCreateRequest, UserListResponse, UserResponse
from app.domains.users.service import not_implemented

router = APIRouter()
UserManager = Annotated[Principal, Depends(require_permission(Permission.USER_MANAGE))]


@router.get("", response_model=UserListResponse)
async def list_users(
    _: UserManager,
) -> UserListResponse:
    raise not_implemented()


@router.post("", response_model=UserResponse, status_code=201)
async def create_user(
    __: UserCreateRequest,
    _: UserManager,
) -> UserResponse:
    raise not_implemented()


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: UUID,
    _: UserManager,
) -> UserResponse:
    _ = user_id
    raise not_implemented()
