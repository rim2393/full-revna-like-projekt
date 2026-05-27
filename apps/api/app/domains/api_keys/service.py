from fastapi import status

from app.core.errors import APIError


def not_implemented() -> APIError:
    return APIError(
        code="api_keys_not_implemented",
        message="API key service is not implemented yet.",
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
    )

