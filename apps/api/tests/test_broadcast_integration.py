"""Phase 10 — end-to-end integration test for the broadcast pipeline.

Exercises the full happy path through SERVICE + WORKER layers using an
in-memory SQLite database. Resend is fully mocked — no real network calls.

Scenarios:
1. Admin campaign over 2 funnels w/ duplicate email → immediate send →
   worker ticks until completed → sent_count == deduped audience, no double job.
2. Failure path: _send_one raises on first tick → jobs→failed, campaign.last_error set,
   no exception escapes; retry_failed requeues → second worker tick drains → completed.
3. Deploy-safety: a job left stuck in 'sending' with old claimed_at is reaped→pending
   then sent on the next worker tick.
"""
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
from app.services import broadcast_sender as sender

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


def _make_funnel(db, slug, leads):
    """Create a product+funnel with given leads list [(email, name)]."""
    p = Product(name=f"P-{slug}", slug=slug, base_price=100, type="course", created_by="admin")
    db.add(p)
    db.flush()
    f = Funnel(product_id=p.id, title=f"F-{slug}", slug=slug, status="published", created_by="admin")
    db.add(f)
    db.flush()
    for email, name in leads:
        db.add(Lead(email=email, name=name, source_funnel_id=f.id))
    db.flush()
    return f


def _tick_until_complete(db, campaign, *, max_ticks=5):
    """Run worker.run_once until campaign.status == 'completed' or max_ticks exceeded."""
    for _ in range(max_ticks):
        worker.run_once(db, batch_size=100, max_attempts=3, stuck_timeout_s=300)
        db.refresh(campaign)
        if campaign.status == "completed":
            return True
    return False


# ---------------------------------------------------------------------------
# Scenario 1: happy path — dedup + send → completed
# ---------------------------------------------------------------------------


def test_integration_send_deduped_completes(db):
    """Two funnels share 'dup@x.com'; after send, only one job for that email."""
    f1 = _make_funnel(db, "f1", [("dup@x.com", "Dup"), ("a@x.com", "A")])
    f2 = _make_funnel(db, "f2", [("dup@x.com", "Dup"), ("b@x.com", "B")])
    db.commit()

    campaign = svc.create_campaign(
        db,
        origin="admin",
        funnel_id=None,
        payload=BroadcastCampaignCreate(
            title="Integration T",
            subject="Hi {{name}}",
            html_body="<p>Hello {{name}}</p>",
            audience_config=AudienceConfig(funnel_ids=[f1.id, f2.id]),
        ),
        created_by=None,
    )
    svc.schedule_or_send(db, campaign, scheduled_at=None)
    db.refresh(campaign)
    assert campaign.status == "sending"

    def _fake_send(db_, c, jobs):
        for j in jobs:
            j.status = "sent"
        db_.commit()

    with patch("app.jobs.broadcast_dispatch_job.send_pending_batch", side_effect=_fake_send):
        done = _tick_until_complete(db, campaign)

    assert done, f"Campaign did not complete; status={campaign.status}"
    assert campaign.status == "completed"

    # 3 unique emails: dup@x.com, a@x.com, b@x.com
    jobs = db.query(BroadcastSendJob).filter_by(campaign_id=campaign.id).all()
    emails = [j.email for j in jobs]
    assert len(emails) == 3, f"Expected 3 deduped jobs, got {len(emails)}: {emails}"
    assert len(set(emails)) == 3, "Duplicate job detected"
    assert all(j.status == "sent" for j in jobs)
    assert campaign.sent_count == 3


# ---------------------------------------------------------------------------
# Scenario 2: failure → retry → drain
# ---------------------------------------------------------------------------


def test_integration_failure_then_retry_drains(db):
    """First tick: _send_one raises → jobs failed, campaign.last_error set.
    retry_failed requeues → second tick with working sender → all sent, completed.
    """
    f = _make_funnel(db, "rf", [("x@x.com", "X"), ("y@x.com", "Y")])
    db.commit()

    campaign = svc.create_campaign(
        db,
        origin="admin",
        funnel_id=None,
        payload=BroadcastCampaignCreate(
            title="Retry T",
            subject="S",
            html_body="<p>hi</p>",
            audience_config=AudienceConfig(funnel_ids=[f.id]),
        ),
        created_by=None,
    )
    svc.schedule_or_send(db, campaign, scheduled_at=None)

    with patch.object(sender, "_send_one", side_effect=RuntimeError("Resend 503")):
        try:
            worker.run_once(db, batch_size=100, max_attempts=3, stuck_timeout_s=300)
        except Exception as exc:  # noqa: BLE001 — guard: run_once must never propagate
            pytest.fail(f"run_once must not propagate sender errors, got: {exc}")

    db.refresh(campaign)
    failed_jobs = db.query(BroadcastSendJob).filter_by(campaign_id=campaign.id, status="failed").all()
    assert len(failed_jobs) == 2
    assert campaign.last_error and "Resend 503" in campaign.last_error

    requeued = svc.retry_failed(db, campaign)
    assert requeued == 2

    def _fake_send(db_, c, jobs):
        for j in jobs:
            j.status = "sent"
        db_.commit()

    with patch("app.jobs.broadcast_dispatch_job.send_pending_batch", side_effect=_fake_send):
        done = _tick_until_complete(db, campaign)

    assert done, f"Campaign did not complete after retry; status={campaign.status}"
    assert campaign.status == "completed"
    all_jobs = db.query(BroadcastSendJob).filter_by(campaign_id=campaign.id).all()
    assert all(j.status == "sent" for j in all_jobs)


# ---------------------------------------------------------------------------
# Scenario 3: deploy-safety — stuck 'sending' job reaped → pending → sent
# ---------------------------------------------------------------------------


def test_integration_reaper_unblocks_stuck_job(db):
    """A job stuck in 'sending' with old claimed_at is reaped to 'pending' then
    processed to 'sent' on the next worker tick.
    """
    f = _make_funnel(db, "stuck", [("stuck@x.com", "S")])
    db.commit()

    campaign = svc.create_campaign(
        db,
        origin="admin",
        funnel_id=None,
        payload=BroadcastCampaignCreate(
            title="Stuck T",
            subject="S",
            html_body="<p>hi</p>",
            audience_config=AudienceConfig(funnel_ids=[f.id]),
        ),
        created_by=None,
    )
    svc.schedule_or_send(db, campaign, scheduled_at=None)
    svc.dispatch(db, campaign)
    job = db.query(BroadcastSendJob).filter_by(campaign_id=campaign.id).first()
    job.status = "sending"
    job.claimed_at = datetime.now(timezone.utc) - timedelta(seconds=999)
    db.commit()

    def _fake_send(db_, c, jobs):
        for j in jobs:
            j.status = "sent"
        db_.commit()

    with patch("app.jobs.broadcast_dispatch_job.send_pending_batch", side_effect=_fake_send):
        worker.run_once(db, batch_size=100, max_attempts=3, stuck_timeout_s=300)

    db.refresh(job)
    db.refresh(campaign)
    assert job.status == "sent", f"Expected sent, got {job.status}"
    assert campaign.status == "completed"
