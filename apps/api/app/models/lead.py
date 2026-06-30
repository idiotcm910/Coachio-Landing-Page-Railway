"""Lead captured through the funnel — separate from user accounts (D5, BR-5).

Created/updated at checkout, marked converted inside the idempotent
complete-order routine. Unique per (email, source_funnel_id).

Status lifecycle (D3, funnel-landing-lead-capture):
  subscribed — opt-in via landing form, no checkout yet
  lead       — entered checkout (default for legacy rows)
  purchased  — derived at query time from paid orders (not stored)
"""
import uuid

from sqlalchemy import Column, DateTime, ForeignKey, JSON, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base import Base


class Lead(Base):
    __tablename__ = "leads"
    __table_args__ = (UniqueConstraint("email", "source_funnel_id", name="uq_leads_email_funnel"),)

    id = Column(String(36), primary_key=True, index=True, default=lambda: str(uuid.uuid4()))
    email = Column(String(255), nullable=False, index=True)
    name = Column(String(255), nullable=True)
    phone = Column(String(50), nullable=True)
    source_funnel_id = Column(String(36), ForeignKey("funnels.id", ondelete="CASCADE"), nullable=False, index=True)
    # Stored lifecycle status: subscribed | lead (purchased is derived, not stored)
    status = Column(String(20), nullable=False, default="lead", server_default="lead", index=True)
    # Arbitrary submission metadata: utm_*, ip, user_agent, referrer, landing, etc.
    meta = Column(JSON().with_variant(JSONB, "postgresql"), nullable=True)
    converted_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    source_funnel = relationship("Funnel")
    orders = relationship("FunnelOrder", back_populates="lead")
