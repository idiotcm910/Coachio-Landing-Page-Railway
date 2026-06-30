"""Gift audience resolution (task 4.6): earliest-N + window, dedupe-before-limit,
exclude>include, already-granted exclusion + preview, and advanced filters
(amount / utm). The has_account filter is dropped — DST has no User model so
gift_audience_service always returns an empty accounts set.

Ported to coachio-landing-page: User.__table__ removed from TABLES,
test_has_account_filter dropped (always-empty in DST).
"""
from datetime import datetime

import pytest
from sqlalchemy import StaticPool, create_engine
from sqlalchemy.orm import sessionmaker

from app.models.funnel import Funnel
from app.models.funnel_order import FunnelOrder
from app.models.gift import Gift
from app.models.gift_grant import GiftGrant
from app.models.lead import Lead
from app.models.product import Product
from app.schemas.gift import GiftAudienceConfig
from app.services import gift_audience_service as aud

engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
TABLES = [
    Product.__table__, Funnel.__table__, Lead.__table__,
    FunnelOrder.__table__, Gift.__table__, GiftGrant.__table__,
]


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


def _funnel(db, fid="f1"):
    p = Product(id=f"p-{fid}", name="P", slug=f"p-{fid}", type="course", created_by="admin")
    db.add(p)
    db.flush()
    f = Funnel(id=fid, title="F", slug=fid, status="live", product_id=p.id, created_by="admin")
    db.add(f)
    db.commit()
    return f


def _lead(db, funnel_id, email, *, created_at, status="lead", meta=None):
    l = Lead(email=email, source_funnel_id=funnel_id, status=status, created_at=created_at, meta=meta)
    db.add(l)
    db.commit()
    return l


def _order(db, lead, *, amount=100000, paid_at=None):
    o = FunnelOrder(
        funnel_id=lead.source_funnel_id, lead_id=lead.id, order_code=f"SEP{lead.id[:9]}",
        final_amount=amount, status="SUCCESS", funnel_title="F", funnel_slug="f",
        product_name="P", buyer_email=lead.email, paid_at=paid_at or datetime(2026, 1, 1),
    )
    db.add(o)
    db.commit()
    return o


def _cfg(**kw):
    return GiftAudienceConfig(**kw)


def test_earliest_purchasers_with_limit(db):
    _funnel(db)
    for i in range(5):
        l = _lead(db, "f1", f"u{i}@x.com", created_at=datetime(2026, 1, 1 + i))
        _order(db, l)
    out = aud.resolve_recipients(db, ["gift1"], _cfg(funnel_ids=["f1"], status="purchased",
                                                    order_by="earliest_reg", limit=3))
    assert [r["email"] for r in out] == ["u0@x.com", "u1@x.com", "u2@x.com"]


def test_registration_window(db):
    _funnel(db)
    for i in range(5):
        l = _lead(db, "f1", f"u{i}@x.com", created_at=datetime(2026, 1, 1 + i))
        _order(db, l)
    out = aud.resolve_recipients(db, ["g"], _cfg(
        funnel_ids=["f1"], status="purchased", date_field="registration",
        date_from=datetime(2026, 1, 2), date_to=datetime(2026, 1, 4), order_by="earliest_reg"))
    assert [r["email"] for r in out] == ["u1@x.com", "u2@x.com", "u3@x.com"]


def test_dedupe_before_limit_across_funnels(db):
    _funnel(db, "f1")
    _funnel(db, "f2")
    l1 = _lead(db, "f1", "same@x.com", created_at=datetime(2026, 1, 1))
    _order(db, l1)
    l2 = _lead(db, "f2", "same@x.com", created_at=datetime(2026, 1, 2))
    _order(db, l2)
    out = aud.resolve_recipients(db, ["g"], _cfg(funnel_ids=["f1", "f2"], status="purchased", limit=5))
    assert len(out) == 1 and out[0]["email"] == "same@x.com"


def test_exclude_overrides_include(db):
    _funnel(db)
    out = aud.resolve_recipients(db, ["g"], _cfg(
        funnel_ids=["f1"], include_emails=["a@x.com"], exclude_emails=["a@x.com"]))
    assert all(r["email"] != "a@x.com" for r in out)


def test_already_granted_excluded_and_preview(db):
    _funnel(db)
    for i in range(3):
        l = _lead(db, "f1", f"u{i}@x.com", created_at=datetime(2026, 1, 1 + i))
        _order(db, l)
    db.add(GiftGrant(gift_id="g", email="u1@x.com", status="granted", email_status="sent"))
    db.commit()
    cfg = _cfg(funnel_ids=["f1"], status="purchased", exclude_already_granted=True)
    out = aud.resolve_recipients(db, ["g"], cfg)
    assert "u1@x.com" not in [r["email"] for r in out]
    pv = aud.preview(db, ["g"], cfg)
    assert pv["matched"] == 3 and pv["already_granted"] == 1 and pv["will_receive"] == 2
    # sample = the recipients who will actually receive (u1 excluded)
    assert {s["email"] for s in pv["sample"]} == {"u0@x.com", "u2@x.com"}


def test_amount_filter(db):
    _funnel(db)
    l1 = _lead(db, "f1", "small@x.com", created_at=datetime(2026, 1, 1))
    _order(db, l1, amount=50000)
    l2 = _lead(db, "f1", "big@x.com", created_at=datetime(2026, 1, 2))
    _order(db, l2, amount=500000)
    out = aud.resolve_recipients(db, ["g"], _cfg(funnel_ids=["f1"], status="purchased", amount_min=100000))
    assert [r["email"] for r in out] == ["big@x.com"]


def test_utm_filter(db):
    _funnel(db)
    _lead(db, "f1", "fb@x.com", created_at=datetime(2026, 1, 1), status="subscribed", meta={"utm_source": "facebook"})
    _lead(db, "f1", "goog@x.com", created_at=datetime(2026, 1, 2), status="subscribed", meta={"utm_source": "google"})
    out = aud.resolve_recipients(db, ["g"], _cfg(funnel_ids=["f1"], status="subscribed", utm_source="facebook"))
    assert [r["email"] for r in out] == ["fb@x.com"]
