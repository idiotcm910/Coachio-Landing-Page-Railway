"""Cache backend abstraction — in-process only (Railway edition, single-replica).

The app uses two storage patterns across core modules:
  - landing_cache.py  : get / setex / delete (string payloads, JSON-serialised)
  - rate_limit.py     : incr(key, ttl) — atomic counter with per-window expiry

CacheBackend (Protocol) covers exactly those four operations (YAGNI).

This Railway edition always uses InMemoryBackend (dict + lock; suitable for
single-process / single-replica deployments). No external cache dependency.
"""

import logging
import threading
import time
from typing import Callable, Optional

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Protocol — structural interface
# ---------------------------------------------------------------------------

class CacheBackend:
    """Structural interface for cache operations.

    Implemented by InMemoryBackend.
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
# Factory — always InMemoryBackend in the Railway edition
# ---------------------------------------------------------------------------

def get_cache_backend(settings=None) -> CacheBackend:
    """Return InMemoryBackend (settings parameter accepted but ignored).

    The Railway edition ships without an external cache. InMemoryBackend is always used.
    """
    logger.info("CacheBackend: using InMemoryBackend (in-process)")
    return InMemoryBackend()
