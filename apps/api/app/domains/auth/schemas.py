from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, EmailStr, SecretStr

from app.core.rbac import Permission, Role


class LoginRequest(BaseModel):
    email: EmailStr
    password: SecretStr


class TokenPairResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: Literal["Bearer"] = "Bearer"  # noqa: S105 - OAuth token type, not a secret.
    expires_at: datetime


class PrincipalResponse(BaseModel):
    subject: UUID
    email: EmailStr
    roles: set[Role]
    permissions: set[Permission]


class RefreshRequest(BaseModel):
    refresh_token: SecretStr
