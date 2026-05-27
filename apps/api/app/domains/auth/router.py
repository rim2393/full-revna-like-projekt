from typing import Annotated

from fastapi import APIRouter, Depends, Response, status

from app.core.rbac import Principal, get_current_principal
from app.domains.auth.schemas import (
    LoginRequest,
    PrincipalResponse,
    RefreshRequest,
    TokenPairResponse,
)
from app.domains.auth.service import not_implemented

router = APIRouter()
CurrentPrincipal = Annotated[Principal, Depends(get_current_principal)]


@router.post("/login", response_model=TokenPairResponse)
async def login(_: LoginRequest) -> TokenPairResponse:
    raise not_implemented()


@router.post("/refresh", response_model=TokenPairResponse)
async def refresh(_: RefreshRequest) -> TokenPairResponse:
    raise not_implemented()


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    _: CurrentPrincipal,
) -> Response:
    raise not_implemented()


@router.get("/me", response_model=PrincipalResponse)
async def me(_: CurrentPrincipal) -> PrincipalResponse:
    raise not_implemented()
