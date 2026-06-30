"""Funnel analytics — aggregates revenue (funnel_orders) + traffic (funnel_page_views)
into a single admin overview, with a ≤1-month (31-day) time window guard (D21).

All amounts are integer VND; revenue counts only SUCCESS orders by `paid_at`.
Conversion headline = paid_orders / unique landing visitors.
"""
from collections import defaultdict
from datetime import date, datetime, time, timedelta

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.funnel_order import FunnelOrder
from app.models.funnel_page_view import FunnelPageView
from app.schemas.funnel_analytics import (
    FunnelAnalyticsOverview,
    FunnelAnalyticsWindow,
    FunnelConversionRates,
    FunnelDailyPoint,
    FunnelLeadsSummary,
    FunnelRevenueSummary,
    FunnelTrafficBreakdown,
)
from app.services.lead_status_counts import lead_counts_for_funnel
from app.utils.date_utils import DateWindowError

MAX_WINDOW_DAYS = 31
PAGE_TYPES = ("landing", "checkout", "payment", "success")


def _rate(numerator: int, denominator: int) -> float:
    """Percentage 0–100 rounded to 2 dp; 0 when denominator is 0."""
    return round(numerator / denominator * 100, 2) if denominator else 0.0


class FunnelAnalyticsService:
    @staticmethod
    def resolve_analytics_window(
        start_date: date | None, end_date: date | None
    ) -> tuple[datetime, datetime]:
        """Mirror of the course-analytics window: default last 30 days, max 1 month."""
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
    def _successful_orders(db: Session, funnel_id: str, start_dt: datetime, end_dt: datetime) -> list[FunnelOrder]:
        return (
            db.query(FunnelOrder)
            .filter(
                FunnelOrder.funnel_id == funnel_id,
                FunnelOrder.status == "SUCCESS",
                FunnelOrder.paid_at >= start_dt,
                FunnelOrder.paid_at < end_dt,
            )
            .order_by(FunnelOrder.paid_at.asc())
            .all()
        )

    @staticmethod
    def _traffic(db: Session, funnel_id: str, start_dt: datetime, end_dt: datetime) -> FunnelTrafficBreakdown:
        # views = total rows per page; visitors = distinct visitor_id per page
        view_rows = (
            db.query(FunnelPageView.page_type, func.count(FunnelPageView.id))
            .filter(
                FunnelPageView.funnel_id == funnel_id,
                FunnelPageView.created_at >= start_dt,
                FunnelPageView.created_at < end_dt,
            )
            .group_by(FunnelPageView.page_type)
            .all()
        )
        visitor_rows = (
            db.query(FunnelPageView.page_type, func.count(func.distinct(FunnelPageView.visitor_id)))
            .filter(
                FunnelPageView.funnel_id == funnel_id,
                FunnelPageView.visitor_id.isnot(None),
                FunnelPageView.created_at >= start_dt,
                FunnelPageView.created_at < end_dt,
            )
            .group_by(FunnelPageView.page_type)
            .all()
        )
        views = {page: count for page, count in view_rows}
        visitors = {page: count for page, count in visitor_rows}
        return FunnelTrafficBreakdown(
            landing_views=views.get("landing", 0),
            checkout_views=views.get("checkout", 0),
            payment_views=views.get("payment", 0),
            success_views=views.get("success", 0),
            landing_visitors=visitors.get("landing", 0),
            checkout_visitors=visitors.get("checkout", 0),
            payment_visitors=visitors.get("payment", 0),
            success_visitors=visitors.get("success", 0),
        )

    @staticmethod
    def _lead_counts(db: Session, funnel_id: str, start_dt: datetime, end_dt: datetime) -> FunnelLeadsSummary:
        """Count leads captured in the window by lifecycle status (purchased derived).

        Delegates to the shared `lead_status_counts` helper so the per-funnel
        overview and the revenue rollups stay in lockstep.
        """
        counts = lead_counts_for_funnel(db, funnel_id, start_dt, end_dt)
        return FunnelLeadsSummary(**counts)

    @staticmethod
    def get_overview(
        db: Session, funnel_id: str, start_dt: datetime, end_dt: datetime
    ) -> FunnelAnalyticsOverview:
        orders = FunnelAnalyticsService._successful_orders(db, funnel_id, start_dt, end_dt)
        total_revenue = sum(order.final_amount for order in orders)
        paid_orders = len(orders)
        revenue = FunnelRevenueSummary(
            total_revenue=total_revenue,
            paid_orders=paid_orders,
            average_order_value=round(total_revenue / paid_orders) if paid_orders else 0,
        )

        traffic = FunnelAnalyticsService._traffic(db, funnel_id, start_dt, end_dt)
        leads = FunnelAnalyticsService._lead_counts(db, funnel_id, start_dt, end_dt)
        conversion = FunnelConversionRates(
            landing_to_checkout=_rate(traffic.checkout_visitors, traffic.landing_visitors),
            checkout_to_payment=_rate(traffic.payment_visitors, traffic.checkout_visitors),
            payment_to_success=_rate(traffic.success_visitors, traffic.payment_visitors),
            traffic_to_payment=_rate(paid_orders, traffic.landing_visitors),
        )

        # Daily series (revenue + landing views), zero-filled across the window
        revenue_by_date: dict[str, dict[str, int]] = defaultdict(lambda: {"revenue": 0, "paid_orders": 0})
        for order in orders:
            key = order.paid_at.date().isoformat()
            revenue_by_date[key]["revenue"] += order.final_amount
            revenue_by_date[key]["paid_orders"] += 1

        landing_by_date_rows = (
            db.query(func.date(FunnelPageView.created_at), func.count(FunnelPageView.id))
            .filter(
                FunnelPageView.funnel_id == funnel_id,
                FunnelPageView.page_type == "landing",
                FunnelPageView.created_at >= start_dt,
                FunnelPageView.created_at < end_dt,
            )
            .group_by(func.date(FunnelPageView.created_at))
            .all()
        )
        landing_by_date = {str(day): count for day, count in landing_by_date_rows}

        daily: list[FunnelDailyPoint] = []
        cursor = start_dt.date()
        while cursor < end_dt.date():
            key = cursor.isoformat()
            daily.append(
                FunnelDailyPoint(
                    date=key,
                    revenue=revenue_by_date[key]["revenue"],
                    paid_orders=revenue_by_date[key]["paid_orders"],
                    landing_views=landing_by_date.get(key, 0),
                )
            )
            cursor += timedelta(days=1)

        return FunnelAnalyticsOverview(
            window=FunnelAnalyticsWindow(
                start_date=start_dt.date().isoformat(),
                end_date=(end_dt.date() - timedelta(days=1)).isoformat(),
            ),
            revenue=revenue,
            traffic=traffic,
            conversion=conversion,
            leads=leads,
            daily=daily,
        )

    @staticmethod
    def track_page_view(db: Session, funnel_id: str, page_type: str, visitor_id: str | None) -> None:
        """Best-effort insert of one anonymous page-view row."""
        db.add(FunnelPageView(funnel_id=funnel_id, page_type=page_type, visitor_id=visitor_id))
        db.commit()
