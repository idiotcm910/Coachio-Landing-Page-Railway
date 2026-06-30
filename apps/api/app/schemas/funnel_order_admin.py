"""Pydantic v2 schemas for admin funnel order endpoints."""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class AdminFunnelOrderListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    order_code: str
    buyer_email: str
    buyer_full_name: Optional[str]
    buyer_phone: Optional[str]
    funnel_title: str
    product_name: str
    amount: int  # maps to final_amount
    status: str
    payment_provider: str
    paid_at: Optional[datetime]
    created_at: datetime


class AdminFunnelOrderListResponse(BaseModel):
    items: list[AdminFunnelOrderListItem]
    next_cursor: Optional[str]
    has_next: bool


class AdminFunnelOrderSummary(BaseModel):
    success_count: int
    revenue: int
    aov: int  # avg order value among SUCCESS orders


class AdminFunnelOrderDetail(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    order_code: str
    status: str
    payment_provider: str
    amount: int  # final_amount
    subtotal_amount: int
    discount_amount: int
    buyer_email: str
    buyer_full_name: Optional[str]
    buyer_phone: Optional[str]
    funnel_title: str
    funnel_slug: str
    product_name: str
    funnel_id: str
    lead_id: Optional[str]
    created_at: datetime
    paid_at: Optional[datetime]
    updated_at: Optional[datetime]
    manual_activated_by: Optional[str] = None
    manual_activated_at: Optional[datetime] = None
