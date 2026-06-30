"""Gift automation — auto-deliver gift(s) when a lead reaches a status in a funnel.

`trigger_status` ∈ {purchased, subscribed, lead}. `funnel_id` null = all funnels.
`gift_ids` is a JSON list of gift ids granted together (one email covers all).
`max_total_grants` caps delivered RECIPIENTS; `grants_count` is incremented
atomically (conditional UPDATE) so concurrent qualifying events never exceed it.
The delivery email (subject/html) lives here, not on the gift.
"""
import uuid

from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy.sql import func

from app.db.base import Base


class GiftAutomation(Base):
    __tablename__ = "gift_automations"
    __table_args__ = (
        Index("ix_gift_automations_funnel_status", "funnel_id", "trigger_status"),
    )

    id = Column(String(36), primary_key=True, index=True, default=lambda: str(uuid.uuid4()))
    gift_ids = Column(JSON, nullable=True)  # list[str] of gift ids granted together
    funnel_id = Column(
        String(36), ForeignKey("funnels.id", ondelete="CASCADE"), nullable=True, index=True
    )
    trigger_status = Column(String(16), nullable=False)  # purchased | subscribed | lead
    is_active = Column(Boolean, nullable=False, server_default="true", default=True)
    max_total_grants = Column(Integer, nullable=True)  # null = unlimited
    grants_count = Column(Integer, nullable=False, server_default="0", default=0)
    email_subject = Column(Text, nullable=False, server_default="")
    email_html = Column(Text, nullable=False, server_default="")
    created_by = Column(String(36), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
