"""Railway boot smoke tests.

Verifies:
1. App imports and TestClient starts with NO exception when all optional keys
   are blank (no Redis URL needed — Railway edition always uses in-memory cache).
2. GET /api/v1/health returns 200 with body {"status": "ok", ...}.
3. The active cache backend is always InMemoryBackend.

DB note: the health endpoint runs a SELECT 1 against the db session.
We override get_db with a SQLite in-memory session so the test needs no
external Postgres server.
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db.base import get_db
from app.core.cache_backend import InMemoryBackend
import app.core.cache as cache_module

# ---------------------------------------------------------------------------
# SQLite override — no Postgres needed for smoke test
# ---------------------------------------------------------------------------

_engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
)
_TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=_engine)


def _override_get_db():
    db = _TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Fixture: reset backend singleton + blank all optional keys
# ---------------------------------------------------------------------------

@pytest.fixture()
def clean_boot(monkeypatch):
    """Reset the memoized backend singleton and blank all optional settings keys."""
    monkeypatch.setattr(cache_module, "_backend", None)
    from app.core import config as config_module
    # Blank all optional keys to prove they are not required for boot.
    for attr in (
        "SEPAY_BANK_NAME", "SEPAY_ACCOUNT_NUMBER", "PREFIX_URL_CALLBACK",
        "RESEND_API_KEY", "RESEND_FROM_EMAIL",
        "S3_ENDPOINT", "S3_BUCKET_NAME", "S3_ACCESS_KEY", "S3_SECRET_KEY",
        "BUNNY_CDN_URL", "BUNNY_STORAGE_ZONE", "BUNNY_API_KEY", "BUNNY_PULL_ZONE_URL",
        "META_DEFAULT_PIXEL_ID", "META_DEFAULT_CAPI_TOKEN",
    ):
        if hasattr(config_module.settings, attr):
            monkeypatch.setattr(config_module.settings, attr, "")
    yield
    # Reset singleton after test so it doesn't leak into subsequent tests.
    monkeypatch.setattr(cache_module, "_backend", None)


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

class TestRailwayBoot:
    def test_app_boots_and_health_returns_200(self, clean_boot):
        """App must start and /api/v1/health must return 200 with no Redis."""
        from main import app

        app.dependency_overrides[get_db] = _override_get_db
        try:
            with TestClient(app, raise_server_exceptions=True) as client:
                resp = client.get("/api/v1/health")
        finally:
            app.dependency_overrides.pop(get_db, None)

        assert resp.status_code == 200, (
            f"Expected 200, got {resp.status_code}: {resp.text}"
        )
        data = resp.json()
        assert data["status"] == "ok", f"Unexpected body: {data}"

    def test_cache_backend_is_always_in_memory(self, clean_boot):
        """get_backend() must always return InMemoryBackend (no Redis needed)."""
        backend = cache_module.get_backend()
        assert isinstance(backend, InMemoryBackend), (
            f"Expected InMemoryBackend, got {type(backend).__name__}"
        )
