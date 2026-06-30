"""Gift fulfilment core (external delivery only): idempotent dedupe ledger,
N-gifts→one-email, and grant-survives-email-failure. Resend mocked. SQLite in-memory.

Ported to coachio-landing-page (external-gift only build):
- User and Transaction tables removed (no internal perks)
- Dropped: test_new_buyer_gets_account_and_perks, test_existing_account_additive,
  test_already_unlocked_still_adds_credits, test_perk_phase_error_does_not_poison_session
  (all require User model / resolve_or_create_buyer which don't exist in DST)
- Kept: test_duplicate_same_gift_skips, test_multiple_gifts_one_email,
  test_email_failure_keeps_grant (trimmed: no User.credits assertions)
"""
from unittest.mock import patch

import pytest
from sqlalchemy import StaticPool, create_engine
from sqlalchemy.orm import sessionmaker

from app.models.gift import Gift
from app.models.gift_grant import GiftGrant
from app.services import gift_fulfilment_service as svc

engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
TABLES = [Gift.__table__, GiftGrant.__table__]

_SUBJECT = "Your gift"
_HTML = "<p>Hi {{recipient_name}}</p>"


@pytest.fixture(autouse=True)
def _mock_resend():
    with patch("app.services.gift_fulfilment_service.resend.Emails.send", return_value={"id": "1"}) as m:
        yield m


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


def _gift(db, *, name="G", external=None):
    g = Gift(
        name=name,
        internal_config={},
        external_items=external or [{"label": "Ebook", "url": "https://x/ebook"}],
    )
    db.add(g)
    db.commit()
    return g


def _deliver(db, gifts, email, **kw):
    return svc.deliver_gifts(
        db, gifts=gifts, email=email, email_subject=_SUBJECT, email_html=_HTML,
        background_tasks=None, **kw
    )


def test_duplicate_same_gift_skips(db):
    """Second delivery to same email (case-insensitive) is skipped — dedupe ledger works."""
    g = _gift(db)
    r1 = _deliver(db, [g], "dup@example.com")
    db.commit()
    r2 = _deliver(db, [g], "DUP@example.com")
    db.commit()
    assert r1["granted_any"] is True and r2["granted_any"] is False
    # Only one ledger row regardless of case
    assert db.query(GiftGrant).filter(GiftGrant.email == "dup@example.com").count() == 1


def test_multiple_gifts_one_email(db, _mock_resend):
    """N gifts bundled into one delivery → N grant rows but exactly ONE gift email."""
    g1 = _gift(db, name="G1")
    g2 = _gift(db, name="G2")
    res = _deliver(db, [g1, g2], "stack@example.com")
    db.commit()
    assert res["granted_count"] == 2
    assert db.query(GiftGrant).filter(GiftGrant.email == "stack@example.com").count() == 2
    # Exactly ONE gift email for both gifts
    gift_emails = [c for c in _mock_resend.call_args_list if c[0][0]["subject"] == _SUBJECT]
    assert len(gift_emails) == 1


def test_email_failure_keeps_grant(db):
    """Email send error → grant row persists with email_status='failed'."""
    g = _gift(db)
    with patch("app.services.gift_fulfilment_service.resend.Emails.send", side_effect=Exception("boom")):
        _deliver(db, [g], "mailfail@example.com")
        db.commit()
    grant = db.query(GiftGrant).filter(GiftGrant.email == "mailfail@example.com").first()
    assert grant is not None
    assert grant.email_status == "failed"
    assert "boom" in (grant.email_error or "")
