"""Gift package — a reusable bundle of external delivery items.

A gift holds a list of external items (ebook/file/links) delivered via a
campaign or automation email. It has NO email of its own — the delivery email
is configured on the campaign/automation, so one email can describe several
gifts.

Gifts are SOFT-archived (`is_archived`), never hard-deleted, so the grant
ledger's audit trail stays intact.

`internal_config`: legacy/deprecated column — unused in this product build;
always null on new gifts. Kept nullable for schema stability.
`external_items` shape:  [{label: str, url: str, description: str|None}]
"""
import uuid

from sqlalchemy import JSON, Boolean, Column, DateTime, String, Text
from sqlalchemy.sql import func

from app.db.base import Base


class Gift(Base):
    __tablename__ = "gifts"

    id = Column(String(36), primary_key=True, index=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    # Optional internal perks; null/empty means "external-only" gift (no account needed).
    internal_config = Column(JSON, nullable=True)
    # Optional external items (ebook/file/links) surfaced in the delivery email.
    external_items = Column(JSON, nullable=True)
    is_archived = Column(Boolean, nullable=False, server_default="false", default=False)
    created_by = Column(String(36), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
