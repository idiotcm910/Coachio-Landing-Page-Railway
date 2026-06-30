"""Phase 04 — render order (sanitize->tokens), per-email send, error capture.

Resend is fully mocked. Tests assert:
- sanitize_email_html is applied BEFORE token substitution (D13 ordering)
- successful send -> jobs.status = 'sent', jobs.sent_at populated
- per-email failure -> only the offending job 'failed' (attempts incremented,
  job.error set, campaign.last_error set); other jobs still 'sent'; no exception
  escapes caller
"""
from unittest.mock import patch

import pytest
from sqlalchemy import create_engine, StaticPool
from sqlalchemy.orm import sessionmaker

from app.models.broadcast_campaign import BroadcastCampaign
from app.models.broadcast_send_job import BroadcastSendJob
from app.services import broadcast_sender as sender

engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
TABLES = [
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


def _campaign(db, origin="admin"):
    c = BroadcastCampaign(
        origin=origin,
        title="T",
        subject="Hi {{name}}",
        html_body="<p>Hello {{name}} <script>alert(1)</script>{{email}}</p>",
        status="sending",
    )
    db.add(c)
    db.commit()
    return c


def _jobs(db, campaign, emails):
    out = []
    for e in emails:
        j = BroadcastSendJob(
            campaign_id=campaign.id,
            email=e,
            name=e.split("@")[0],
            status="pending",
        )
        db.add(j)
        out.append(j)
    db.commit()
    return out


def test_render_strips_script_and_substitutes(db):
    """D13: sanitize (removes <script>) THEN substitute tokens."""
    c = _campaign(db)
    body, ctx = sender.build_base_context(db, c)
    assert "<script>" not in body
    subject, html = sender.render_for_recipient(
        body, c.subject, ctx, name="Bob", email="bob@x.com"
    )
    assert subject == "Hi Bob"
    assert "Hello Bob" in html
    assert "bob@x.com" in html
    assert "<script>" not in html


def test_batch_success_marks_sent(db):
    """When _send_one succeeds (no raise), all jobs become 'sent' with sent_at."""
    c = _campaign(db)
    jobs = _jobs(db, c, ["a@x.com", "b@x.com"])
    with patch.object(sender, "_send_one", return_value=None):
        sender.send_pending_batch(db, c, jobs)
    for j in jobs:
        db.refresh(j)
        assert j.status == "sent"
        assert j.sent_at is not None


def test_failure_marks_failed_and_campaign_last_error(db):
    """A send error -> job 'failed', attempts incremented, errors captured.
    The call to send_pending_batch must NOT raise.
    """
    c = _campaign(db)
    jobs = _jobs(db, c, ["a@x.com"])
    with patch.object(sender, "_send_one", side_effect=RuntimeError("Resend 401")):
        sender.send_pending_batch(db, c, jobs)
    db.refresh(jobs[0])
    db.refresh(c)
    assert jobs[0].status == "failed"
    assert jobs[0].attempts == 1
    assert "Resend 401" in (jobs[0].error or "")
    assert "Resend 401" in (c.last_error or "")


def test_one_bad_email_does_not_fail_the_rest(db):
    """A single invalid recipient fails ONLY its own job — the other
    jobs in the same chunk still send (no whole-batch poisoning)."""
    c = _campaign(db)
    jobs = _jobs(db, c, ["good1@x.com", "bad@x.com", "good2@x.com"])

    def fake_send_one(item):
        if "bad@x.com" in item["to"]:
            raise RuntimeError(
                "Invalid `to` field. The email address contains non-ASCII characters."
            )

    with patch.object(sender, "_send_one", side_effect=fake_send_one):
        sender.send_pending_batch(db, c, jobs)

    by_email = {}
    for j in jobs:
        db.refresh(j)
        by_email[j.email] = j
    assert by_email["good1@x.com"].status == "sent"
    assert by_email["good2@x.com"].status == "sent"
    assert by_email["bad@x.com"].status == "failed"
    assert by_email["bad@x.com"].attempts == 1
    assert by_email["good1@x.com"].sent_at is not None
    db.refresh(c)
    assert "non-ASCII" in (c.last_error or "")


def test_send_pending_batch_empty_jobs_is_noop(db):
    """Empty job list -> no exception, no DB writes."""
    c = _campaign(db)
    sender.send_pending_batch(db, c, [])  # must not raise
    db.refresh(c)
    assert c.last_error is None


def test_send_one_passes_idempotency_key_per_item(db):
    """_send_one is called once per job; each item carries idempotency_key=job.id."""
    c = _campaign(db)
    jobs = _jobs(db, c, ["z@x.com"])
    captured = []

    def fake_send_one(item):
        captured.append(item)

    with patch.object(sender, "_send_one", side_effect=fake_send_one):
        sender.send_pending_batch(db, c, jobs)

    assert len(captured) == 1
    assert captured[0]["idempotency_key"] == jobs[0].id
