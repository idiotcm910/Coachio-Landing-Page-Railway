"""Phase 05 — worker tick: promote/dispatch/reaper/process/complete (SQLite)."""
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

import pytest
from sqlalchemy import StaticPool, create_engine
from sqlalchemy.orm import sessionmaker

from app.jobs import broadcast_dispatch_job as worker
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


def _campaign_with_leads(db, n=2, scheduled_at=None, status="sending"):
    p = Product(name="P", slug="p", base_price=100, type="course", created_by="admin")
    db.add(p)
    db.flush()
    f = Funnel(product_id=p.id, title="F", slug="f", status="published", created_by="admin")
    db.add(f)
    db.flush()
    for i in range(n):
        db.add(Lead(email=f"u{i}@x.com", name=f"U{i}", source_funnel_id=f.id))
    db.flush()
    c = svc.create_campaign(
        db,
        origin="admin",
        funnel_id=None,
        payload=BroadcastCampaignCreate(
            title="T",
            subject="S",
            html_body="<p>hi</p>",
            audience_config=AudienceConfig(funnel_ids=[f.id]),
        ),
        created_by=None,
    )
    c.status = status
    c.scheduled_at = scheduled_at
    db.commit()
    return c


def test_promote_due_scheduled(db):
    past = datetime.now(timezone.utc) - timedelta(minutes=1)
    c = _campaign_with_leads(db, scheduled_at=past, status="scheduled")
    assert worker.promote_due_scheduled(db) == 1
    db.refresh(c)
    assert c.status == "sending"


def test_full_tick_sends_and_completes(db):
    c = _campaign_with_leads(db, n=2, status="sending")
    with patch("app.jobs.broadcast_dispatch_job.send_pending_batch") as send:

        def _mark_sent(db_, campaign, jobs):
            for j in jobs:
                j.status = "sent"
            db_.commit()

        send.side_effect = _mark_sent
        worker.run_once(db, batch_size=100, max_attempts=3, stuck_timeout_s=300)
    db.refresh(c)
    assert c.status == "completed"
    assert db.query(BroadcastSendJob).filter_by(campaign_id=c.id, status="sent").count() == 2


def test_reaper_requeues_stuck(db):
    c = _campaign_with_leads(db, n=1, status="sending")
    svc.dispatch(db, c)
    job = db.query(BroadcastSendJob).filter_by(campaign_id=c.id).first()
    job.status = "sending"
    job.attempts = 1
    job.claimed_at = datetime.now(timezone.utc) - timedelta(seconds=999)
    db.commit()
    assert worker.reap_stuck_jobs(db, timeout_s=300, max_attempts=3) == 1
    db.refresh(job)
    assert job.status == "pending"


def test_reaper_fails_stuck_at_max_attempts(db):
    """Stuck job at max_attempts must be marked failed, not requeued (I-2)."""
    c = _campaign_with_leads(db, n=2, status="sending")
    svc.dispatch(db, c)
    jobs = db.query(BroadcastSendJob).filter_by(campaign_id=c.id).all()
    old_claimed = datetime.now(timezone.utc) - timedelta(seconds=999)
    jobs[0].status = "sending"
    jobs[0].attempts = 3
    jobs[0].claimed_at = old_claimed
    jobs[1].status = "sending"
    jobs[1].attempts = 1
    jobs[1].claimed_at = old_claimed
    db.commit()
    reaped = worker.reap_stuck_jobs(db, timeout_s=300, max_attempts=3)
    assert reaped == 2
    db.refresh(jobs[0])
    db.refresh(jobs[1])
    assert jobs[0].status == "failed"
    assert "Exceeded max attempts" in (jobs[0].error or "")
    assert jobs[1].status == "pending"


def test_promote_future_scheduled_not_promoted(db):
    future = datetime.now(timezone.utc) + timedelta(hours=1)
    c = _campaign_with_leads(db, scheduled_at=future, status="scheduled")
    promoted = worker.promote_due_scheduled(db)
    assert promoted == 0
    db.refresh(c)
    assert c.status == "scheduled"


def test_dispatch_new_sending_materializes_jobs(db):
    c = _campaign_with_leads(db, n=2, status="sending")
    count_before = db.query(BroadcastSendJob).filter_by(campaign_id=c.id).count()
    assert count_before == 0
    dispatched = worker.dispatch_new_sending(db)
    assert dispatched == 1
    count_after = db.query(BroadcastSendJob).filter_by(campaign_id=c.id).count()
    assert count_after == 2


def test_run_once_returns_stats_dict(db):
    c = _campaign_with_leads(db, n=1, status="sending")
    with patch("app.jobs.broadcast_dispatch_job.send_pending_batch") as send:

        def _mark_sent(db_, campaign, jobs):
            for j in jobs:
                j.status = "sent"
            db_.commit()

        send.side_effect = _mark_sent
        result = worker.run_once(db, batch_size=100, max_attempts=3, stuck_timeout_s=300)
    assert isinstance(result, dict)
    assert "promoted" in result
    assert "dispatched" in result
    assert "reaped" in result
    assert "sent" in result
