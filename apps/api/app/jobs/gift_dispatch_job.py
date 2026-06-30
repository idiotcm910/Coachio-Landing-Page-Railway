"""Background worker draining gift campaigns (mechanism 2) + retrying failed
auto-grant emails. Mirrors the broadcast dispatcher.

Recipients are frozen into gift_send_jobs at CONFIRM time, so this worker does
NOT materialize — each tick:
 1. promote due scheduled campaigns -> sending (atomic guard)
 2. reaper: requeue jobs stuck in 'sending' past claimed_at + timeout
 3. claim a batch of pending jobs (FOR UPDATE SKIP LOCKED on Postgres) -> process
 4. complete campaigns whose jobs are all done
 5. retry failed AUTO-grant emails (ledger email_status='failed', bounded)

Resume-safe across restart: all state in DB. Retries never re-grant perks.
"""
import asyncio
import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import or_

from app.core.config import settings
from app.db.base import SessionLocal
from app.models.gift_campaign import GiftCampaign
from app.models.gift_grant import GiftGrant
from app.models.gift_send_job import GiftSendJob
from app.services.gift_campaign_service import mark_completed_if_done, process_jobs
from app.services.gift_fulfilment_service import send_delivery_email

logger = logging.getLogger(__name__)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _is_postgres(db) -> bool:
    try:
        return db.get_bind().dialect.name == "postgresql"
    except Exception:
        return False


def promote_due_scheduled(db, *, now: datetime | None = None) -> int:
    now = now or _now()
    due = (
        db.query(GiftCampaign)
        .filter(
            GiftCampaign.status == "scheduled",
            GiftCampaign.scheduled_at.isnot(None),
            GiftCampaign.scheduled_at <= now,
        )
        .all()
    )
    promoted = 0
    for c in due:
        rows = (
            db.query(GiftCampaign)
            .filter(GiftCampaign.id == c.id, GiftCampaign.status == "scheduled")
            .update({"status": "sending", "started_at": now, "scheduled_at": None}, synchronize_session="fetch")
        )
        if rows == 1:
            promoted += 1
    if promoted:
        db.commit()
    return promoted


def reap_stuck_jobs(db, *, timeout_s: int, max_attempts: int, now: datetime | None = None) -> int:
    now = now or _now()
    cutoff = now - timedelta(seconds=timeout_s)
    stuck = (
        db.query(GiftSendJob)
        .filter(
            GiftSendJob.status == "sending",
            GiftSendJob.claimed_at.isnot(None),
            GiftSendJob.claimed_at < cutoff,
        )
        .all()
    )
    if not stuck:
        return 0
    for job in stuck:
        if (job.attempts or 0) >= max_attempts:
            job.status = "failed"
            job.error = "Exceeded max attempts (stuck)"
        else:
            job.status = "pending"
            job.claimed_at = None
    db.commit()
    return len(stuck)


def _claim_batch(db, campaign_id: str, batch_size: int) -> list[GiftSendJob]:
    base = (
        db.query(GiftSendJob)
        .filter(GiftSendJob.campaign_id == campaign_id, GiftSendJob.status == "pending")
        .order_by(GiftSendJob.created_at)
        .limit(batch_size)
    )
    if _is_postgres(db):
        base = base.with_for_update(skip_locked=True)
    jobs = base.all()
    if jobs:
        now = _now()
        for j in jobs:
            j.status = "sending"
            j.claimed_at = now
        db.commit()
    return jobs


def process_sending_campaigns(db, *, batch_size: int) -> int:
    campaigns = db.query(GiftCampaign).filter(GiftCampaign.status == "sending").all()
    processed = 0
    for c in campaigns:
        jobs = _claim_batch(db, c.id, batch_size)
        if jobs:
            process_jobs(db, c, jobs)
            processed += len(jobs)
        mark_completed_if_done(db, c)
    return processed


def retry_failed_grant_emails(db, *, max_attempts: int, limit: int) -> int:
    """Re-send failed AUTO-grant delivery emails (campaign jobs retry via the job queue).

    Groups failed grants by (source, email) so one combined email is re-sent per
    delivery, using the snapshotted template. Never re-grants perks.
    """
    rows = (
        db.query(GiftGrant)
        .filter(
            GiftGrant.email_status == "failed",
            GiftGrant.resend_count < max_attempts,
            or_(GiftGrant.source.is_(None), ~GiftGrant.source.like("campaign:%")),
        )
        .limit(limit)
        .all()
    )
    seen: set = set()
    groups = 0
    for g in rows:
        key = (g.source, g.email)
        if key in seen:
            continue
        seen.add(key)
        siblings = (
            db.query(GiftGrant)
            .filter(GiftGrant.source == g.source, GiftGrant.email == g.email)
            .all()
        )
        send_delivery_email(
            [s.id for s in siblings],
            email_subject=g.email_subject_snapshot or "",
            email_html=g.email_html_snapshot or "",
            db=db,
        )
        now = _now()
        for s in siblings:
            s.resend_count = (s.resend_count or 0) + 1
            s.last_resend_at = now
        db.commit()
        groups += 1
    return groups


def run_once(db, *, batch_size: int, max_attempts: int, stuck_timeout_s: int) -> dict:
    promoted = promote_due_scheduled(db)
    reaped = reap_stuck_jobs(db, timeout_s=stuck_timeout_s, max_attempts=max_attempts)
    processed = process_sending_campaigns(db, batch_size=batch_size)
    retried = retry_failed_grant_emails(db, max_attempts=max_attempts, limit=batch_size)
    return {"promoted": promoted, "reaped": reaped, "processed": processed, "retried": retried}


def run_once_in_session(*, batch_size: int, max_attempts: int, stuck_timeout_s: int) -> dict:
    db = SessionLocal()
    try:
        return run_once(db, batch_size=batch_size, max_attempts=max_attempts, stuck_timeout_s=stuck_timeout_s)
    finally:
        db.close()


async def start_gift_job() -> None:
    """Async background loop — register in FastAPI lifespan via asyncio.create_task()."""
    interval = settings.GIFT_JOB_INTERVAL_SECONDS
    delay_s = settings.GIFT_RATE_DELAY_MS / 1000.0
    logger.info("Gift dispatch job started (interval=%ds)", interval)
    try:
        while True:
            try:
                result = await asyncio.to_thread(
                    run_once_in_session,
                    batch_size=settings.GIFT_BATCH_SIZE,
                    max_attempts=settings.GIFT_MAX_ATTEMPTS,
                    stuck_timeout_s=settings.GIFT_STUCK_TIMEOUT_S,
                )
                if result["processed"]:
                    await asyncio.sleep(delay_s)
            except Exception as exc:  # noqa: BLE001 — loop must never die
                logger.error("Gift job iteration error: %s", exc)
            await asyncio.sleep(interval)
    except asyncio.CancelledError:
        logger.info("Gift dispatch job cancelled — shutting down")
        raise
