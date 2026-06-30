"""Admin-configurable URL redirect rule (admin-url-redirects D2).

Each row maps an internal source path to an internal target URL. Rules are applied
at runtime by the Next.js middleware before page render. `match_type`:
  - 'exact'    — request path must equal `source_path`
  - 'wildcard' — `source_path` ends with '/*'; request path matching the prefix is
                 redirected to `target_url` (also ending '/*') with the suffix preserved.
"""
import uuid

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.sql import func

from app.db.base import Base


def uuid_str() -> str:
    return str(uuid.uuid4())


class UrlRedirect(Base):
    __tablename__ = "url_redirects"

    id = Column(String(36), primary_key=True, index=True, default=uuid_str)
    source_path = Column(String(500), unique=True, nullable=False, index=True)
    target_url = Column(String(1024), nullable=False)
    # 'exact' | 'wildcard'
    match_type = Column(String(20), default="exact", server_default="exact", nullable=False)
    # 301 (permanent) | 302 (temporary)
    status_code = Column(Integer, default=301, server_default="301", nullable=False)
    is_active = Column(Boolean, default=True, server_default="true", nullable=False, index=True)
    created_by = Column(String(36), ForeignKey("admin_users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
