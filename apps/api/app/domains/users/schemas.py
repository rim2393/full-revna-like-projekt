from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field

from app.core.rbac import Role


class UserCreateRequest(BaseModel):
    email: EmailStr
    role: Role = Role.USER


class UserResponse(BaseModel):
    id: UUID
    email: EmailStr
    role: Role
    status: str = Field(examples=["active"])
    created_at: datetime


class UserListResponse(BaseModel):
    items: list[UserResponse]

