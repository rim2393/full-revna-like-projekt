from fastapi import status

from app.core.errors import APIError


def not_implemented() -> APIError:
    return APIError(
        code="subscriptions_not_implemented",
        message="Subscription service is not implemented yet.",
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
    )

