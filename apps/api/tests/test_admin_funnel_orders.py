"""Tests for admin funnel order service (list_keyset, get_summary, get_detail).

Ported to coachio-landing-page: User/Course/Order/CourseOrder/ProductCourse tables removed.
FunnelOrder does not need a User FK in SQLite (no FK enforcement).
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.models.discount import Discount, DiscountDefaultActivation, DiscountScope, OrderDiscount
from app.models.funnel import Funnel, FunnelLandingPage, FunnelSection  # noqa: F401 — needed for table creation
from app.models.funnel_order import FunnelOrder
from app.models.lead import Lead
from app.models.product import Product
from app.services import admin_funnel_order_service as svc

SQLALCHEMY_DATABASE_URL = "sqlite:///./test_admin_funnel_orders.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

TABLES = [
    Product.__table__,
    Funnel.__table__,
    FunnelLandingPage.__table__,
    FunnelSection.__table__,
    Discount.__table__,
    DiscountDefaultActivation.__table__,
    DiscountScope.__table__,
    Lead.__table__,
    FunnelOrder.__table__,
    OrderDiscount.__table__,
]


def create_tables():
    for table in TABLES:
        table.create(bind=engine, checkfirst=True)


def drop_tables():
    for table in reversed(TABLES):
        table.drop(bind=engine, checkfirst=True)


@pytest.fixture(scope="module")
def db():
    create_tables()
    session = TestingSessionLocal()
    yield session
    session.close()
    drop_tables()


def _make_funnel_id() -> str:
    """Return a fake funnel_id UUID. SQLite does not enforce FK constraints by default."""
    return str(uuid.uuid4())


def _make_order(db, funnel_id: str, status: str, final_amount: int = 199000) -> FunnelOrder:
    now = datetime.now(timezone.utc)
    order = FunnelOrder(
        id=str(uuid.uuid4()),
        funnel_id=funnel_id,
        order_code="ORD" + str(uuid.uuid4())[:10].upper(),
        funnel_title="Test Funnel",
        funnel_slug="test-funnel",
        product_name="Test Product",
        buyer_email="buyer@example.com",
        buyer_full_name="Test Buyer",
        buyer_phone="0901234567",
        subtotal_amount=final_amount,
        discount_amount=0,
        final_amount=final_amount,
        status=status,
        payment_provider="sepay",
        paid_at=now if status == "SUCCESS" else None,
        created_at=now,
    )
    db.add(order)
    db.flush()
    return order


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

def test_list_returns_success_orders_by_default(db):
    fid = _make_funnel_id()
    success = _make_order(db, fid, "SUCCESS", 199000)
    pending = _make_order(db, fid, "PENDING", 299000)
    db.commit()

    rows, next_cursor, has_next = svc.list_keyset(db, status="SUCCESS")
    ids = [r.id for r in rows]
    assert success.id in ids
    assert pending.id not in ids


def test_list_all_returns_both_statuses(db):
    fid = _make_funnel_id()
    success = _make_order(db, fid, "SUCCESS")
    pending = _make_order(db, fid, "PENDING")
    db.commit()

    rows, _, _ = svc.list_keyset(db, status="ALL")
    ids = [r.id for r in rows]
    assert success.id in ids
    assert pending.id in ids


def test_list_filter_by_funnel_id(db):
    fid_a = _make_funnel_id()
    fid_b = _make_funnel_id()
    order_a = _make_order(db, fid_a, "SUCCESS")
    order_b = _make_order(db, fid_b, "SUCCESS")
    db.commit()

    rows, _, _ = svc.list_keyset(db, status="ALL", funnel_id=fid_a)
    ids = [r.id for r in rows]
    assert order_a.id in ids
    assert order_b.id not in ids


def test_keyset_pagination_returns_next_cursor_when_more(db):
    fid = _make_funnel_id()
    for _ in range(3):
        _make_order(db, fid, "SUCCESS")
    db.commit()

    rows, next_cursor, has_next = svc.list_keyset(
        db, status="SUCCESS", funnel_id=fid, per_page=2
    )
    assert len(rows) == 2
    assert has_next is True
    assert next_cursor is not None


def test_keyset_pagination_second_page(db):
    fid = _make_funnel_id()
    for _ in range(4):
        _make_order(db, fid, "SUCCESS")
    db.commit()

    rows1, cursor1, _ = svc.list_keyset(
        db, status="SUCCESS", funnel_id=fid, per_page=2, sort_by="created_at", sort_order="asc"
    )
    assert cursor1 is not None
    rows2, cursor2, has_next2 = svc.list_keyset(
        db, status="SUCCESS", funnel_id=fid, per_page=2, sort_by="created_at", sort_order="asc",
        cursor=cursor1,
    )
    ids1 = {r.id for r in rows1}
    ids2 = {r.id for r in rows2}
    # Pages must not overlap
    assert ids1.isdisjoint(ids2)


def test_invalid_cursor_raises_value_error(db):
    with pytest.raises(ValueError):
        svc.list_keyset(db, cursor="not-valid-base64!!!")


def test_summary_computes_success_count_revenue_aov(db):
    fid = _make_funnel_id()
    _make_order(db, fid, "SUCCESS", 100000)
    _make_order(db, fid, "SUCCESS", 300000)
    _make_order(db, fid, "PENDING", 200000)
    db.commit()

    data = svc.get_summary(db, funnel_id=fid)
    assert data["success_count"] == 2
    assert data["revenue"] == 400000
    assert data["aov"] == 200000


def test_summary_aov_zero_when_no_success(db):
    fid = _make_funnel_id()
    _make_order(db, fid, "PENDING", 100000)
    db.commit()

    data = svc.get_summary(db, funnel_id=fid)
    assert data["success_count"] == 0
    assert data["revenue"] == 0
    assert data["aov"] == 0


def test_get_detail_returns_order(db):
    fid = _make_funnel_id()
    order = _make_order(db, fid, "SUCCESS", 199000)
    db.commit()

    result = svc.get_detail(db, order.id)
    assert result is not None
    assert result.id == order.id
    assert result.final_amount == 199000


def test_get_detail_returns_none_for_missing(db):
    result = svc.get_detail(db, str(uuid.uuid4()))
    assert result is None
