from http import HTTPStatus

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from starlette.exceptions import HTTPException as StarletteHTTPException


class ErrorPayload(BaseModel):
    code: str = Field(..., examples=["not_found"])
    message: str
    details: list[str] = Field(default_factory=list)


class ErrorEnvelope(BaseModel):
    error: ErrorPayload


class APIError(Exception):
    def __init__(
        self,
        *,
        code: str,
        message: str,
        status_code: int = status.HTTP_400_BAD_REQUEST,
        details: list[str] | None = None,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code
        self.details = details or []


def error_response(error: APIError) -> JSONResponse:
    envelope = ErrorEnvelope(
        error=ErrorPayload(code=error.code, message=error.message, details=error.details)
    )
    return JSONResponse(status_code=error.status_code, content=envelope.model_dump())


async def api_error_handler(_: Request, exc: APIError) -> JSONResponse:
    return error_response(exc)


async def http_error_handler(_: Request, exc: StarletteHTTPException) -> JSONResponse:
    phrase = HTTPStatus(exc.status_code).phrase if exc.status_code in HTTPStatus else "HTTP error"
    return error_response(
        APIError(
            code="http_error",
            message=phrase,
            status_code=exc.status_code,
        )
    )


async def validation_error_handler(_: Request, exc: RequestValidationError) -> JSONResponse:
    details = [
        f"{'.'.join(str(part) for part in error['loc'])}: {error['msg']}"
        for error in exc.errors()
    ]
    return error_response(
        APIError(
            code="validation_error",
            message="Request validation failed.",
            status_code=422,
            details=details,
        )
    )


async def unhandled_error_handler(_: Request, __: Exception) -> JSONResponse:
    return error_response(
        APIError(
            code="internal_error",
            message="An unexpected error occurred.",
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )
    )


def register_error_handlers(app: FastAPI) -> None:
    app.add_exception_handler(APIError, api_error_handler)
    app.add_exception_handler(StarletteHTTPException, http_error_handler)
    app.add_exception_handler(RequestValidationError, validation_error_handler)
    app.add_exception_handler(Exception, unhandled_error_handler)
