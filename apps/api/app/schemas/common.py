from pydantic import BaseModel, Field


class MessageResponse(BaseModel):
    message: str


class PageMeta(BaseModel):
    limit: int = Field(ge=1, le=500)
    offset: int = Field(ge=0)
    total: int = Field(ge=0)


class EmptyListResponse(BaseModel):
    items: list[object] = Field(default_factory=list)
    meta: PageMeta

