"""Background worker driving broadcast campaigns (spec §4, §6).

Single asyncio loop in lifespan (mirrors start_expiry_job). Each tick:
 1. promote due scheduled campaigns -> sending (atomic: WHERE status='scheduled')
 2. dispatch sending campaigns with no jobs (materialize audience)
 3. reaper: requeue jobs stuck in 'sending' past claimed_at + timeout
 4. claim a batch of pending jobs (FOR UPDATE SKIP LOCKED on Postgres) -> send
 5. complete campaigns whose jobs are all done

Resume-safe across restart: all state in DB; idempotency_key=job.id; SKIP LOCKED.
Atomic campaign claim (Risk 1): promote_due_scheduled uses a guarded conditional
UPDATE (WHERE status='scheduled') so only ONE winner materializes a campaign even
during rolling-deploy overlaps.
"""
import asyncio
import logging
from datetime import datetime, timedelta, timezone

from app.core.config import settings
from app.db.base import SessionLocal
from app.models.broadcast_campaign import BroadcastCampaign
from app.models.broadcast_send_job import BroadcastSendJob
from app.services.broadcast_campaign_service import dispatch, mark_completed_if_done
from app.services.broadcast_sender import send_pending_batch

logger = logging.getLogger(__name__)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _is_postgres(db) -> bool:
    """Detect PostgreSQL dialect without relying on deprecated db.bind."""
    try:
        return db.get_bind().dialect.name == "postgresql"
    except Exception:
        return False


def promote_due_scheduled(db, *, now: datetime | None = None) -> int:
    """Atomically promote due scheduled campaigns to sending.

    Uses a per-row guarded update (WHERE status='scheduled') so that with
    overlapping worker instances (rolling deploy), only ONE worker wins the
    transition for a given campaign. Returns count of campaigns promoted.
    """
    now = now or _now()
    due = (
        db.query(BroadcastCampaign)
        .filter(
            BroadcastCampaign.status == "scheduled",
            BroadcastCampaign.scheduled_at.isnot(None),
            BroadcastCampaign.scheduled_at <= now,
        )
        .all()
    )
    promoted = 0
    for c in due:
        # Atomic guard: only update if still 'scheduled' (concurrent-safe)
        rows_affected = (
            db.query(BroadcastCampaign)
            .filter(
                BroadcastCampaign.id == c.id,
                BroadcastCampaign.status == "scheduled",
            )
            .update(
                {"status": "sending", "started_at": now, "scheduled_at": None},
                synchronize_session="fetch",
            )
        )
        if rows_affected == 1:
            promoted += 1
    if promoted:
        db.commit()
    return promoted


def dispatch_new_sending(db) -> int:
    """Materialize jobs for 'sending' campaigns that have no jobs yet."""
    campaigns = (
        db.query(BroadcastCampaign)
        .filter(BroadcastCampaign.status == "sending")
        .all()
    )
    count = 0
    for c in campaigns:
        has_jobs = (
            db.query(BroadcastSendJob.id)
            .filter(BroadcastSendJob.campaign_id == c.id)
            .first()
        )
        if has_jobs is None:
            dispatch(db, c)
            count += 1
    return count


def reap_stuck_jobs(
    db, *, timeout_s: int, max_attempts: int, now: datetime | None = None
) -> int:
    """Requeue jobs stuck in 'sending' past claimed_at + timeout_s -> 'pending'.

    Handles worker crash/restart mid-batch. Requeuing a still-in-flight slow batch
    is safe because each send carries idempotency_key=job.id (Resend dedups), so
    a re-send is not a duplicate.

    Jobs at or above max_attempts are marked 'failed' instead of requeued —
    this is the single ceiling that prevents infinite retry loops.
    """
    now = now or _now()
    cutoff = now - timedelta(seconds=timeout_s)
    stuck = (
        db.query(BroadcastSendJob)
        .filter(
            BroadcastSendJob.status == "sending",
            BroadcastSendJob.claimed_at.isnot(None),
            BroadcastSendJob.claimed_at < cutoff,
        )
        .all()
    )
    if not stuck:
        return 0
    n = 0
    for job in stuck:
        if (job.attempts or 0) >= max_attempts:
            job.status = "failed"
            job.error = f"Exceeded max attempts (stuck)"
        else:
            job.status = "pending"
            job.claimed_at = None
        n += 1
    db.commit()
    return n


def _claim_batch(db, campaign_id: str, batch_size: int) -> list[BroadcastSendJob]:
    """Claim up to batch_size pending jobs for a campaign.

    On PostgreSQL: uses FOR UPDATE SKIP LOCKED for safe concurrent claiming
    across rolling-deploy instances. On SQLite (tests): plain query (no locking).
    Marks claimed rows as 'sending' with claimed_at=now().
    """
    base = (
        db.query(BroadcastSendJob)
        .filter(
            BroadcastSendJob.campaign_id == campaign_id,
            BroadcastSendJob.status == "pending",
        )
        .order_by(BroadcastSendJob.created_at)
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
    """Claim + send a batch for each active sending campaign. Returns jobs sent this tick."""
    campaigns = (
        db.query(BroadcastCampaign)
        .filter(BroadcastCampaign.status == "sending")
        .all()
    )
    sent_this_tick = 0
    for c in campaigns:
        jobs = _claim_batch(db, c.id, batch_size)
        if jobs:
            send_pending_batch(db, c, jobs)
            sent_this_tick += len(jobs)
        mark_completed_if_done(db, c)
    return sent_this_tick


def run_once(db, *, batch_size: int, max_attempts: int, stuck_timeout_s: int) -> dict:
    """Execute one full worker tick. Factored out of the async loop for unit testing.

    Tick order per spec §4:
    1. promote due scheduled -> sending
    2. dispatch sending campaigns with no jobs
    3. reap stuck jobs (enforces max_attempts ceiling)
    4. claim + send batch for each sending campaign
    5. mark completed if done (inside process_sending_campaigns)
    """
    promoted = promote_due_scheduled(db)
    dispatched = dispatch_new_sending(db)
    reaped = reap_stuck_jobs(db, timeout_s=stuck_timeout_s, max_attempts=max_attempts)
    sent = process_sending_campaigns(db, batch_size=batch_size)
    return {"promoted": promoted, "dispatched": dispatched, "reaped": reaped, "sent": sent}


def run_once_in_session(
    *, batch_size: int, max_attempts: int, stuck_timeout_s: int
) -> dict:
    """Thin sync wrapper: opens its own DB session, runs one tick, closes it.

    Called via asyncio.to_thread() so blocking HTTP (Resend) never stalls the
    event loop. Tests use run_once(db, ...) directly with an injected session.
    """
    db = SessionLocal()
    try:
        return run_once(
            db,
            batch_size=batch_size,
            max_attempts=max_attempts,
            stuck_timeout_s=stuck_timeout_s,
        )
    finally:
        db.close()


async def start_broadcast_job() -> None:
    """Async background loop — register in FastAPI lifespan via asyncio.create_task().

    Each tick is dispatched to a thread via asyncio.to_thread() so that blocking
    Resend HTTP calls never stall FastAPI request handling. The SessionLocal is
    opened and closed entirely inside the worker thread (not safe to share across
    loop/thread boundary). Per-iteration exceptions are caught so the loop never
    dies. Graceful shutdown on CancelledError: the in-flight thread finishes its
    tick; stuck jobs are reaped on the next run.
    """
    interval = settings.BROADCAST_JOB_INTERVAL_SECONDS
    delay_s = settings.BROADCAST_RATE_DELAY_MS / 1000.0
    logger.info("Broadcast dispatch job started (interval=%ds)", interval)
    try:
        while True:
            try:
                result = await asyncio.to_thread(
                    run_once_in_session,
                    batch_size=settings.BROADCAST_BATCH_SIZE,
                    max_attempts=settings.BROADCAST_MAX_ATTEMPTS,
                    stuck_timeout_s=settings.BROADCAST_STUCK_TIMEOUT_S,
                )
                if result["sent"]:
                    await asyncio.sleep(delay_s)  # throttle Resend rate
            except Exception as exc:  # noqa: BLE001 — loop must never die
                logger.error("Broadcast job iteration error: %s", exc)
            await asyncio.sleep(interval)
    except asyncio.CancelledError:
        logger.info("Broadcast dispatch job cancelled — shutting down")
        raise
