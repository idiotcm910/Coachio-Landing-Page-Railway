"""Media Library asset model — global catalog of files stored on S3.

Each row is one uploaded file (via `S3StorageService`) so the admin can browse,
search, preview, copy-URL and reuse media across funnels, courses, emails, SEO…
The library is NOT bound to any funnel/course (no FK) — it is a shared catalog.
"""
import uuid

from sqlalchemy import BigInteger, Column, DateTime, ForeignKey, String
from sqlalchemy.sql import func

from app.db.base import Base


def uuid_str() -> str:
    return str(uuid.uuid4())


class MediaAsset(Base):
    __tablename__ = "media_assets"

    id = Column(String(36), primary_key=True, index=True, default=uuid_str)
    # Full S3 object key (e.g. media-library/<uuid>.png) — unique per stored file.
    object_key = Column(String(1024), unique=True, nullable=False, index=True)
    # Public URL (CDN-first via _get_s3_url) used directly in HTML/email/SEO.
    url = Column(String(2048), nullable=False)
    content_type = Column(String(255), nullable=True)
    # Coarse kind derived from content_type at upload: "image" | "other".
    kind = Column(String(20), nullable=False, default="other", server_default="other", index=True)
    file_size = Column(BigInteger, nullable=True)
    original_filename = Column(String(512), nullable=True)
    # Uploader (admin) — keep the catalog auditable; SET NULL if the user is removed.
    uploaded_by = Column(String(36), ForeignKey("admin_users.id", ondelete="SET NULL"), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
