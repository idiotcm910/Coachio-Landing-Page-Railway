"""One row per frozen recipient of a gift campaign — the send queue.

unique(campaign_id, email) enforces dedup; (campaign_id, status) index drives
the worker claim query. Status: pending → processing → sent | failed | skipped
(skipped = recipient already received this gift per the grant ledger).
"""
import uuid

from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base import Base


class GiftSendJob(Base):
    __tablename__ = "gift_send_jobs"
    __table_args__ = (
        UniqueConstraint("campaign_id", "email", name="uq_gift_send_jobs_campaign_email"),
        Index("ix_gift_send_jobs_campaign_status", "campaign_id", "status"),
    )

    id = Column(String(36), primary_key=True, index=True, default=lambda: str(uuid.uuid4()))
    campaign_id = Column(
        String(36), ForeignKey("gift_campaigns.id", ondelete="CASCADE"), nullable=False, index=True
    )
    lead_id = Column(String(36), ForeignKey("leads.id", ondelete="SET NULL"), nullable=True)
    email = Column(String(255), nullable=False)  # always lowercased
    name = Column(String(255), nullable=True)
    phone = Column(String(50), nullable=True)
    status = Column(String(16), nullable=False, server_default="pending", default="pending")
    attempts = Column(Integer, nullable=False, server_default="0", default=0)
    claimed_at = Column(DateTime(timezone=True), nullable=True)
    error = Column(Text, nullable=True)
    sent_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    campaign = relationship("GiftCampaign", back_populates="jobs")
