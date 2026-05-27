from enum import StrEnum
from typing import Annotated

from fastapi import Depends, status
from pydantic import BaseModel, EmailStr

from app.core.errors import APIError


class Role(StrEnum):
    OWNER = "owner"
    ADMIN = "admin"
    SUPPORT = "support"
    NODE = "node"
    USER = "user"


class Permission(StrEnum):
    API_KEY_MANAGE = "api_key:manage"
    LICENSE_MANAGE = "license:manage"
    NODE_MANAGE = "node:manage"
    SUBSCRIPTION_READ = "subscription:read"
    SUBSCRIPTION_MANAGE = "subscription:manage"
    USER_MANAGE = "user:manage"


ROLE_PERMISSIONS: dict[Role, frozenset[Permission]] = {
    Role.OWNER: frozenset(Permission),
    Role.ADMIN: frozenset(
        {
            Permission.API_KEY_MANAGE,
            Permission.LICENSE_MANAGE,
            Permission.NODE_MANAGE,
            Permission.SUBSCRIPTION_READ,
            Permission.SUBSCRIPTION_MANAGE,
            Permission.USER_MANAGE,
        }
    ),
    Role.SUPPORT: frozenset(
        {
            Permission.SUBSCRIPTION_READ,
            Permission.USER_MANAGE,
        }
    ),
    Role.NODE: frozenset({Permission.SUBSCRIPTION_READ}),
    Role.USER: frozenset({Permission.SUBSCRIPTION_READ}),
}


class Principal(BaseModel):
    subject: str
    email: EmailStr | None = None
    roles: set[Role]
    permissions: set[Permission]


async def get_current_principal() -> Principal:
    raise APIError(
        code="auth_not_implemented",
        message="Authentication dependency is not wired yet.",
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
    )


def has_permission(principal: Principal, permission: Permission) -> bool:
    if permission in principal.permissions:
        return True
    return any(permission in ROLE_PERMISSIONS[role] for role in principal.roles)


def require_permission(permission: Permission):
    async def dependency(
        principal: Annotated[Principal, Depends(get_current_principal)],
    ) -> Principal:
        if not has_permission(principal, permission):
            raise APIError(
                code="permission_denied",
                message="The caller is not allowed to perform this action.",
                status_code=status.HTTP_403_FORBIDDEN,
            )
        return principal

    return dependency
