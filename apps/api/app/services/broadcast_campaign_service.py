"""Broadcast campaign orchestration: CRUD + dispatch + cancel + retry + stats.

dispatch() materializes the audience snapshot into broadcast_send_jobs (chunked
bulk insert, conflict-safe). The worker (app/jobs) does the actual sending.
"""
import uuid
from datetime import datetime, timezone

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.broadcast_campaign import BroadcastCampaign
from app.models.broadcast_send_job import BroadcastSendJob
from app.schemas.broadcast import (
    BroadcastCampaignCreate,
    BroadcastCampaignUpdate,
    CampaignStats,
    SendJobRead,
)
from app.services.broadcast_audience_service import (
    count_audience,
    iter_audience,
    resolve_audience_config,
)

_EMPTY_AUDIENCE_ERROR = "Audience rỗng (0 người nhận)"


def _now() -> datetime:
    return datetime.now(timezone.utc)


def create_campaign(
    db: Session,
    *,
    origin: str,
    funnel_id: str | None,
    payload: BroadcastCampaignCreate,
    created_by: str | None,
) -> BroadcastCampaign:
    campaign = BroadcastCampaign(
        origin=origin,
        funnel_id=funnel_id,
        title=payload.title,
        subject=payload.subject,
        html_body=payload.html_body,
        audience_config=payload.audience_config.model_dump(mode="json")
        if payload.audience_config
        else None,
        status="draft",
        scheduled_at=payload.scheduled_at,
        created_by=created_by,
    )
    db.add(campaign)
    db.commit()
    db.refresh(campaign)
    return campaign


def update_campaign(
    db: Session, campaign: BroadcastCampaign, payload: BroadcastCampaignUpdate
) -> BroadcastCampaign:
    data = payload.model_dump(exclude_unset=True)
    if "audience_config" in data and data["audience_config"] is not None:
        data["audience_config"] = payload.audience_config.model_dump(mode="json")
    for k, v in data.items():
        setattr(campaign, k, v)
    db.commit()
    db.refresh(campaign)
    return campaign


def delete_campaign(db: Session, campaign: BroadcastCampaign) -> None:
    db.delete(campaign)
    db.commit()


def get_campaign(
    db: Session, campaign_id: str, *, origin: str, funnel_id: str | None
) -> BroadcastCampaign | None:
    q = db.query(BroadcastCampaign).filter(
        BroadcastCampaign.id == campaign_id, BroadcastCampaign.origin == origin
    )
    if funnel_id is not None:
        q = q.filter(BroadcastCampaign.funnel_id == funnel_id)
    return q.first()


def list_campaigns(
    db: Session, *, origin: str, funnel_id: str | None
) -> list[BroadcastCampaign]:
    q = db.query(BroadcastCampaign).filter(BroadcastCampaign.origin == origin)
    if funnel_id is not None:
        q = q.filter(BroadcastCampaign.funnel_id == funnel_id)
    return q.order_by(BroadcastCampaign.created_at.desc()).all()


def schedule_or_send(
    db: Session, campaign: BroadcastCampaign, scheduled_at: datetime | None
) -> BroadcastCampaign:
    """Set campaign status only. Worker handles dispatch for both paths."""
    now = _now()
    if scheduled_at and scheduled_at > now:
        campaign.status = "scheduled"
        campaign.scheduled_at = scheduled_at
    else:
        campaign.status = "sending"
        campaign.scheduled_at = None
        campaign.started_at = now
    campaign.last_error = None
    db.commit()
    db.refresh(campaign)
    return campaign


def dispatch(db: Session, campaign: BroadcastCampaign, *, chunk_size: int = 5000) -> int:
    """Materialize audience snapshot into send_jobs. Idempotent.

    Returns number of jobs inserted (0 if already materialized or empty audience).
    """
    existing = (
        db.query(func.count(BroadcastSendJob.id))
        .filter(BroadcastSendJob.campaign_id == campaign.id)
        .scalar()
    )
    if existing:
        return 0

    cfg = resolve_audience_config(campaign.audience_config)
    total = count_audience(db, cfg)
    if total == 0:
        campaign.total_recipients = 0
        campaign.status = "failed"
        campaign.last_error = _EMPTY_AUDIENCE_ERROR
        campaign.completed_at = _now()
        db.commit()
        return 0

    campaign.total_recipients = total
    inserted = 0
    for chunk in iter_audience(db, cfg, chunk_size=chunk_size):
        mappings = [
            {
                "id": str(uuid.uuid4()),
                "campaign_id": campaign.id,
                "lead_id": lead_id,
                "email": email,
                "name": name,
                "status": "pending",
                "attempts": 0,
            }
            for (email, name, lead_id) in chunk
        ]
        db.bulk_insert_mappings(BroadcastSendJob, mappings)
        inserted += len(mappings)
        db.commit()

    return inserted


def cancel(db: Session, campaign: BroadcastCampaign) -> BroadcastCampaign:
    """Cancel campaign. Pending/sending jobs become skipped."""
    if campaign.status in ("draft", "scheduled", "sending"):
        campaign.status = "cancelled"
        db.query(BroadcastSendJob).filter(
            BroadcastSendJob.campaign_id == campaign.id,
            BroadcastSendJob.status.in_(("pending", "sending")),
        ).update({"status": "skipped"}, synchronize_session=False)
        db.commit()
        db.refresh(campaign)
    return campaign


def retry_failed(db: Session, campaign: BroadcastCampaign) -> int:
    """Reset failed jobs to pending; set campaign back to sending. Returns count requeued."""
    n = (
        db.query(BroadcastSendJob)
        .filter(
            BroadcastSendJob.campaign_id == campaign.id,
            BroadcastSendJob.status == "failed",
        )
        .update({"status": "pending", "error": None, "claimed_at": None}, synchronize_session=False)
    )
    if n:
        campaign.status = "sending"
        campaign.last_error = None
        campaign.completed_at = None
    db.commit()
    db.refresh(campaign)
    return n


def _status_counts(db: Session, campaign_id: str) -> dict[str, int]:
    rows = (
        db.query(BroadcastSendJob.status, func.count(BroadcastSendJob.id))
        .filter(BroadcastSendJob.campaign_id == campaign_id)
        .group_by(BroadcastSendJob.status)
        .all()
    )
    return {status: cnt for status, cnt in rows}


def mark_completed_if_done(db: Session, campaign: BroadcastCampaign) -> bool:
    """Transition campaign to completed if no pending/sending jobs remain."""
    if campaign.status != "sending":
        return False
    pending = (
        db.query(func.count(BroadcastSendJob.id))
        .filter(
            BroadcastSendJob.campaign_id == campaign.id,
            BroadcastSendJob.status.in_(("pending", "sending")),
        )
        .scalar()
    )
    if pending:
        return False
    counts = _status_counts(db, campaign.id)
    campaign.sent_count = counts.get("sent", 0)
    campaign.failed_count = counts.get("failed", 0)
    campaign.status = "completed"
    campaign.completed_at = _now()
    db.commit()
    return True


def stats(
    db: Session, campaign: BroadcastCampaign, *, failed_page: int = 1, failed_size: int = 50
) -> CampaignStats:
    counts = _status_counts(db, campaign.id)
    total = sum(counts.values())
    failed_total = counts.get("failed", 0)
    failed_rows = (
        db.query(BroadcastSendJob)
        .filter(
            BroadcastSendJob.campaign_id == campaign.id,
            BroadcastSendJob.status == "failed",
        )
        .order_by(BroadcastSendJob.email)
        .offset((failed_page - 1) * failed_size)
        .limit(failed_size)
        .all()
    )
    return CampaignStats(
        total=total,
        sent=counts.get("sent", 0),
        failed=failed_total,
        pending=counts.get("pending", 0) + counts.get("sending", 0),
        last_error=campaign.last_error,
        failed_jobs=[SendJobRead.model_validate(j) for j in failed_rows],
        failed_total=failed_total,
    )
