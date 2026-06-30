"""Cross-funnel and cross-product revenue rollups for the system-admin Revenue page.

Aggregates SUCCESS `FunnelOrder` revenue (by `paid_at`) grouped by funnel and by
the funnel's product, attaching the shared lead-status breakdown + conversion
rate. No student / student-AOV metric here (that lives on the Course tab only).

A product's revenue = the sum of all funnels that use that product (funnel-sourced
revenue only). The date window mirrors the course-analytics window (default last
30 days, max 31 days) so the Revenue page's shared date filter stays consistent.
"""
from datetime import date, datetime, time, timedelta
from math import ceil

from sqlalchemy.orm import Session

from app.models.funnel import Funnel
from app.models.funnel_order import FunnelOrder
from app.models.product import Product
from app.schemas.funnel_revenue_analytics import (
    FunnelRevenueListResponse,
    FunnelRevenueRow,
    LeadStatusBreakdown,
    ProductRevenueListResponse,
    ProductRevenueRow,
    RevenueScopeSummary,
)
from app.schemas.pagination import Meta
from app.services.lead_status_counts import EMPTY_COUNTS, lead_counts_by_funnel
from app.utils.date_utils import DateWindowError

MAX_WINDOW_DAYS = 31


def _conversion_rate(purchased: int, total: int) -> float:
    """Purchased ÷ total leads as a 0–1 ratio (0 when no leads)."""
    return round(purchased / total, 4) if total else 0.0


def _page_meta(total: int, page: int, page_size: int) -> Meta:
    return Meta(
        page=page,
        page_size=page_size,
        total_pages=ceil(total / page_size) if total else 0,
        total_items=total,
    )


class FunnelRevenueAnalyticsService:
    @staticmethod
    def resolve_analytics_window(start_date: date | None, end_date: date | None) -> tuple[datetime, datetime]:
        today = datetime.utcnow().date()
        if start_date is None and end_date is None:
            end_date = today
            start_date = today - timedelta(days=29)
        elif start_date is None and end_date is not None:
            start_date = end_date - timedelta(days=29)
        elif start_date is not None and end_date is None:
            end_date = today

        if start_date > end_date:
            raise DateWindowError("start_date must be before or equal to end_date")
        if (end_date - start_date).days + 1 > MAX_WINDOW_DAYS:
            raise DateWindowError(f"date range cannot exceed {MAX_WINDOW_DAYS} days")

        return datetime.combine(start_date, time.min), datetime.combine(end_date + timedelta(days=1), time.min)

    @staticmethod
    def _success_orders(db: Session, start_dt: datetime, end_dt: datetime) -> list[FunnelOrder]:
        return (
            db.query(FunnelOrder)
            .filter(
                FunnelOrder.status == "SUCCESS",
                FunnelOrder.paid_at >= start_dt,
                FunnelOrder.paid_at < end_dt,
            )
            .all()
        )

    @staticmethod
    def get_revenue_by_funnel(
        db: Session, start_dt: datetime, end_dt: datetime, page: int, page_size: int, search: str | None
    ) -> FunnelRevenueListResponse:
        search_value = search.lower() if search else None
        rows: dict[str, dict] = {}
        for order in FunnelRevenueAnalyticsService._success_orders(db, start_dt, end_dt):
            if search_value and search_value not in order.funnel_title.lower() and search_value not in order.funnel_slug.lower():
                continue
            row = rows.setdefault(
                order.funnel_id,
                {
                    "funnel_id": order.funnel_id,
                    "funnel_title": order.funnel_title,
                    "funnel_slug": order.funnel_slug,
                    "paid_orders": 0,
                    "revenue": 0,
                },
            )
            row["paid_orders"] += 1
            row["revenue"] += order.final_amount

        lead_counts = lead_counts_by_funnel(db, list(rows.keys()), start_dt, end_dt)
        result: list[FunnelRevenueRow] = []
        for funnel_id, row in rows.items():
            counts = lead_counts.get(funnel_id, dict(EMPTY_COUNTS))
            result.append(
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
        result.sort(key=lambda item: item.revenue, reverse=True)

        summary = RevenueScopeSummary(
            total_revenue=sum(item.revenue for item in result),
            paid_orders=sum(item.paid_orders for item in result),
        )
        start = (page - 1) * page_size
        return FunnelRevenueListResponse(
            summary=summary,
            meta=_page_meta(len(result), page, page_size),
            result=result[start:start + page_size],
        )

    @staticmethod
    def get_revenue_by_product(
        db: Session, start_dt: datetime, end_dt: datetime, page: int, page_size: int, search: str | None
    ) -> ProductRevenueListResponse:
        orders = FunnelRevenueAnalyticsService._success_orders(db, start_dt, end_dt)
        funnel_ids = list({order.funnel_id for order in orders})
        product_by_funnel: dict[str, str] = dict(
            db.query(Funnel.id, Funnel.product_id).filter(Funnel.id.in_(funnel_ids)).all()
        ) if funnel_ids else {}

        rows: dict[str, dict] = {}
        for order in orders:
            product_id = product_by_funnel.get(order.funnel_id)
            if not product_id:  # funnel with no product is excluded
                continue
            row = rows.setdefault(
                product_id,
                {"product_id": product_id, "paid_orders": 0, "revenue": 0, "funnel_ids": set()},
            )
            row["paid_orders"] += 1
            row["revenue"] += order.final_amount
            row["funnel_ids"].add(order.funnel_id)

        product_ids = list(rows.keys())
        names: dict[str, str] = dict(
            db.query(Product.id, Product.name).filter(Product.id.in_(product_ids)).all()
        ) if product_ids else {}
        lead_counts = lead_counts_by_funnel(db, funnel_ids, start_dt, end_dt)

        search_value = search.lower() if search else None
        result: list[ProductRevenueRow] = []
        for product_id, row in rows.items():
            name = names.get(product_id, "")
            if search_value and search_value not in (name or "").lower():
                continue
            agg = dict(EMPTY_COUNTS)
            for funnel_id in row["funnel_ids"]:
                counts = lead_counts.get(funnel_id)
                if counts:
                    for key in agg:
                        agg[key] += counts[key]
            result.append(
                ProductRevenueRow(
                    product_id=product_id,
                    product_name=name,
                    revenue=row["revenue"],
                    paid_orders=row["paid_orders"],
                    leads=LeadStatusBreakdown(**agg),
                    conversion_rate=_conversion_rate(agg["purchased"], agg["total"]),
                )
            )
        result.sort(key=lambda item: item.revenue, reverse=True)

        summary = RevenueScopeSummary(
            total_revenue=sum(item.revenue for item in result),
            paid_orders=sum(item.paid_orders for item in result),
        )
        start = (page - 1) * page_size
        return ProductRevenueListResponse(
            summary=summary,
            meta=_page_meta(len(result), page, page_size),
            result=result[start:start + page_size],
        )
