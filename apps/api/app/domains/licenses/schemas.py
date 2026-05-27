from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field, SecretStr


class LicenseCreateRequest(BaseModel):
    license_key: SecretStr
    customer_ref: str | None = Field(default=None, max_length=128)
    max_devices: int = Field(default=1, ge=1)
    expires_at: datetime | None = None


class LicenseResponse(BaseModel):
    id: UUID
    customer_ref: str | None
    status: str
    max_devices: int
    starts_at: datetime | None
    expires_at: datetime | None


class LicenseListResponse(BaseModel):
    items: list[LicenseResponse]

