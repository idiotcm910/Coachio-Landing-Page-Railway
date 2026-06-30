"""Auto-trigger gift delivery (task 3.5): delivery on trigger, no-automation no-op,
max_total_grants cap, and slot-release when a re-qualifying recipient is already
granted. Resend is mocked module-wide (the inline path sends the email).

Ported to coachio-landing-page:
- User and Transaction tables removed (no internal perks in DST)
- test_delivered_on_trigger: drops user.credits assertion (no User model)
- test_trigger_survives_perk_phase_error: dropped (patches resolve_or_create_buyer
  which doesn't exist in DST gift_fulfilment_service)
"""
from unittest.mock import patch

import pytest
from sqlalchemy import StaticPool, create_engine
from sqlalchemy.orm import sessionmaker

from app.models.gift import Gift
from app.models.gift_automation import GiftAutomation
from app.models.gift_grant import GiftGrant
from app.services import gift_automation_service as auto

engine = create_engine(
    "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
TABLES = [
    Gift.__table__,
    GiftGrant.__table__,
    GiftAutomation.__table__,
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


def _gift(db, name="G"):
    g = Gift(
        name=name,
        internal_config={},
        external_items=[{"label": "Ebook", "url": "https://x/ebook"}],
    )
    db.add(g)
    db.commit()
    return g


def _automation(db, gift, funnel_id="f1", status="purchased", cap=None):
    a = GiftAutomation(
        gift_ids=[gift.id], funnel_id=funnel_id, trigger_status=status, is_active=True,
        max_total_grants=cap, email_subject="Quà tặng", email_html="<p>Xin chào</p>",
    )
    db.add(a)
    db.commit()
    return a


def test_delivered_on_trigger(db):
    g = _gift(db)
    a = _automation(db, g)
    auto.trigger(db, funnel_id="f1", trigger_status="purchased", email="buyer@x.com", source="order:1")
    db.commit()
    # Grant ledger row created for the recipient
    assert db.query(GiftGrant).filter(GiftGrant.email == "buyer@x.com").count() == 1
    db.refresh(a)
    assert a.grants_count == 1


def test_no_automation_noop(db):
    auto.trigger(db, funnel_id="f1", trigger_status="purchased", email="nobody@x.com", source="order:1")
    db.commit()
    assert db.query(GiftGrant).count() == 0


def test_all_funnels_automation_matches_any(db):
    g = _gift(db)
    _automation(db, g, funnel_id=None)  # all funnels
    auto.trigger(db, funnel_id="other-funnel", trigger_status="purchased", email="a@x.com", source="order:1")
    db.commit()
    assert db.query(GiftGrant).filter(GiftGrant.email == "a@x.com").count() == 1


def test_cap_stops_at_n(db):
    g = _gift(db)
    a = _automation(db, g, cap=2)
    for em in ["a@x.com", "b@x.com", "c@x.com"]:
        auto.trigger(db, funnel_id="f1", trigger_status="purchased", email=em, source="order:1")
        db.commit()
    assert db.query(GiftGrant).count() == 2
    db.refresh(a)
    assert a.grants_count == 2  # third skipped, cap not exceeded


def test_already_granted_releases_slot(db):
    g = _gift(db)
    a = _automation(db, g, cap=2)
    # Same email twice → second is already-granted and must NOT consume a slot.
    auto.trigger(db, funnel_id="f1", trigger_status="purchased", email="a@x.com", source="order:1")
    db.commit()
    auto.trigger(db, funnel_id="f1", trigger_status="purchased", email="A@x.com", source="order:2")
    db.commit()
    db.refresh(a)
    assert a.grants_count == 1  # slot released
    # Two more distinct recipients: one fits the remaining slot, one is capped.
    auto.trigger(db, funnel_id="f1", trigger_status="purchased", email="b@x.com", source="order:3")
    db.commit()
    auto.trigger(db, funnel_id="f1", trigger_status="purchased", email="c@x.com", source="order:4")
    db.commit()
    assert db.query(GiftGrant).count() == 2  # a + b only
    db.refresh(a)
    assert a.grants_count == 2
