"""Gift campaign — manual batch delivery of a gift to a filtered audience.

Mirrors the broadcast campaign but delivers gifts (perks + email), not just
email. On admin confirm the recipients are FROZEN into `gift_send_jobs`
(snapshot); the worker only processes those frozen jobs. `snapshot_at` marks
when the recipient list was frozen.
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
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base import Base


class GiftCampaign(Base):
    __tablename__ = "gift_campaigns"
    __table_args__ = (
        Index("ix_gift_campaigns_status", "status"),
    )

    id = Column(String(36), primary_key=True, index=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(255), nullable=False)
    gift_ids = Column(JSON, nullable=True)  # list[str] of gift ids granted together
    email_subject = Column(Text, nullable=False, server_default="")
    email_html = Column(Text, nullable=False, server_default="")
    # Full filter set: funnel_ids, status, date_field, date_from/to, order_by,
    # limit, include_emails, exclude_emails, exclude_already_granted, advanced.
    audience_config = Column(JSON, nullable=True)
    status = Column(String(16), nullable=False, server_default="draft", default="draft")
    scheduled_at = Column(DateTime(timezone=True), nullable=True)
    snapshot_at = Column(DateTime(timezone=True), nullable=True)  # when recipients frozen
    total_recipients = Column(Integer, nullable=False, server_default="0", default=0)
    sent_count = Column(Integer, nullable=False, server_default="0", default=0)
    failed_count = Column(Integer, nullable=False, server_default="0", default=0)
    skipped_count = Column(Integer, nullable=False, server_default="0", default=0)
    last_error = Column(Text, nullable=True)
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    created_by = Column(String(36), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    jobs = relationship("GiftSendJob", back_populates="campaign", cascade="all, delete-orphan")
