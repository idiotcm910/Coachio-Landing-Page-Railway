"""Schemas for funnel analytics — public tracking request + admin overview response.

Server is the single source of truth for all aggregated metrics; the admin UI
only renders what `FunnelAnalyticsOverview` returns.
"""
from typing import Literal, Optional

from pydantic import BaseModel, Field

PageType = Literal["landing", "checkout", "payment", "success"]


class FunnelTrackRequest(BaseModel):
    """Anonymous page-view ping fired by a public funnel page on render."""

    page: PageType
    visitor_id: Optional[str] = Field(default=None, max_length=64)


class FunnelAnalyticsWindow(BaseModel):
    start_date: str
    end_date: str


class FunnelRevenueSummary(BaseModel):
    total_revenue: int
    paid_orders: int
    average_order_value: int


class FunnelTrafficBreakdown(BaseModel):
    """View counts and unique visitors per funnel page."""

    landing_views: int
    checkout_views: int
    payment_views: int
    success_views: int
    landing_visitors: int
    checkout_visitors: int
    payment_visitors: int
    success_visitors: int


class FunnelConversionRates(BaseModel):
    """Step-by-step + headline conversion (percent, 0–100, rounded to 2 dp)."""

    landing_to_checkout: float
    checkout_to_payment: float
    payment_to_success: float
    traffic_to_payment: float  # paid_orders / landing unique visitors (headline)


class FunnelDailyPoint(BaseModel):
    date: str
    revenue: int
    paid_orders: int
    landing_views: int


class FunnelLeadsSummary(BaseModel):
    """Lead counts by lifecycle status for leads captured inside the window.

    `purchased` is derived from paid orders (same rule as the leads list); the
    remaining leads keep their stored status. `total` = subscribed + lead + purchased.
    """

    subscribed: int
    lead: int
    purchased: int
    total: int


class FunnelAnalyticsOverview(BaseModel):
    window: FunnelAnalyticsWindow
    revenue: FunnelRevenueSummary
    traffic: FunnelTrafficBreakdown
    conversion: FunnelConversionRates
    leads: FunnelLeadsSummary
    daily: list[FunnelDailyPoint]
