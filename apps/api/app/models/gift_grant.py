"""Gift grant ledger — the dedupe guard AND the audit/tracking record.

One row per (gift, person). `email` is ALWAYS stored lowercased and the
unique (gift_id, email) constraint prevents double-grant across all channels.

Email-delivery detail lives here for tracking/resend. `external_items_snapshot`
records what was actually delivered so later edits to the gift never rewrite history.
"""
import uuid

from sqlalchemy import (
    JSON,
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.sql import func

from app.db.base import Base


class GiftGrant(Base):
    __tablename__ = "gift_grants"
    __table_args__ = (
        UniqueConstraint("gift_id", "email", name="uq_gift_grants_gift_email"),
        Index("ix_gift_grants_email", "email"),
        Index("ix_gift_grants_email_status", "email_status"),
    )

    id = Column(String(36), primary_key=True, index=True, default=lambda: str(uuid.uuid4()))
    gift_id = Column(String(36), ForeignKey("gifts.id"), nullable=False, index=True)
    email = Column(String(255), nullable=False)  # always lowercased
    recipient_name = Column(String(255), nullable=True)
    recipient_phone = Column(String(50), nullable=True)
    # "order:<id>" (auto-trigger) or "campaign:<id>" (manual campaign)
    source = Column(String(64), nullable=True)
    # External items actually delivered (snapshot at grant time)
    external_items_snapshot = Column(JSON, nullable=True)
    granted_by = Column(String(36), nullable=True)  # admin id or "system"
    status = Column(String(16), nullable=False, server_default="granted", default="granted")
    # Email delivery detail (decoupled from the grant; retryable)
    email_status = Column(String(16), nullable=False, server_default="pending", default="pending")
    email_sent_at = Column(DateTime(timezone=True), nullable=True)
    email_error = Column(Text, nullable=True)
    # Snapshot of the delivery email used, so a resend reproduces what was sent
    # even if the campaign/automation template is later edited.
    email_subject_snapshot = Column(Text, nullable=True)
    email_html_snapshot = Column(Text, nullable=True)
    resend_count = Column(Integer, nullable=False, server_default="0", default=0)
    last_resend_at = Column(DateTime(timezone=True), nullable=True)
    granted_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
