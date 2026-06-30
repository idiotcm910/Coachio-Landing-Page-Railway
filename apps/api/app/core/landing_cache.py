"""Write-through cache helpers for funnel landing pages.

Pure infrastructure layer over the shared CacheBackend: serialize/store/evict
already-built payload dicts keyed by landing slug or the homepage.
Intentionally imports NO service module so higher layers can depend on it
without circular imports.

All operations degrade gracefully: if the cache is disabled or the backend
raises, reads return None and writes/evicts become no-ops (callers fall
back to the database).
"""
import json
import logging
from typing import Optional

from app.core.config import settings
from app.core.cache import get_backend

logger = logging.getLogger(__name__)

# Bump this version to invalidate every cached landing payload at once.
_CACHE_VERSION = "v1"


def _enabled() -> bool:
    return settings.LANDING_CACHE_ENABLED


def slug_key(slug: str) -> str:
    """Cache key for a published landing page addressed by slug."""
    return f"landing:{_CACHE_VERSION}:slug:{slug}"


def home_key() -> str:
    """Cache key for the published homepage landing page."""
    return f"landing:{_CACHE_VERSION}:home"


def homepage_key() -> str:
    """Cache key for the unified site-homepage resolved payload (funnel|course|none)."""
    return f"landing:{_CACHE_VERSION}:homepage"


def cache_get(key: str) -> Optional[dict]:
    """Return cached payload dict for key, or None on miss/disabled/error."""
    if not _enabled():
        return None
    try:
        raw = get_backend().get(key)
        if raw is None:
            return None
        return json.loads(raw)
    except Exception as exc:  # noqa: BLE001 - cache must never break reads
        logger.warning("Landing cache get failed (%s): %s", key, exc)
        return None


def cache_set(key: str, payload: dict, ttl: Optional[int] = None) -> None:
    """Store payload dict under key with a safety-net TTL. No-op on failure."""
    if not _enabled():
        return
    try:
        get_backend().setex(key, ttl or settings.LANDING_CACHE_TTL, json.dumps(payload))
    except Exception as exc:  # noqa: BLE001 - cache must never break writes
        logger.warning("Landing cache set failed (%s): %s", key, exc)


def cache_evict(key: str) -> None:
    """Delete a cache key. No-op on failure."""
    if not _enabled():
        return
    try:
        get_backend().delete(key)
    except Exception as exc:  # noqa: BLE001 - cache must never break writes
        logger.warning("Landing cache evict failed (%s): %s", key, exc)
