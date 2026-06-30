"""Cache backend abstraction — run WITH or WITHOUT Redis.

The app uses two storage patterns across core modules:
  - landing_cache.py  : get / setex / delete (string payloads, JSON-serialised)
  - rate_limit.py     : incr(key, ttl) — atomic counter with per-window expiry

CacheBackend (Protocol) covers exactly those four operations (YAGNI).

Selecting a backend:
  - REDIS_URL truthy  → RedisBackend (thin wrapper; no connection on init)
  - REDIS_URL falsy   → InMemoryBackend (dict + lock; suitable for single-process)

Wiring landing_cache / rate_limit to use the backend happens in RT3.
This module only provides the classes, the protocol, and the factory.
"""

import logging
import threading
import time
from typing import Callable, Optional

import redis

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Protocol — structural interface that both backends satisfy
# ---------------------------------------------------------------------------

class CacheBackend:
    """Structural interface for cache operations.

    Implemented by InMemoryBackend and RedisBackend.
    Not enforced at runtime — duck-typing is sufficient.
    """

    def get(self, key: str) -> Optional[str]:
        """Return the string value for key, or None if absent / expired."""
        raise NotImplementedError

    def setex(self, key: str, ttl: int, value: str) -> None:
        """Store value under key with TTL in seconds."""
        raise NotImplementedError

    def delete(self, key: str) -> None:
        """Remove key (no-op if absent)."""
        raise NotImplementedError

    def incr(self, key: str, ttl: int) -> int:
        """Atomically increment a counter for key within a TTL window.

        - First call in a window: stores 1 and sets expiry = ttl seconds.
        - Subsequent calls within the window: increments and returns new count.
        - After window expires: resets to 1 and sets a fresh expiry.

        Returns the new counter value.
        """
        raise NotImplementedError


# ---------------------------------------------------------------------------
# InMemoryBackend — dict + lock; injectable clock for deterministic testing
# ---------------------------------------------------------------------------

class InMemoryBackend(CacheBackend):
    """Thread-safe in-process cache.

    Args:
        time_fn: Returns monotonic time in seconds. Defaults to time.monotonic.
                 Inject a fake clock in tests to avoid real sleeps.
    """

    def __init__(self, time_fn: Optional[Callable[[], float]] = None) -> None:
        self._time_fn: Callable[[], float] = time_fn or time.monotonic
        # Unified store: key → (value: str | int, expire_at: float)
        self._store: dict[str, tuple[object, float]] = {}
        self._lock = threading.Lock()

    # ------------------------------------------------------------------
    # CacheBackend implementation
    # ------------------------------------------------------------------

    def get(self, key: str) -> Optional[str]:
        with self._lock:
            entry = self._store.get(key)
            if entry is None:
                return None
            value, expire_at = entry
            if self._time_fn() >= expire_at:
                del self._store[key]
                return None
            # Only return string values (incr keys are ints — callers should not mix ops)
            return value if isinstance(value, str) else None

    def setex(self, key: str, ttl: int, value: str) -> None:
        with self._lock:
            self._store[key] = (value, self._time_fn() + ttl)

    def delete(self, key: str) -> None:
        with self._lock:
            self._store.pop(key, None)

    def incr(self, key: str, ttl: int) -> int:
        with self._lock:
            now = self._time_fn()
            entry = self._store.get(key)
            if entry is not None:
                value, expire_at = entry
                if now < expire_at and isinstance(value, int):
                    # Valid window — increment in-place
                    new_count = value + 1
                    self._store[key] = (new_count, expire_at)
                    return new_count
            # Key absent, expired, or wrong type — start a fresh window
            self._store[key] = (1, now + ttl)
            return 1


# ---------------------------------------------------------------------------
# RedisBackend — thin delegation layer over a sync redis.Redis client
# ---------------------------------------------------------------------------

class RedisBackend(CacheBackend):
    """Delegates every operation to the underlying redis.Redis client.

    Construction does NOT connect; the client is injected (or created lazily
    by the factory) so this class is importable even without a live server.
    """

    def __init__(self, client: redis.Redis) -> None:
        self._client = client

    def get(self, key: str) -> Optional[str]:
        return self._client.get(key)

    def setex(self, key: str, ttl: int, value: str) -> None:
        self._client.setex(key, ttl, value)

    def delete(self, key: str) -> None:
        self._client.delete(key)

    def incr(self, key: str, ttl: int) -> int:
        """Atomic INCR + conditional EXPIRE using a pipeline.

        Pattern mirrors existing rate_limit.py Redis logic:
          1. INCR the key.
          2. Read its TTL.
          3. If count == 1 or TTL is unset (< 0), call EXPIRE to initialise window.
        """
        pipe = self._client.pipeline()
        pipe.incr(key)
        pipe.ttl(key)
        count, remaining = pipe.execute()
        if count == 1 or remaining < 0:
            self._client.expire(key, ttl)
        return count


# ---------------------------------------------------------------------------
# Factory
# ---------------------------------------------------------------------------

def get_cache_backend(settings) -> CacheBackend:
    """Return the appropriate backend based on settings.REDIS_URL.

    - Truthy REDIS_URL → RedisBackend (uses redis.from_url; no ping on init).
    - Falsy / empty     → InMemoryBackend.
    """
    url: str = getattr(settings, "REDIS_URL", "") or ""
    if url:
        try:
            client = redis.from_url(url, decode_responses=True)
            logger.info("CacheBackend: using Redis (%s)", url)
            return RedisBackend(client=client)
        except Exception as exc:  # noqa: BLE001
            logger.warning("CacheBackend: Redis init failed (%s) — falling back to in-memory", exc)
    logger.info("CacheBackend: using InMemoryBackend")
    return InMemoryBackend()
