"""Backend tests for the product revenue detail drill-down.

Asserts the drawer detail matches the Product-tab row (same aggregation), the
per-funnel rows sort by revenue desc, the daily series is zero-filled, and an
empty product returns a zeroed state. SQLite in-memory (FKs not enforced).
"""
from datetime import date, datetime

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.models.funnel import Funnel
from app.models.funnel_order import FunnelOrder
from app.models.lead import Lead
from app.models.product import Product
from app.services.funnel_product_detail_service import get_product_revenue_detail
from app.services.funnel_revenue_analytics_service import FunnelRevenueAnalyticsService

SQLALCHEMY_DATABASE_URL = "sqlite:///./test_funnel_product_detail.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

TABLES = [Product.__table__, Funnel.__table__, Lead.__table__, FunnelOrder.__table__]
THRESHOLD = settings.META_PURCHASE_MIN_VND
WHEN = datetime(2026, 6, 10)


def _window():
    return FunnelRevenueAnalyticsService.resolve_analytics_window(date(2026, 6, 1), date(2026, 6, 20))


@pytest.fixture()
def db():
    for table in reversed(TABLES):
        table.drop(bind=engine, checkfirst=True)
    for table in TABLES:
        table.create(bind=engine, checkfirst=True)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        for table in reversed(TABLES):
            table.drop(bind=engine, checkfirst=True)


def _product(db, pid, name):
    db.add(Product(id=pid, name=name, slug=pid, type="course", created_by="admin"))


def _funnel(db, fid, pid):
    db.add(Funnel(id=fid, product_id=pid, title=fid, slug=fid, created_by="admin"))


def _lead(db, lead_id, fid, status):
    db.add(Lead(id=lead_id, email=f"{lead_id}@x.com", source_funnel_id=fid, status=status, created_at=WHEN))


def _order(db, oid, fid, amount, lead_id=None, paid_at=WHEN):
    db.add(FunnelOrder(
        id=oid, funnel_id=fid, lead_id=lead_id, order_code=f"OC{oid}"[:13],
        final_amount=amount, status="SUCCESS", funnel_title=fid, funnel_slug=fid,
        product_name="P", buyer_email="b@x.com", paid_at=paid_at,
    ))


def test_detail_matches_product_tab_row(db):
    _product(db, "p1", "Prod 1")
    _funnel(db, "f1", "p1")
    _funnel(db, "f2", "p1")
    _order(db, "o1", "f1", 100_000)
    _order(db, "o2", "f2", 250_000)
    _lead(db, "l1", "f1", "lead")
    _lead(db, "l2", "f2", "subscribed")
    db.commit()
    start, end = _window()

    detail = get_product_revenue_detail(db, "p1", start, end)
    page = FunnelRevenueAnalyticsService.get_revenue_by_product(db, start, end, 1, 20, None)
    row = next(r for r in page.result if r.product_id == "p1")

    assert detail.summary.total_revenue == row.revenue == 350_000
    assert detail.summary.paid_orders == row.paid_orders == 2
    assert detail.summary.leads.total == row.leads.total == 2
    assert detail.summary.conversion_rate == row.conversion_rate
    assert [f.funnel_id for f in detail.funnels] == ["f2", "f1"]  # sorted by revenue desc


def test_detail_daily_series_zero_filled(db):
    _product(db, "p1", "Prod 1")
    _funnel(db, "f1", "p1")
    _order(db, "o1", "f1", 100_000, paid_at=datetime(2026, 6, 10))
    db.commit()
    start, end = FunnelRevenueAnalyticsService.resolve_analytics_window(date(2026, 6, 9), date(2026, 6, 11))

    detail = get_product_revenue_detail(db, "p1", start, end)

    assert [p.date for p in detail.daily] == ["2026-06-09", "2026-06-10", "2026-06-11"]
    assert [p.revenue for p in detail.daily] == [0, 100_000, 0]


def test_detail_empty_product(db):
    _product(db, "p1", "Prod 1")
    _funnel(db, "f1", "p1")  # funnel exists but no orders
    db.commit()
    start, end = _window()

    detail = get_product_revenue_detail(db, "p1", start, end)

    assert detail.summary.total_revenue == 0
    assert detail.summary.paid_orders == 0
    assert detail.funnels == []
    assert all(p.revenue == 0 for p in detail.daily)


def test_detail_unknown_product_404(db):
    start, end = _window()
    with pytest.raises(HTTPException) as caught:
        get_product_revenue_detail(db, "missing", start, end)
    assert caught.value.status_code == 404
