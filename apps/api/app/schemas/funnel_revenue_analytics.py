"""Schemas for cross-funnel / cross-product revenue rollups on the Revenue page.

Server is the single source of truth for every aggregated metric; the admin UI
only renders what these models return. Amounts are integer VND. `conversion_rate`
is a 0–1 ratio (purchased ÷ total leads), 0 when there are no leads.
"""
from pydantic import BaseModel

from app.schemas.pagination import Meta


class LeadStatusBreakdown(BaseModel):
    subscribed: int
    lead: int
    purchased: int
    total: int


class RevenueScopeSummary(BaseModel):
    """Totals across the full (unpaginated) result set for the active tab."""

    total_revenue: int
    paid_orders: int


class FunnelRevenueRow(BaseModel):
    funnel_id: str
    funnel_title: str
    funnel_slug: str
    revenue: int
    paid_orders: int
    leads: LeadStatusBreakdown
    conversion_rate: float


class ProductRevenueRow(BaseModel):
    product_id: str
    product_name: str
    revenue: int
    paid_orders: int
    leads: LeadStatusBreakdown
    conversion_rate: float


class RevenueDailyPoint(BaseModel):
    date: str
    revenue: int
    paid_orders: int


class ProductRevenueDetailSummary(BaseModel):
    total_revenue: int
    paid_orders: int
    leads: LeadStatusBreakdown
    conversion_rate: float


class ProductRevenueDetail(BaseModel):
    """One product's drill-down: summary + per-funnel rows + daily series."""

    product_id: str
    product_name: str
    summary: ProductRevenueDetailSummary
    funnels: list[FunnelRevenueRow]
    daily: list[RevenueDailyPoint]


class FunnelRevenueListResponse(BaseModel):
    summary: RevenueScopeSummary
    meta: Meta
    result: list[FunnelRevenueRow]


class ProductRevenueListResponse(BaseModel):
    summary: RevenueScopeSummary
    meta: Meta
    result: list[ProductRevenueRow]
