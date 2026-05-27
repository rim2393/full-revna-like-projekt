from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class NodeCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=128)
    region: str = Field(min_length=1, max_length=64)
    public_address: str = Field(min_length=1, max_length=255)
    capabilities: dict[str, str] = Field(default_factory=dict)


class NodeResponse(BaseModel):
    id: UUID
    name: str
    region: str
    public_address: str
    status: str
    capabilities: dict[str, str]
    last_seen_at: datetime | None


class NodeListResponse(BaseModel):
    items: list[NodeResponse]

