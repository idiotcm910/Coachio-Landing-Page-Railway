"""Phase 03 — campaign service dispatch/cancel/retry/stats (in-memory SQLite)."""
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import create_engine, StaticPool
from sqlalchemy.orm import sessionmaker

from app.models.broadcast_campaign import BroadcastCampaign
from app.models.broadcast_send_job import BroadcastSendJob
from app.models.funnel import Funnel
from app.models.lead import Lead
from app.models.product import Product
from app.schemas.broadcast import AudienceConfig, BroadcastCampaignCreate
from app.services import broadcast_campaign_service as svc

engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
TABLES = [
    Product.__table__,
    Funnel.__table__,
    Lead.__table__,
    BroadcastCampaign.__table__,
    BroadcastSendJob.__table__,
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


def _funnel_with_leads(db, n=3, slug="p"):
    p = Product(name="P", slug=slug, base_price=100, type="course", created_by="admin")
    db.add(p)
    db.flush()
    f = Funnel(product_id=p.id, title="F", slug=slug, status="published", created_by="admin")
    db.add(f)
    db.flush()
    for i in range(n):
        db.add(Lead(email=f"u{i}@x.com", name=f"U{i}", source_funnel_id=f.id))
    db.commit()
    return f


def _new_campaign(db, funnel):
    payload = BroadcastCampaignCreate(
        title="T",
        subject="S {{name}}",
        html_body="<p>Hi {{name}}</p>",
        audience_config=AudienceConfig(funnel_ids=[funnel.id]),
    )
    return svc.create_campaign(db, origin="admin", funnel_id=None, payload=payload, created_by=None)


def test_dispatch_materializes_jobs(db):
    f = _funnel_with_leads(db, n=3)
    c = _new_campaign(db, f)
    inserted = svc.dispatch(db, c)
    assert inserted == 3
    assert c.total_recipients == 3
    assert db.query(BroadcastSendJob).filter_by(campaign_id=c.id).count() == 3


def test_dispatch_is_idempotent(db):
    f = _funnel_with_leads(db, n=3)
    c = _new_campaign(db, f)
    svc.dispatch(db, c)
    assert svc.dispatch(db, c) == 0  # second run inserts nothing
    assert db.query(BroadcastSendJob).filter_by(campaign_id=c.id).count() == 3


def test_dispatch_empty_audience_fails(db):
    p = Product(name="P2", slug="p2", base_price=100, type="course", created_by="admin")
    db.add(p)
    db.flush()
    f = Funnel(product_id=p.id, title="F2", slug="f2", status="published", created_by="admin")
    db.add(f)
    db.commit()
    c = _new_campaign(db, f)
    svc.dispatch(db, c)
    assert c.status == "failed"
    assert "rỗng" in (c.last_error or "")


def test_retry_failed_requeues(db):
    f = _funnel_with_leads(db, n=2)
    c = _new_campaign(db, f)
    svc.dispatch(db, c)
    jobs = db.query(BroadcastSendJob).filter_by(campaign_id=c.id).all()
    jobs[0].status = "failed"
    jobs[0].error = "boom"
    jobs[1].status = "sent"
    c.status = "completed"
    c.failed_count = 1
    c.sent_count = 1
    db.commit()
    requeued = svc.retry_failed(db, c)
    assert requeued == 1
    assert c.status == "sending" and c.last_error is None
    assert db.query(BroadcastSendJob).filter_by(campaign_id=c.id, status="pending").count() == 1


def test_cancel_skips_pending(db):
    f = _funnel_with_leads(db, n=2)
    c = _new_campaign(db, f)
    svc.dispatch(db, c)
    svc.cancel(db, c)
    assert c.status == "cancelled"
    assert db.query(BroadcastSendJob).filter_by(campaign_id=c.id, status="skipped").count() == 2


def test_stats_counts(db):
    f = _funnel_with_leads(db, n=3)
    c = _new_campaign(db, f)
    svc.dispatch(db, c)
    jobs = db.query(BroadcastSendJob).filter_by(campaign_id=c.id).all()
    jobs[0].status = "sent"
    jobs[1].status = "failed"
    jobs[1].error = "x"
    db.commit()
    st = svc.stats(db, c)
    assert st.total == 3 and st.sent == 1 and st.failed == 1 and st.pending == 1
    assert st.failed_total == 1 and len(st.failed_jobs) == 1
