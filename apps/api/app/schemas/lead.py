"""Pydantic schemas for Lead admin list/filter/export (D5, funnel-landing-lead-capture).

Status lifecycle (D3):
  subscribed — opt-in via landing form capture API, no checkout yet
  lead       — entered checkout (default for legacy rows)
  purchased  — derived: has a qualifying paid order (purchase_amount > threshold)
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class LeadRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    email: str
    name: Optional[str] = None
    phone: Optional[str] = None
    source_funnel_id: str
    # Title of the funnel the lead came from — rendered as a badge in the admin table.
    funnel_title: Optional[str] = None
    converted_at: Optional[datetime] = None
    created_at: datetime
    # Highest paid order amount (VND) tied to this lead; 0 when no paid order.
    purchase_amount: int = 0
    # Lifecycle status: subscribed | lead | purchased (purchased is derived, others stored).
    status: str = "lead"


class LeadListResponse(BaseModel):
    items: list[LeadRead]
    total: int
    page: int
    page_size: int
