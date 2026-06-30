"""Shared rate-limit dependency for FastAPI endpoints.

Usage:
    from app.core.rate_limit import rate_limit

    @router.post("/some-endpoint")
    def my_endpoint(
        _: None = Depends(rate_limit(max_calls=5, window_seconds=60)),
        ...
    ):
        ...

Storage backend:
- Uses the shared CacheBackend (InMemoryBackend — single-process safe for
  single-replica Railway deployments). No external cache service needed.
- Key: "rl:{key_prefix}:{identifier}"

Response on limit exceeded:
    HTTP 429
    {"detail": {"code": "rate_limit_exceeded", "retry_after": <seconds>}}
    Header: Retry-After: <seconds>
"""

import logging
from typing import Callable, Optional

from fastapi import Depends, HTTPException, Request, status

from app.core.cache import get_backend

logger = logging.getLogger(__name__)


def rate_limit(
    max_calls: int,
    window_seconds: int,
    key_prefix: str = "global",
    key_func: Optional[Callable[[Request], str]] = None,
) -> Callable:
    """Return a FastAPI Depends-compatible callable that enforces rate limits.

    Args:
        max_calls: Max allowed requests in window.
        window_seconds: Rolling window length in seconds.
        key_prefix: Logical name for the limit (used in cache key).
        key_func: Optional custom function to derive the bucket key from request.
                  Defaults to client IP address.
    """

    def _default_key(request: Request) -> str:
        # Prefer X-Forwarded-For (set by reverse proxy) over direct client IP
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            return forwarded.split(",")[0].strip()
        if request.client:
            return request.client.host
        return "unknown"

    actual_key_func = key_func or _default_key

    async def dependency(request: Request) -> None:
        identifier = actual_key_func(request)
        bucket_key = f"rl:{key_prefix}:{identifier}"

        try:
            count = get_backend().incr(bucket_key, window_seconds)
        except Exception as exc:  # noqa: BLE001 - fail open on backend error
            logger.error(
                "Rate-limit backend error for key=%s: %s — allowing request",
                bucket_key,
                exc,
            )
            return

        if count > max_calls:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail={"code": "rate_limit_exceeded", "retry_after": window_seconds},
                headers={"Retry-After": str(window_seconds)},
            )

    return Depends(dependency)
