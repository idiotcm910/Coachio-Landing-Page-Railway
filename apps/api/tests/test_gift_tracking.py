"""Gift grant tracking (task 8.8): filter by gift, bulk-retry failed.
Resend mocked.

Ported to coachio-landing-page:
- User table removed (no User model in DST)
- Dropped: test_stats_reflect_filter (used credits_granted + content filter absent in DST stats())
- Dropped: test_detail_contents (used user_id, credits_granted, current_credit_balance,
  new_account_created — none exist in DST GiftGrant)
- Dropped: test_resend_no_regrant (used User model to check credits unchanged)
- Dropped: test_new_account_filter (new_account_created absent from DST GiftGrant)
- Kept: test_list_filter_by_gift, test_bulk_retry_failed
"""
from unittest.mock import patch

import pytest
from sqlalchemy import StaticPool, create_engine
from sqlalchemy.orm import sessionmaker

from app.models.funnel import Funnel
from app.models.funnel_order import FunnelOrder
from app.models.gift import Gift
from app.models.gift_campaign import GiftCampaign
from app.models.gift_grant import GiftGrant
from app.models.lead import Lead
from app.models.product import Product
from app.services import gift_grant_tracking_service as svc

engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
TABLES = [
    Product.__table__, Funnel.__table__, Lead.__table__, FunnelOrder.__table__,
    Gift.__table__, GiftGrant.__table__, GiftCampaign.__table__,
]


@pytest.fixture(autouse=True)
def _mock_resend():
    with patch("app.services.gift_fulfilment_service.resend.Emails.send", return_value={"id": "1"}):
        yield


@pytest.fixture()
def db():
    for t in reversed(TABLES):
        t.drop(bind=engine, checkfirst=True)
    for t in TABLES:
        t.create(bind=engine, checkfirst=True)
    s = TestingSessionLocal()
    try:
        yield s
    finally:
        s.close()


def _gift(db, gid, name="G"):
    g = Gift(id=gid, name=name, internal_config={}, external_items=[])
    db.add(g)
    db.commit()
    return g


def _grant(db, gift_id, email, **kw):
    g = GiftGrant(gift_id=gift_id, email=email, status="granted",
                  email_status=kw.pop("email_status", "sent"), **kw)
    db.add(g)
    db.commit()
    return g


def test_list_filter_by_gift(db):
    _gift(db, "A")
    _gift(db, "B")
    _grant(db, "A", "a1@x.com")
    _grant(db, "A", "a2@x.com")
    _grant(db, "B", "b1@x.com")
    out = svc.list_grants(db, gift_id="A")
    assert out["total"] == 2
    assert {i["email"] for i in out["items"]} == {"a1@x.com", "a2@x.com"}
    assert out["items"][0]["gift_name"] == "G"


def test_bulk_retry_failed(db):
    _gift(db, "A")
    _grant(db, "A", "f1@x.com", email_status="failed", source="order:o1")
    _grant(db, "A", "f2@x.com", email_status="failed", source="order:o2")
    _grant(db, "A", "ok@x.com", email_status="sent")
    res = svc.bulk_retry_failed(db, gift_id="A")
    assert res == {"resent": 2, "failed": 0}
    assert db.query(GiftGrant).filter(GiftGrant.email_status == "sent").count() == 3
