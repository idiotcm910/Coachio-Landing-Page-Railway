"""Generic key-value site settings (admin-url-redirects D2).

Stores dynamic, admin-editable config that does not warrant its own table. The
`value` column holds JSON-encoded text. First consumer: key `not_found_redirect`
= {"enabled": bool, "target_url": str}.
"""
import uuid

from sqlalchemy import Column, DateTime, String, Text
from sqlalchemy.sql import func

from app.db.base import Base


def uuid_str() -> str:
    return str(uuid.uuid4())


class SiteSetting(Base):
    __tablename__ = "site_settings"

    id = Column(String(36), primary_key=True, index=True, default=uuid_str)
    key = Column(String(100), unique=True, nullable=False, index=True)
    value = Column(Text, nullable=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
