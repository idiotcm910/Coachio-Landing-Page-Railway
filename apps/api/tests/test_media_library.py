"""Tests for the Media Library service (upload→catalog, list/search, delete).

Service-layer tests (SQLite, per-file engine) — the S3 storage layer is
monkeypatched so no network/S3 is touched. Mirrors the funnel test pattern.

Ported to coachio-landing-page: User.__table__ removed from TABLES (MediaAsset
created_by is a plain string, no FK to users table in DST).
"""
import asyncio

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.models.media_asset import MediaAsset
from app.services import media_library_service as mod
from app.services.media_library_service import media_library_service

SQLALCHEMY_DATABASE_URL = "sqlite:///./test_media_library.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

TABLES = [MediaAsset.__table__]


@pytest.fixture()
def db():
    for t in reversed(TABLES):
        t.drop(bind=engine, checkfirst=True)
    for t in TABLES:
        t.create(bind=engine, checkfirst=True)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


class FakeUpload:
    """Minimal UploadFile stand-in (filename, content_type, async read)."""

    def __init__(self, filename, content_type, content=b"x"):
        self.filename = filename
        self.content_type = content_type
        self._content = content

    async def read(self):
        return self._content


@pytest.fixture(autouse=True)
def patch_storage(monkeypatch):
    async def fake_upload(file_content, object_key):
        return f"https://cdn.example.com/{object_key}"

    deleted = []

    async def fake_delete(object_key):
        deleted.append(object_key)

    monkeypatch.setattr(mod.storage_service, "upload_file_from_bytes", fake_upload)
    monkeypatch.setattr(mod.storage_service, "delete_object", fake_delete)
    return deleted


def test_upload_creates_catalog_row(db):
    upload = FakeUpload("hero.png", "image/png", b"imagebytes")
    asset = asyncio.run(media_library_service.create_from_upload(db, upload, "user-1"))

    assert asset.id
    assert asset.kind == "image"
    assert asset.original_filename == "hero.png"
    assert asset.object_key.startswith("media-library/")
    assert asset.url.startswith("https://cdn.example.com/media-library/")
    assert asset.file_size == len(b"imagebytes")
    assert db.query(MediaAsset).count() == 1


def test_invalid_type_rejected_no_row(db):
    upload = FakeUpload("evil.exe", "application/octet-stream", b"xx")
    with pytest.raises(HTTPException) as exc:
        asyncio.run(media_library_service.create_from_upload(db, upload, "user-1"))
    assert exc.value.status_code in (400, 415)
    assert db.query(MediaAsset).count() == 0


def test_oversized_rejected(db, monkeypatch):
    monkeypatch.setattr(mod, "MAX_FILE_SIZE", 10)
    upload = FakeUpload("big.png", "image/png", b"x" * 20)
    with pytest.raises(HTTPException) as exc:
        asyncio.run(media_library_service.create_from_upload(db, upload, "user-1"))
    assert exc.value.status_code == 413
    assert db.query(MediaAsset).count() == 0


def test_empty_file_rejected(db):
    upload = FakeUpload("empty.png", "image/png", b"")
    with pytest.raises(HTTPException) as exc:
        asyncio.run(media_library_service.create_from_upload(db, upload, "user-1"))
    assert exc.value.status_code == 400


def test_list_pagination_and_search(db):
    for i in range(5):
        asyncio.run(media_library_service.create_from_upload(db, FakeUpload(f"pic-{i}.png", "image/png"), "u"))
    asyncio.run(media_library_service.create_from_upload(db, FakeUpload("banner.webp", "image/webp"), "u"))

    items, total = media_library_service.list(db, page=1, page_size=3)
    assert total == 6
    assert len(items) == 3  # newest first, capped by page_size

    items, total = media_library_service.list(db, page=1, page_size=10, search="banner")
    assert total == 1
    assert items[0].original_filename == "banner.webp"

    items, total = media_library_service.list(db, page=1, page_size=10, kind="image")
    assert total == 6  # png + webp are all image kind


def test_delete_removes_object_and_row(db, patch_storage):
    asset = asyncio.run(media_library_service.create_from_upload(db, FakeUpload("a.png", "image/png"), "u"))
    asyncio.run(media_library_service.delete(db, asset.id))
    assert db.query(MediaAsset).count() == 0
    assert asset.object_key in patch_storage  # S3 delete was called


def test_delete_missing_raises_404(db):
    with pytest.raises(HTTPException) as exc:
        asyncio.run(media_library_service.delete(db, "does-not-exist"))
    assert exc.value.status_code == 404


def test_delete_s3_failure_keeps_row(db, monkeypatch):
    asset = asyncio.run(media_library_service.create_from_upload(db, FakeUpload("a.png", "image/png"), "u"))

    async def boom(object_key):
        raise Exception("S3 down")

    monkeypatch.setattr(mod.storage_service, "delete_object", boom)
    with pytest.raises(Exception):
        asyncio.run(media_library_service.delete(db, asset.id))
    assert db.query(MediaAsset).count() == 1  # row not orphaned-deleted
