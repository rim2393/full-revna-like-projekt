from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.rbac import Permission, Principal, require_permission
from app.db.session import get_db_session
from app.domains.audit.service import record_audit_event
from app.domains.users.schemas import (
    UserBulkActionRequest,
    UserBulkActionResponse,
    UserCreateRequest,
    UserDetailResponse,
    UserListResponse,
    UserResponse,
    UserUpdateRequest,
)
from app.domains.users.service import apply_bulk_user_action, user_to_response
from app.domains.users.service import create_user as create_user_record
from app.domains.users.service import delete_user as delete_user_record
from app.domains.users.service import get_user as get_user_record
from app.domains.users.service import get_user_detail as get_user_detail_record
from app.domains.users.service import list_users as list_user_records
from app.domains.users.service import update_user as update_user_record

router = APIRouter()
UserManager = Annotated[Principal, Depends(require_permission(Permission.USER_MANAGE))]
DbSession = Annotated[AsyncSession, Depends(get_db_session)]


@router.get("", response_model=UserListResponse)
async def list_users(
    _: UserManager,
    session: DbSession,
) -> UserListResponse:
    users = await list_user_records(session)
    return UserListResponse(items=[user_to_response(user) for user in users])


@router.post("", response_model=UserResponse, status_code=201)
async def create_user(
    request: UserCreateRequest,
    principal: UserManager,
    session: DbSession,
) -> UserResponse:
    user = await create_user_record(session, request=request)
    await record_audit_event(
        session,
        principal=principal,
        action="user.created",
        resource_type="user",
        resource_id=str(user.id),
    )
    await session.commit()
    return user_to_response(user)


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: UUID,
    _: UserManager,
    session: DbSession,
) -> UserResponse:
    user = await get_user_record(session, user_id)
    return user_to_response(user)


@router.get("/{user_id}/detail", response_model=UserDetailResponse)
async def get_user_detail(
    user_id: UUID,
    _: UserManager,
    session: DbSession,
) -> UserDetailResponse:
    return await get_user_detail_record(session, user_id)


@router.patch("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: UUID,
    request: UserUpdateRequest,
    principal: UserManager,
    session: DbSession,
) -> UserResponse:
    user = await update_user_record(session, user_id=user_id, request=request)
    await record_audit_event(
        session,
        principal=principal,
        action="user.updated",
        resource_type="user",
        resource_id=str(user.id),
    )
    await session.commit()
    return user_to_response(user)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: UUID,
    principal: UserManager,
    session: DbSession,
) -> None:
    await delete_user_record(session, user_id=user_id)
    await record_audit_event(
        session,
        principal=principal,
        action="user.deleted",
        resource_type="user",
        resource_id=str(user_id),
    )
    await session.commit()


@router.post("/bulk/{action}", response_model=UserBulkActionResponse)
async def bulk_user_action(
    action: str,
    request: UserBulkActionRequest,
    principal: UserManager,
    session: DbSession,
) -> UserBulkActionResponse:
    users = await apply_bulk_user_action(session, request=request, action=action)
    await record_audit_event(
        session,
        principal=principal,
        action=f"user.bulk.{action}",
        resource_type="user",
        metadata_json={"user_ids": [str(user_id) for user_id in request.user_ids]},
    )
    await session.commit()
    return UserBulkActionResponse(
        updated=len(users),
        items=[user_to_response(user) for user in users],
    )
