"""Product revenue detail — drill-down for one product on the Revenue page.

Returns the product summary, its per-funnel breakdown, and a zero-filled daily
series, aggregated the SAME way as `funnel_revenue_analytics_service.get_revenue_by_product`
(only funnels with at least one SUCCESS order in the window contribute) so the
drawer numbers match the Product-tab row exactly. Read-only, funnel-sourced.
"""
from collections import defaultdict
from datetime import datetime, timedelta

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.funnel import Funnel
from app.models.funnel_order import FunnelOrder
from app.models.product import Product
from app.schemas.funnel_revenue_analytics import (
    FunnelRevenueRow,
    LeadStatusBreakdown,
    ProductRevenueDetail,
    ProductRevenueDetailSummary,
    RevenueDailyPoint,
)
from app.services.funnel_revenue_analytics_service import _conversion_rate
from app.services.lead_status_counts import EMPTY_COUNTS, lead_counts_by_funnel


def _build_daily(orders: list[FunnelOrder], start_dt: datetime, end_dt: datetime) -> list[RevenueDailyPoint]:
    by_date: dict[str, dict[str, int]] = defaultdict(lambda: {"revenue": 0, "paid_orders": 0})
    for order in orders:
        key = order.paid_at.date().isoformat()
        by_date[key]["revenue"] += order.final_amount
        by_date[key]["paid_orders"] += 1

    series: list[RevenueDailyPoint] = []
    cursor = start_dt.date()
    while cursor < end_dt.date():
        key = cursor.isoformat()
        series.append(RevenueDailyPoint(date=key, revenue=by_date[key]["revenue"], paid_orders=by_date[key]["paid_orders"]))
        cursor += timedelta(days=1)
    return series


def get_product_revenue_detail(db: Session, product_id: str, start_dt: datetime, end_dt: datetime) -> ProductRevenueDetail:
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    product_funnel_ids = [row[0] for row in db.query(Funnel.id).filter(Funnel.product_id == product_id).all()]
    orders: list[FunnelOrder] = []
    if product_funnel_ids:
        orders = (
            db.query(FunnelOrder)
            .filter(
                FunnelOrder.funnel_id.in_(product_funnel_ids),
                FunnelOrder.status == "SUCCESS",
                FunnelOrder.paid_at >= start_dt,
                FunnelOrder.paid_at < end_dt,
            )
            .all()
        )

    # Only funnels with at least one SUCCESS order contribute (matches the Product tab).
    rows: dict[str, dict] = {}
    for order in orders:
        row = rows.setdefault(
            order.funnel_id,
            {"funnel_id": order.funnel_id, "funnel_title": order.funnel_title, "funnel_slug": order.funnel_slug, "revenue": 0, "paid_orders": 0},
        )
        row["revenue"] += order.final_amount
        row["paid_orders"] += 1

    contributing_ids = list(rows.keys())
    lead_counts = lead_counts_by_funnel(db, contributing_ids, start_dt, end_dt)

    funnel_rows: list[FunnelRevenueRow] = []
    agg_leads = dict(EMPTY_COUNTS)
    for funnel_id, row in rows.items():
        counts = lead_counts.get(funnel_id, dict(EMPTY_COUNTS))
        for key in agg_leads:
            agg_leads[key] += counts[key]
        funnel_rows.append(
            FunnelRevenueRow(
                funnel_id=row["funnel_id"],
                funnel_title=row["funnel_title"],
                funnel_slug=row["funnel_slug"],
                revenue=row["revenue"],
                paid_orders=row["paid_orders"],
                leads=LeadStatusBreakdown(**counts),
                conversion_rate=_conversion_rate(counts["purchased"], counts["total"]),
            )
        )
    funnel_rows.sort(key=lambda item: item.revenue, reverse=True)

    total_revenue = sum(row.revenue for row in funnel_rows)
    paid_orders = sum(row.paid_orders for row in funnel_rows)
    summary = ProductRevenueDetailSummary(
        total_revenue=total_revenue,
        paid_orders=paid_orders,
        leads=LeadStatusBreakdown(**agg_leads),
        conversion_rate=_conversion_rate(agg_leads["purchased"], agg_leads["total"]),
    )

    return ProductRevenueDetail(
        product_id=product.id,
        product_name=product.name,
        summary=summary,
        funnels=funnel_rows,
        daily=_build_daily(orders, start_dt, end_dt),
    )
