"""Backend test for funnel-analytics lead-status counts (FunnelAnalyticsService._lead_counts).

Verifies the window-bounded breakdown by lifecycle status:
  - subscribed / lead come from the stored Lead.status
  - purchased is derived from a SUCCESS order strictly above META_PURCHASE_MIN_VND
  - leads outside the [start, end) window are excluded

Uses SQLite in-memory (FKs not enforced) — only the Lead + FunnelOrder tables
are needed since _lead_counts does not join the funnel.
"""

from datetime import datetime

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.models.funnel_order import FunnelOrder
from app.models.lead import Lead
from app.services.funnel_analytics_service import FunnelAnalyticsService

SQLALCHEMY_DATABASE_URL = "sqlite:///./test_funnel_analytics_leads.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

FUNNEL_ID = "funnel-1"
THRESHOLD = settings.META_PURCHASE_MIN_VND


@pytest.fixture()
def db():
    Lead.__table__.create(bind=engine, checkfirst=True)
    FunnelOrder.__table__.create(bind=engine, checkfirst=True)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Lead.__table__.drop(bind=engine, checkfirst=True)
        FunnelOrder.__table__.drop(bind=engine, checkfirst=True)


def _lead(session, lead_id, status, created_at, funnel_id=FUNNEL_ID):
    session.add(Lead(
        id=lead_id, email=f"{lead_id}@x.com", source_funnel_id=funnel_id,
        status=status, created_at=created_at,
    ))


def _success_order(session, lead_id, amount):
    session.add(FunnelOrder(
        id=f"order-{lead_id}", funnel_id=FUNNEL_ID, lead_id=lead_id,
        order_code=f"OC{lead_id}"[:13], final_amount=amount, status="SUCCESS",
        funnel_title="T", funnel_slug="s", product_name="P", buyer_email="b@x.com",
        paid_at=datetime(2026, 6, 12),
    ))


def test_lead_counts_breakdown_and_window(db):
    in_window = datetime(2026, 6, 10)
    out_window = datetime(2026, 5, 1)

    # purchased: subscribed lead with a SUCCESS order above threshold
    _lead(db, "l-purchased", "subscribed", in_window)
    _success_order(db, "l-purchased", THRESHOLD + 50_000)
    # plain lead with a SUCCESS order BELOW threshold → stays 'lead'
    _lead(db, "l-cheap", "lead", in_window)
    _success_order(db, "l-cheap", THRESHOLD - 1)
    # subscribed, no order
    _lead(db, "l-sub", "subscribed", in_window)
    # lead, no order
    _lead(db, "l-lead", "lead", in_window)
    # outside the window → excluded entirely
    _lead(db, "l-old", "subscribed", out_window)
    # different funnel → excluded
    _lead(db, "l-other", "lead", in_window, funnel_id="funnel-2")
    db.commit()

    start = datetime(2026, 6, 1)
    end = datetime(2026, 6, 30)
    summary = FunnelAnalyticsService._lead_counts(db, FUNNEL_ID, start, end)

    assert summary.purchased == 1
    assert summary.subscribed == 1  # l-sub (l-purchased became purchased)
    assert summary.lead == 2        # l-cheap + l-lead
    assert summary.total == 4
