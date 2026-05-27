from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, status

from app.core.rbac import Permission, Principal, require_permission
from app.domains.licenses.schemas import (
    LicenseCreateRequest,
    LicenseListResponse,
    LicenseResponse,
)
from app.domains.licenses.service import not_implemented

router = APIRouter()
LicenseManager = Annotated[Principal, Depends(require_permission(Permission.LICENSE_MANAGE))]


@router.get("", response_model=LicenseListResponse)
async def list_licenses(
    _: LicenseManager,
) -> LicenseListResponse:
    raise not_implemented()


@router.post("", response_model=LicenseResponse, status_code=status.HTTP_201_CREATED)
async def create_license(
    __: LicenseCreateRequest,
    _: LicenseManager,
) -> LicenseResponse:
    raise not_implemented()


@router.get("/{license_id}", response_model=LicenseResponse)
async def get_license(
    license_id: UUID,
    _: LicenseManager,
) -> LicenseResponse:
    _ = license_id
    raise not_implemented()
