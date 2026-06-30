"""Lazy singleton Redis client helper (sync, optional)."""
import logging
from typing import Optional

import redis

from app.core.config import settings

logger = logging.getLogger(__name__)

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
