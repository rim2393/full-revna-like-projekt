from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class NodePluginRecord(BaseModel):
    id: UUID
    node_id: UUID | None
    kind: str
    name: str
    config_json: dict[str, object]
    enabled: bool
    sort_order: int
    created_at: datetime
    updated_at: datetime


class NodePluginListResponse(BaseModel):
    items: list[NodePluginRecord]


class NodePluginCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    node_id: UUID | None = None
    kind: str = Field(min_length=1, max_length=64)
    name: str = Field(min_length=1, max_length=160)
    config_json: dict[str, object] = Field(default_factory=dict)
    enabled: bool = True
    sort_order: int | None = Field(default=None, ge=0)


class NodePluginUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    node_id: UUID | None = None
    kind: str | None = Field(default=None, min_length=1, max_length=64)
    name: str | None = Field(default=None, min_length=1, max_length=160)
    config_json: dict[str, object] | None = None
    enabled: bool | None = None
    sort_order: int | None = Field(default=None, ge=0)


class NodePluginCloneRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str | None = Field(default=None, min_length=1, max_length=160)
    node_id: UUID | None = None
    enabled: bool | None = None


class NodePluginReorderItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: UUID
    sort_order: int = Field(ge=0)


class NodePluginReorderRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    items: list[NodePluginReorderItem] = Field(min_length=1)


class NodePluginApplyRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    node_id: UUID
    reason: str | None = Field(default=None, max_length=512)
