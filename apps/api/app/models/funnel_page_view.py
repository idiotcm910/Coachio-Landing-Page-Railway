"""Anonymous funnel page-view event — powers the funnel analytics/traffic metrics.

One row per page render on a published funnel (landing/checkout/payment/success).
`visitor_id` is an anonymous client-generated id (localStorage) used only to
estimate unique visitors and the traffic→payment conversion (no PII, D20).
"""
import uuid

from sqlalchemy import Column, DateTime, ForeignKey, String
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base import Base


class FunnelPageView(Base):
    __tablename__ = "funnel_page_views"

    id = Column(String(36), primary_key=True, index=True, default=lambda: str(uuid.uuid4()))
    funnel_id = Column(String(36), ForeignKey("funnels.id", ondelete="CASCADE"), nullable=False, index=True)
    # One of: landing | checkout | payment | success
    page_type = Column(String(20), nullable=False, index=True)
    # Anonymous visitor id from the client (localStorage); nullable for best-effort tracking
    visitor_id = Column(String(64), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)

    funnel = relationship("Funnel")
