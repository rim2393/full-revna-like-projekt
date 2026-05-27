from fastapi import status

from app.core.errors import APIError


def not_implemented() -> APIError:
    return APIError(
        code="users_not_implemented",
        message="Users domain persistence is not implemented yet.",
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
    )

