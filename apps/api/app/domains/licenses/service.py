from fastapi import status

from app.core.errors import APIError


def not_implemented() -> APIError:
    return APIError(
        code="licenses_not_implemented",
        message="License service is not implemented yet.",
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
    )

