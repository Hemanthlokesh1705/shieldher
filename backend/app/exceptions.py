"""
ShieldHer – global exception handling middleware and HTTP exception handlers.
"""
from __future__ import annotations

import traceback
import uuid

from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse

from app.logging_config import get_logger

logger = get_logger(__name__)


# ── Pydantic-style error envelope ─────────────────────────────────────────
def _error_body(
    status_code: int,
    message: str,
    detail: object | None = None,
    error_id: str | None = None,
) -> dict:
    return {
        "error": {
            "status": status_code,
            "message": message,
            "detail": detail,
            "error_id": error_id or str(uuid.uuid4()),
        }
    }


# ── FastAPI exception handlers ─────────────────────────────────────────────
async def http_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    from fastapi.exceptions import HTTPException

    assert isinstance(exc, HTTPException)
    logger.warning(
        "HTTP exception",
        status_code=exc.status_code,
        detail=exc.detail,
        path=str(request.url),
    )
    return JSONResponse(
        status_code=exc.status_code,
        content=_error_body(exc.status_code, str(exc.detail)),
    )


async def validation_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    from fastapi.exceptions import RequestValidationError

    assert isinstance(exc, RequestValidationError)
    logger.warning("Validation error", errors=exc.errors(), path=str(request.url))
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content=_error_body(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "Request validation failed",
            detail=exc.errors(),
        ),
    )


async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    error_id = str(uuid.uuid4())
    logger.error(
        "Unhandled exception",
        error_id=error_id,
        exc_type=type(exc).__name__,
        path=str(request.url),
        traceback=traceback.format_exc(),
    )
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content=_error_body(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            "An unexpected error occurred. Please try again later.",
            error_id=error_id,
        ),
    )


def register_exception_handlers(app: FastAPI) -> None:
    """Attach all exception handlers to a FastAPI application."""
    from fastapi.exceptions import HTTPException, RequestValidationError

    app.add_exception_handler(HTTPException, http_exception_handler)
    app.add_exception_handler(RequestValidationError, validation_exception_handler)
    app.add_exception_handler(Exception, unhandled_exception_handler)
