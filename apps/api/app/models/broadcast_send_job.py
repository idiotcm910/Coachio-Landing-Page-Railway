"""One row per recipient — the send queue. Audience snapshot at dispatch time.

`id` is the Resend idempotency key (no duplicate sends across restart/retry).
unique(campaign_id, email) enforces dedup; (campaign_id, status) index drives
the worker claim query.
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


class BroadcastSendJob(Base):
    __tablename__ = "broadcast_send_jobs"
    __table_args__ = (
        UniqueConstraint("campaign_id", "email", name="uq_broadcast_send_jobs_campaign_email"),
        Index("ix_broadcast_send_jobs_campaign_status", "campaign_id", "status"),
    )

    id = Column(String(36), primary_key=True, index=True, default=lambda: str(uuid.uuid4()))
    campaign_id = Column(
        String(36), ForeignKey("broadcast_campaigns.id", ondelete="CASCADE"), nullable=False, index=True
    )
    lead_id = Column(String(36), ForeignKey("leads.id", ondelete="SET NULL"), nullable=True)
    email = Column(String(255), nullable=False)
    name = Column(String(255), nullable=True)
    status = Column(String(16), nullable=False, server_default="pending", default="pending")
    attempts = Column(Integer, nullable=False, server_default="0", default=0)
    claimed_at = Column(DateTime(timezone=True), nullable=True)
    error = Column(Text, nullable=True)
    sent_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    campaign = relationship("BroadcastCampaign", back_populates="jobs")
