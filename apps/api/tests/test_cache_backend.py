"""TDD tests for CacheBackend abstraction (app/core/cache_backend.py).

Run with:
    apps/api/.venv/bin/python -m pytest tests/test_cache_backend.py -v

All tests target InMemoryBackend — no Redis server needed.
The injectable `time_fn` parameter makes expiry tests deterministic
(no real sleep beyond 0.05 s).
"""

import threading
import time
from typing import Optional

import pytest

from app.core.cache_backend import (
    CacheBackend,
    InMemoryBackend,
    get_cache_backend,
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

def make_clock(start: float = 0.0):
    """Return (time_fn, advance_fn). advance_fn(seconds) moves the clock."""
    state = [start]

    def time_fn() -> float:
        return state[0]

    def advance(seconds: float) -> None:
        state[0] += seconds

    return time_fn, advance


# ---------------------------------------------------------------------------
# get / set
# ---------------------------------------------------------------------------

class TestGetSet:
    def test_get_missing_returns_none(self):
        backend = InMemoryBackend()
        assert backend.get("no-such-key") is None

    def test_set_then_get_returns_value(self):
        backend = InMemoryBackend()
        backend.setex("k", 60, "hello")
        assert backend.get("k") == "hello"

    def test_set_overwrites_existing(self):
        backend = InMemoryBackend()
        backend.setex("k", 60, "v1")
        backend.setex("k", 60, "v2")
        assert backend.get("k") == "v2"


# ---------------------------------------------------------------------------
# TTL expiry (deterministic via injectable time_fn)
# ---------------------------------------------------------------------------

class TestTTLExpiry:
    def test_value_present_before_expiry(self):
        time_fn, advance = make_clock(0.0)
        backend = InMemoryBackend(time_fn=time_fn)
        backend.setex("k", 10, "data")  # TTL = 10 s
        advance(9.9)
        assert backend.get("k") == "data"

    def test_value_absent_after_expiry(self):
        time_fn, advance = make_clock(0.0)
        backend = InMemoryBackend(time_fn=time_fn)
        backend.setex("k", 10, "data")  # TTL = 10 s
        advance(10.01)
        assert backend.get("k") is None

    def test_expiry_at_exact_boundary(self):
        """At exactly expire_at the key should be gone (expire_at not included)."""
        time_fn, advance = make_clock(0.0)
        backend = InMemoryBackend(time_fn=time_fn)
        backend.setex("k", 5, "data")
        advance(5.0)  # clock is now == expire_at
        assert backend.get("k") is None

    def test_real_clock_tiny_ttl(self):
        """Sanity check with a real near-zero TTL — no deterministic clock."""
        backend = InMemoryBackend()
        backend.setex("k", 1, "val")  # 1 second TTL
        assert backend.get("k") == "val"
        # We do NOT sleep here; just verify retrieval works before expiry.


# ---------------------------------------------------------------------------
# delete
# ---------------------------------------------------------------------------

class TestDelete:
    def test_delete_removes_key(self):
        backend = InMemoryBackend()
        backend.setex("k", 60, "data")
        backend.delete("k")
        assert backend.get("k") is None

    def test_delete_nonexistent_key_is_noop(self):
        """Should not raise."""
        backend = InMemoryBackend()
        backend.delete("missing")  # no exception

    def test_delete_one_key_leaves_others(self):
        backend = InMemoryBackend()
        backend.setex("a", 60, "A")
        backend.setex("b", 60, "B")
        backend.delete("a")
        assert backend.get("a") is None
        assert backend.get("b") == "B"


# ---------------------------------------------------------------------------
# incr — rate-limit counter
# ---------------------------------------------------------------------------

class TestIncr:
    def test_first_call_returns_one(self):
        time_fn, _ = make_clock(0.0)
        backend = InMemoryBackend(time_fn=time_fn)
        assert backend.incr("counter", ttl=60) == 1

    def test_second_call_returns_two(self):
        time_fn, _ = make_clock(0.0)
        backend = InMemoryBackend(time_fn=time_fn)
        backend.incr("counter", ttl=60)
        assert backend.incr("counter", ttl=60) == 2

    def test_subsequent_calls_increment(self):
        time_fn, _ = make_clock(0.0)
        backend = InMemoryBackend(time_fn=time_fn)
        for expected in range(1, 6):
            assert backend.incr("counter", ttl=60) == expected

    def test_incr_resets_after_ttl_expiry(self):
        time_fn, advance = make_clock(0.0)
        backend = InMemoryBackend(time_fn=time_fn)
        backend.incr("counter", ttl=10)
        backend.incr("counter", ttl=10)
        advance(10.01)  # window expired
        assert backend.incr("counter", ttl=10) == 1  # reset to 1

    def test_incr_independent_keys(self):
        time_fn, _ = make_clock(0.0)
        backend = InMemoryBackend(time_fn=time_fn)
        backend.incr("a", ttl=60)
        backend.incr("a", ttl=60)
        backend.incr("b", ttl=60)
        assert backend.incr("a", ttl=60) == 3
        assert backend.incr("b", ttl=60) == 2


# ---------------------------------------------------------------------------
# Thread-safety
# ---------------------------------------------------------------------------

class TestThreadSafety:
    def test_concurrent_incr_yields_correct_total(self):
        """N threads each call incr M times — final count must equal N*M."""
        n_threads = 20
        calls_per_thread = 50
        expected = n_threads * calls_per_thread

        backend = InMemoryBackend()
        errors: list[Exception] = []

        def worker():
            try:
                for _ in range(calls_per_thread):
                    backend.incr("shared", ttl=3600)
            except Exception as exc:
                errors.append(exc)

        threads = [threading.Thread(target=worker) for _ in range(n_threads)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        assert not errors, f"Thread errors: {errors}"
        # The final count should be exactly n_threads * calls_per_thread.
        # Do one more incr and check it equals expected+1.
        assert backend.incr("shared", ttl=3600) == expected + 1


# ---------------------------------------------------------------------------
# Protocol / structural typing
# ---------------------------------------------------------------------------

class TestProtocolConformance:
    def test_in_memory_backend_has_required_methods(self):
        backend = InMemoryBackend()
        assert callable(getattr(backend, "get", None))
        assert callable(getattr(backend, "setex", None))
        assert callable(getattr(backend, "delete", None))
        assert callable(getattr(backend, "incr", None))


# ---------------------------------------------------------------------------
# Factory — always returns InMemoryBackend
# ---------------------------------------------------------------------------

class TestGetCacheBackend:
    def test_returns_in_memory_always(self):
        backend = get_cache_backend()
        assert isinstance(backend, InMemoryBackend)

    def test_returns_in_memory_when_settings_passed(self):
        """Factory ignores settings arg (no Redis in Railway edition)."""
        from unittest.mock import MagicMock
        fake_settings = MagicMock()
        backend = get_cache_backend(fake_settings)
        assert isinstance(backend, InMemoryBackend)
