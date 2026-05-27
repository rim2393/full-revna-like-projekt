from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, status

from app.core.rbac import Permission, Principal, require_permission
from app.domains.subscriptions.schemas import (
    SubscriptionCreateRequest,
    SubscriptionListResponse,
    SubscriptionResponse,
)
from app.domains.subscriptions.service import not_implemented

router = APIRouter()
SubscriptionReader = Annotated[
    Principal,
    Depends(require_permission(Permission.SUBSCRIPTION_READ)),
]
SubscriptionManager = Annotated[
    Principal,
    Depends(require_permission(Permission.SUBSCRIPTION_MANAGE)),
]


@router.get("", response_model=SubscriptionListResponse)
async def list_subscriptions(
    _: SubscriptionReader,
) -> SubscriptionListResponse:
    raise not_implemented()


@router.post("", response_model=SubscriptionResponse, status_code=status.HTTP_201_CREATED)
async def create_subscription(
    __: SubscriptionCreateRequest,
    _: SubscriptionManager,
) -> SubscriptionResponse:
    raise not_implemented()


@router.get("/{subscription_id}", response_model=SubscriptionResponse)
async def get_subscription(
    subscription_id: UUID,
    _: SubscriptionReader,
) -> SubscriptionResponse:
    _ = subscription_id
    raise not_implemented()
