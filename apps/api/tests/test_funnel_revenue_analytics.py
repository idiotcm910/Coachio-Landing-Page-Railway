"""Backend tests for cross-funnel / cross-product revenue rollups.

Covers FunnelRevenueAnalyticsService aggregation + the shared lead_status_counts
helper. SQLite in-memory (FKs not enforced) — only Product, Funnel, Lead and
FunnelOrder tables are needed.

Asserted behaviors:
  - revenue grouped by funnel, sorted by revenue desc, with scope summary
  - lead-status breakdown + conversion rate (purchased / total)
  - zero-lead rows report conversion rate 0 (no division-by-zero)
  - product revenue = sum of all funnels using that product
  - funnels with no resolvable product are excluded from the Product tab
  - bulk lead_counts_by_funnel matches the single-funnel lead_counts_for_funnel
"""
from datetime import date, datetime

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.models.funnel import Funnel
from app.models.funnel_order import FunnelOrder
from app.models.lead import Lead
from app.models.product import Product
from app.services.funnel_revenue_analytics_service import FunnelRevenueAnalyticsService
from app.services.lead_status_counts import lead_counts_by_funnel, lead_counts_for_funnel

SQLALCHEMY_DATABASE_URL = "sqlite:///./test_funnel_revenue_analytics.db"
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


def _funnel(db, fid, pid, title=None):
    db.add(Funnel(id=fid, product_id=pid, title=title or fid, slug=fid, created_by="admin"))


def _lead(db, lead_id, fid, status, created_at=WHEN):
    db.add(Lead(id=lead_id, email=f"{lead_id}@x.com", source_funnel_id=fid, status=status, created_at=created_at))


def _order(db, oid, fid, amount, lead_id=None, title="T", slug="s"):
    db.add(FunnelOrder(
        id=oid, funnel_id=fid, lead_id=lead_id, order_code=f"OC{oid}"[:13],
        final_amount=amount, status="SUCCESS", funnel_title=title, funnel_slug=slug,
        product_name="P", buyer_email="b@x.com", paid_at=WHEN,
    ))


def test_revenue_by_funnel_sorts_desc_with_summary(db):
    _product(db, "p1", "Prod 1")
    _funnel(db, "f1", "p1", title="Funnel One")
    _funnel(db, "f2", "p1", title="Funnel Two")
    _order(db, "o1", "f1", 100_000)
    _order(db, "o2", "f2", 250_000)
    db.commit()
    start, end = _window()

    page = FunnelRevenueAnalyticsService.get_revenue_by_funnel(db, start, end, 1, 20, None)

    assert [r.funnel_id for r in page.result] == ["f2", "f1"]  # sorted by revenue desc
    assert page.summary.total_revenue == 350_000
    assert page.summary.paid_orders == 2
    assert page.meta.total_items == 2


def test_revenue_by_funnel_lead_breakdown_and_conversion(db):
    _product(db, "p1", "Prod 1")
    _funnel(db, "f1", "p1")
    for i in range(10):
        _lead(db, f"sub-{i}", "f1", "subscribed")
    for i in range(5):
        _lead(db, f"lead-{i}", "f1", "lead")
    for i in range(5):
        _lead(db, f"buy-{i}", "f1", "subscribed")
        _order(db, f"ob-{i}", "f1", THRESHOLD + 10_000, lead_id=f"buy-{i}")
    db.commit()
    start, end = _window()

    page = FunnelRevenueAnalyticsService.get_revenue_by_funnel(db, start, end, 1, 20, None)

    row = page.result[0]
    assert row.leads.total == 20
    assert row.leads.subscribed == 10
    assert row.leads.lead == 5
    assert row.leads.purchased == 5
    assert row.conversion_rate == 0.25
    assert row.paid_orders == 5


def test_zero_lead_conversion_rate(db):
    _product(db, "p1", "Prod 1")
    _funnel(db, "f1", "p1")
    _order(db, "o1", "f1", 100_000)  # order but no leads
    db.commit()
    start, end = _window()

    page = FunnelRevenueAnalyticsService.get_revenue_by_funnel(db, start, end, 1, 20, None)

    assert page.result[0].leads.total == 0
    assert page.result[0].conversion_rate == 0.0


def test_revenue_by_product_is_sum_of_its_funnels(db):
    _product(db, "p1", "Prod 1")
    _product(db, "p2", "Prod 2")
    _funnel(db, "f1", "p1")
    _funnel(db, "f2", "p1")
    _funnel(db, "f3", "p2")
    _order(db, "o1", "f1", 100_000)
    _order(db, "o2", "f2", 250_000)
    _order(db, "o3", "f3", 50_000)
    _lead(db, "l1", "f1", "lead")
    _lead(db, "l2", "f2", "subscribed")
    db.commit()
    start, end = _window()

    page = FunnelRevenueAnalyticsService.get_revenue_by_product(db, start, end, 1, 20, None)

    assert [r.product_id for r in page.result] == ["p1", "p2"]  # sorted desc
    p1 = page.result[0]
    assert p1.revenue == 350_000
    assert p1.paid_orders == 2
    assert p1.leads.total == 2  # summed across f1 + f2
    assert page.summary.total_revenue == 400_000


def test_funnel_without_product_excluded_from_products(db):
    _product(db, "p1", "Prod 1")
    _funnel(db, "f1", "p1")
    _order(db, "o1", "f1", 100_000)
    # order on a funnel with no Funnel row → product mapping misses → excluded
    _order(db, "o-orphan", "ghost-funnel", 999_000)
    db.commit()
    start, end = _window()

    page = FunnelRevenueAnalyticsService.get_revenue_by_product(db, start, end, 1, 20, None)

    assert [r.product_id for r in page.result] == ["p1"]
    assert page.summary.total_revenue == 100_000  # orphan revenue excluded


def test_bulk_lead_counts_matches_single(db):
    _product(db, "p1", "Prod 1")
    _funnel(db, "f1", "p1")
    _lead(db, "s1", "f1", "subscribed")
    _lead(db, "ld1", "f1", "lead")
    _lead(db, "b1", "f1", "subscribed")
    _order(db, "ob1", "f1", THRESHOLD + 1, lead_id="b1")
    db.commit()
    start, end = _window()

    bulk = lead_counts_by_funnel(db, ["f1"], start, end)["f1"]
    single = lead_counts_for_funnel(db, "f1", start, end)

    assert bulk == single
    assert single == {"subscribed": 1, "lead": 1, "purchased": 1, "total": 3}
