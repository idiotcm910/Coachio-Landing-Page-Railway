"""Gift campaign + worker (task 5.6): confirm freezes snapshot, worker grants +
emails, cancel skips pending, retry re-sends without re-granting, stats counts.
Resend mocked. SQLite in-memory.

Ported to coachio-landing-page:
- User and Transaction tables removed (no internal perks in DST)
- test_worker_processes_and_grants: dropped (asserted user.credits which requires User model)
- test_retry_failed_no_regrant: dropped (asserted user.credits which requires User model)
"""
from datetime import datetime
from unittest.mock import patch

import pytest
from sqlalchemy import StaticPool, create_engine
from sqlalchemy.orm import sessionmaker

from app.jobs import gift_dispatch_job as worker
from app.models.funnel import Funnel
from app.models.funnel_order import FunnelOrder
from app.models.gift import Gift
from app.models.gift_campaign import GiftCampaign
from app.models.gift_grant import GiftGrant
from app.models.gift_send_job import GiftSendJob
from app.models.lead import Lead
from app.models.product import Product
from app.schemas.gift import GiftAudienceConfig
from app.schemas.gift_campaign import GiftCampaignCreate
from app.services import gift_campaign_service as svc

engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
TABLES = [
    Product.__table__, Funnel.__table__, Lead.__table__, FunnelOrder.__table__,
    Gift.__table__, GiftGrant.__table__, GiftCampaign.__table__, GiftSendJob.__table__,
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


def _funnel(db, fid="f1"):
    p = Product(id=f"p-{fid}", name="P", slug=f"p-{fid}", type="course", created_by="admin")
    db.add(p)
    db.flush()
    db.add(Funnel(id=fid, title="F", slug=fid, status="live", product_id=p.id, created_by="admin"))
    db.commit()


def _purchaser(db, email, created_at):
    l = Lead(email=email, source_funnel_id="f1", status="lead", created_at=created_at)
    db.add(l)
    db.flush()
    db.add(FunnelOrder(funnel_id="f1", lead_id=l.id, order_code=f"SEP{l.id[:9]}", final_amount=100000,
                       status="SUCCESS", funnel_title="F", funnel_slug="f", product_name="P", buyer_email=email,
                       paid_at=datetime(2026, 1, 1)))
    db.commit()


def _gift(db):
    g = Gift(name="G", internal_config={},
             external_items=[{"label": "Ebook", "url": "https://x/ebook"}])
    db.add(g)
    db.commit()
    return g


def _campaign(db, gift, **cfg):
    return svc.create_campaign(
        db,
        payload=GiftCampaignCreate(
            name="C", gift_ids=[gift.id], email_subject="Quà tặng", email_html="<p>Xin chào</p>",
            audience_config=GiftAudienceConfig(funnel_ids=["f1"], status="purchased", **cfg),
        ),
        created_by="admin",
    )


def _run(db):
    return worker.run_once(db, batch_size=50, max_attempts=3, stuck_timeout_s=300)


def test_confirm_freezes_snapshot(db):
    _funnel(db)
    for i in range(3):
        _purchaser(db, f"u{i}@x.com", datetime(2026, 1, 1 + i))
    g = _gift(db)
    c = _campaign(db, g)
    n = svc.confirm(db, c)
    assert n == 3 and c.snapshot_at is not None
    assert db.query(GiftSendJob).filter(GiftSendJob.campaign_id == c.id).count() == 3
    # New purchaser after confirm must NOT change the frozen list (idempotent).
    _purchaser(db, "late@x.com", datetime(2026, 2, 1))
    assert svc.confirm(db, c) == 0
    assert db.query(GiftSendJob).filter(GiftSendJob.campaign_id == c.id).count() == 3


def test_cancel_skips_pending(db):
    _funnel(db)
    _purchaser(db, "a@x.com", datetime(2026, 1, 1))
    g = _gift(db)
    c = _campaign(db, g)
    svc.confirm(db, c)
    svc.cancel(db, c)
    db.refresh(c)
    assert c.status == "cancelled"
    assert db.query(GiftSendJob).filter(GiftSendJob.campaign_id == c.id, GiftSendJob.status == "skipped").count() == 1


def test_already_granted_recipient_skipped(db):
    _funnel(db)
    _purchaser(db, "dup@x.com", datetime(2026, 1, 1))
    _purchaser(db, "fresh@x.com", datetime(2026, 1, 2))
    g = _gift(db)
    # Pre-grant dup@ so the campaign should skip it.
    db.add(GiftGrant(gift_id=g.id, email="dup@x.com", status="granted", email_status="sent"))
    db.commit()
    c = _campaign(db, g, exclude_already_granted=False)  # include it so a job is created
    svc.schedule_or_send(db, c, None)
    _run(db)
    db.refresh(c)
    assert c.skipped_count == 1 and c.sent_count == 1
