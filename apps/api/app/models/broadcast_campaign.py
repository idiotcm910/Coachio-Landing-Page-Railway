"""Broadcast email campaign (spec §3). One resource, two surfaces via `origin`.

Content (subject/html_body) stored directly on the campaign — NOT EmailTemplate
(that is the fixed transactional template). Generic for future origin='course'.
"""
import uuid

from sqlalchemy import JSON, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base import Base


class BroadcastCampaign(Base):
    __tablename__ = "broadcast_campaigns"

    id = Column(String(36), primary_key=True, index=True, default=lambda: str(uuid.uuid4()))
    origin = Column(String(16), nullable=False)  # funnel | admin (future: course)
    funnel_id = Column(String(36), ForeignKey("funnels.id", ondelete="SET NULL"), nullable=True, index=True)
    title = Column(String(255), nullable=False)
    subject = Column(Text, nullable=False)
    html_body = Column(Text, nullable=False)
    audience_config = Column(JSON, nullable=True)  # {funnel_ids:[...], filters:{...}}
    status = Column(String(16), nullable=False, server_default="draft", default="draft")
    scheduled_at = Column(DateTime(timezone=True), nullable=True)
    total_recipients = Column(Integer, nullable=False, server_default="0", default=0)
    sent_count = Column(Integer, nullable=False, server_default="0", default=0)
    failed_count = Column(Integer, nullable=False, server_default="0", default=0)
    last_error = Column(Text, nullable=True)
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    created_by = Column(String(36), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    jobs = relationship(
        "BroadcastSendJob", back_populates="campaign", cascade="all, delete-orphan"
    )
