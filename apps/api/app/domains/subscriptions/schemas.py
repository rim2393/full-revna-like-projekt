from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class SubscriptionCreateRequest(BaseModel):
    user_id: UUID
    license_id: UUID
    node_id: UUID | None = None
    delivery_profile: dict[str, str] = Field(default_factory=dict)
    expires_at: datetime | None = None


class SubscriptionResponse(BaseModel):
    id: UUID
    public_id: str
    user_id: UUID
    license_id: UUID
    node_id: UUID | None
    status: str
    delivery_profile: dict[str, str]
    expires_at: datetime | None
    revoked_at: datetime | None


class SubscriptionListResponse(BaseModel):
    items: list[SubscriptionResponse]

