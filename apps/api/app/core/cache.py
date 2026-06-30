"""Shared in-process cache backend accessor.

`get_backend()` is the single entry point: it returns the process-wide
InMemoryBackend singleton, memoized on first call.

The Railway edition uses InMemoryBackend — no external cache service needed.
InMemoryBackend is always used (suitable for single-replica deployments).
"""
import logging
from typing import Optional

from app.core.cache_backend import CacheBackend, get_cache_backend

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Shared CacheBackend singleton
# ---------------------------------------------------------------------------

_backend: Optional[CacheBackend] = None


def get_backend() -> CacheBackend:
    """Return the process-wide InMemoryBackend, memoized on first call."""
    global _backend
    if _backend is None:
        _backend = get_cache_backend()
    return _backend
