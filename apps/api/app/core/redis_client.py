"""Shared cache backend accessor and legacy Redis client helper (sync, optional).

`get_backend()` is the preferred entry point: it returns the process-wide
CacheBackend singleton (RedisBackend or InMemoryBackend), memoized on first
call.  `get_redis_client()` is kept for callers that still need the raw
redis.Redis object (e.g. Pub/Sub, custom pipelines).
"""
import logging
from typing import Optional

import redis

from app.core.cache_backend import CacheBackend, get_cache_backend
from app.core.config import settings

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Legacy raw-client singleton (kept for backward compat)
# ---------------------------------------------------------------------------

_client: Optional[redis.Redis] = None
_initialized: bool = False


def get_redis_client() -> Optional[redis.Redis]:
    """Return a cached sync Redis client, or None if unavailable."""
    global _client, _initialized
    if _initialized:
        return _client
    _initialized = True
    try:
        client = redis.from_url(settings.REDIS_URL, decode_responses=True)
        client.ping()
        _client = client
        logger.info("Redis connected: %s", settings.REDIS_URL)
    except Exception as exc:
        logger.warning("Redis unavailable, caching disabled: %s", exc)
        _client = None
    return _client


# ---------------------------------------------------------------------------
# Shared CacheBackend singleton — preferred over raw redis_client
# ---------------------------------------------------------------------------

_backend: Optional[CacheBackend] = None


def get_backend() -> CacheBackend:
    """Return the process-wide CacheBackend, memoized on first call.

    Falls back to InMemoryBackend when REDIS_URL is absent or Redis is
    unreachable (the factory in cache_backend handles the connection error).
    """
    global _backend
    if _backend is None:
        _backend = get_cache_backend(settings)
    return _backend
