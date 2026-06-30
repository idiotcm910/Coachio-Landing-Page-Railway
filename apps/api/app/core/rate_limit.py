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
- Redis (preferred): uses INCR + EXPIREAT. Key: "rl:{key_prefix}:{identifier}"
- Fallback in-process LRU dict with TTL when Redis is unavailable.

Response on limit exceeded:
    HTTP 429
    {"detail": {"code": "rate_limit_exceeded", "retry_after": <seconds>}}
    Header: Retry-After: <seconds>
"""

import logging
import time
from collections import OrderedDict
from typing import Any, Callable, Optional

from fastapi import Depends, HTTPException, Request, status
from fastapi.responses import JSONResponse

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# In-process fallback store (LRU dict, capacity-bounded to avoid memory leak)
# ---------------------------------------------------------------------------
_MAX_FALLBACK_KEYS = 10_000

# Structure: { key: (count, window_start_epoch) }
_FALLBACK_STORE: OrderedDict[str, tuple[int, float]] = OrderedDict()


def _fallback_check(key: str, max_calls: int, window_seconds: int) -> tuple[bool, int]:
    """Check rate limit using in-process LRU dict.

    Returns (allowed: bool, retry_after: int).
    """
    now = time.time()
    entry = _FALLBACK_STORE.get(key)

    if entry is not None:
        count, window_start = entry
        if now - window_start < window_seconds:
            # Still within same window
            if count >= max_calls:
                retry_after = int(window_seconds - (now - window_start)) + 1
                return False, retry_after
            # Increment
            _FALLBACK_STORE[key] = (count + 1, window_start)
            _FALLBACK_STORE.move_to_end(key)
            return True, 0
        # Window expired — reset
    else:
        # New key — evict oldest if over capacity
        if len(_FALLBACK_STORE) >= _MAX_FALLBACK_KEYS:
            _FALLBACK_STORE.popitem(last=False)

    _FALLBACK_STORE[key] = (1, now)
    return True, 0


# ---------------------------------------------------------------------------
# Redis backend
# ---------------------------------------------------------------------------

_redis_client: Optional[Any] = None
_redis_init_attempted = False


def _get_redis() -> Optional[Any]:
    """Lazy-init Redis client; returns None if unavailable."""
    global _redis_client, _redis_init_attempted
    if _redis_init_attempted:
        return _redis_client

    _redis_init_attempted = True
    try:
        import redis as _redis_lib

        from app.core.config import settings

        url = getattr(settings, "REDIS_URL", None) or "redis://localhost:6379/0"
        client = _redis_lib.Redis.from_url(url, socket_connect_timeout=1, socket_timeout=1)
        client.ping()
        _redis_client = client
        logger.info("Rate-limit: Redis connected at %s", url)
    except Exception as exc:
        logger.warning("Rate-limit: Redis unavailable (%s) — using in-process fallback", exc)
        _redis_client = None

    return _redis_client


def _redis_check(
    redis_client: Any,
    key: str,
    max_calls: int,
    window_seconds: int,
) -> tuple[bool, int]:
    """Sliding fixed-window counter via Redis INCR + EXPIRE.

    Returns (allowed: bool, retry_after: int).
    """
    try:
        pipe = redis_client.pipeline()
        pipe.incr(key)
        pipe.ttl(key)
        count, ttl = pipe.execute()

        if count == 1 or ttl < 0:
            # First hit in this window — set expiry
            redis_client.expire(key, window_seconds)
            ttl = window_seconds

        if count > max_calls:
            retry_after = max(ttl, 1)
            return False, retry_after

        return True, 0
    except Exception as exc:
        logger.error("Rate-limit Redis error for key=%s: %s — allowing request", key, exc)
        # Fail open: allow the request when Redis errors
        return True, 0


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

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
        key_prefix: Logical name for the limit (used in Redis key, improves debuggability).
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

        redis_client = _get_redis()
        if redis_client is not None:
            allowed, retry_after = _redis_check(redis_client, bucket_key, max_calls, window_seconds)
        else:
            allowed, retry_after = _fallback_check(bucket_key, max_calls, window_seconds)

        if not allowed:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail={"code": "rate_limit_exceeded", "retry_after": retry_after},
                headers={"Retry-After": str(retry_after)},
            )

    return Depends(dependency)
