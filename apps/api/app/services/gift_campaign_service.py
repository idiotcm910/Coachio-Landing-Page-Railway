"""Gift campaign orchestration (mechanism 2): CRUD + preview + confirm (freeze
snapshot) + schedule/send + cancel + retry + stats + per-job processing.

Unlike broadcast (which materializes in the worker), gift campaigns freeze the
recipient snapshot at CONFIRM time so the operator sends to exactly the people
they previewed. The worker only processes the frozen `gift_send_jobs`. Each job
delivers through the shared gift core (perks + email); the ledger guarantees a
person is never double-granted, and a failed email is retryable without re-grant.
"""
import uuid
from datetime import datetime, timezone

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.gift import Gift
from app.models.gift_campaign import GiftCampaign
from app.models.gift_grant import GiftGrant
from app.models.gift_send_job import GiftSendJob
from app.schemas.gift import GiftAudienceConfig
from app.schemas.gift_campaign import (
    GiftCampaignCreate,
    GiftCampaignStats,
    GiftCampaignUpdate,
    GiftSendJobRead,
)
from app.services import gift_audience_service as audience
from app.services.gift_fulfilment_service import deliver_gifts, send_delivery_email

_EMPTY_AUDIENCE_ERROR = "Audience is empty (0 recipients)"


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _cfg(campaign: GiftCampaign) -> GiftAudienceConfig:
    return GiftAudienceConfig.model_validate(campaign.audience_config or {})


# --- CRUD ---------------------------------------------------------------------
def create_campaign(db: Session, *, payload: GiftCampaignCreate, created_by: str | None) -> GiftCampaign:
    campaign = GiftCampaign(
        name=payload.name,
        gift_ids=payload.gift_ids,
        email_subject=payload.email_subject,
        email_html=payload.email_html,
        audience_config=payload.audience_config.model_dump(mode="json") if payload.audience_config else None,
        status="draft",
        scheduled_at=payload.scheduled_at,
        created_by=created_by,
    )
    db.add(campaign)
    db.commit()
    db.refresh(campaign)
    return campaign


def update_campaign(db: Session, campaign: GiftCampaign, payload: GiftCampaignUpdate) -> GiftCampaign:
    data = payload.model_dump(exclude_unset=True)
    if "audience_config" in data and data["audience_config"] is not None:
        data["audience_config"] = payload.audience_config.model_dump(mode="json")
    for k, v in data.items():
        setattr(campaign, k, v)
    db.commit()
    db.refresh(campaign)
    return campaign


def delete_campaign(db: Session, campaign: GiftCampaign) -> None:
    db.delete(campaign)
    db.commit()


def get_campaign(db: Session, campaign_id: str) -> GiftCampaign | None:
    return db.query(GiftCampaign).filter(GiftCampaign.id == campaign_id).first()


def list_campaigns(db: Session) -> list[GiftCampaign]:
    return db.query(GiftCampaign).order_by(GiftCampaign.created_at.desc()).all()


def preview(db: Session, campaign: GiftCampaign) -> dict:
    return audience.preview(db, campaign.gift_ids or [], _cfg(campaign))


# --- Confirm (freeze recipient snapshot) --------------------------------------
def confirm(db: Session, campaign: GiftCampaign) -> int:
    """Freeze the audience into gift_send_jobs. Idempotent (no-op if already frozen)."""
    existing = db.query(func.count(GiftSendJob.id)).filter(GiftSendJob.campaign_id == campaign.id).scalar()
    if existing:
        return 0
    recipients = audience.resolve_recipients(db, campaign.gift_ids or [], _cfg(campaign))
    campaign.total_recipients = len(recipients)
    campaign.snapshot_at = _now()
    if recipients:
        db.bulk_insert_mappings(
            GiftSendJob,
            [
                {
                    "id": str(uuid.uuid4()),
                    "campaign_id": campaign.id,
                    "lead_id": r.get("lead_id"),
                    "email": r["email"],
                    "name": r.get("name"),
                    "phone": r.get("phone"),
                    "status": "pending",
                    "attempts": 0,
                }
                for r in recipients
            ],
        )
    db.commit()
    return len(recipients)


def schedule_or_send(db: Session, campaign: GiftCampaign, scheduled_at: datetime | None) -> GiftCampaign:
    """Confirm (if not yet) then set status. Worker drains the frozen jobs."""
    confirm(db, campaign)
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


# --- Per-job processing (called by the worker) --------------------------------
def process_jobs(db: Session, campaign: GiftCampaign, jobs: list[GiftSendJob]) -> None:
    """Deliver each claimed job through the gift core (N gifts → one email). Per-job commit."""
    gift_ids = campaign.gift_ids or []
    gifts = (
        db.query(Gift).filter(Gift.id.in_(gift_ids), Gift.is_archived.is_(False)).all()
        if gift_ids
        else []
    )
    granter = campaign.created_by or "system"
    source = f"campaign:{campaign.id}"
    for j in jobs:
        try:
            if not gifts:
                j.status = "failed"
                j.error = "no active gift in campaign"
                j.attempts = (j.attempts or 0) + 1
                db.commit()
                continue
            res = deliver_gifts(
                db, gifts=gifts, email=j.email, full_name=j.name, phone=j.phone,
                source=source, granted_by=granter,
                email_subject=campaign.email_subject or "", email_html=campaign.email_html or "",
                background_tasks=None,
            )
            j.attempts = (j.attempts or 0) + 1
            if res.get("granted_any"):
                _finish_job(j, res.get("email_ok") is not False)
            else:
                # Nothing new granted (recipient already had every gift). If a prior
                # delivery's email failed, re-send it — do NOT re-grant perks.
                existing = (
                    db.query(GiftGrant)
                    .filter(GiftGrant.source == source, GiftGrant.email == j.email.strip().lower())
                    .all()
                )
                unsent = [g for g in existing if g.email_status != "sent"]
                if unsent:
                    ok = send_delivery_email(
                        [g.id for g in unsent],
                        email_subject=campaign.email_subject or "",
                        email_html=campaign.email_html or "", db=db,
                    )
                    _finish_job(j, ok)
                else:
                    j.status = "skipped"
            db.commit()
        except Exception as exc:  # noqa: BLE001 — isolate one bad recipient
            db.rollback()
            j.status = "failed"
            j.error = str(exc)[:500]
            j.attempts = (j.attempts or 0) + 1
            campaign.last_error = str(exc)[:500]
            db.commit()


def _finish_job(job: GiftSendJob, emailed: bool) -> None:
    if emailed:
        job.status = "sent"
        job.sent_at = _now()
    else:
        job.status = "failed"
        job.error = "email send failed"


# --- Control + reporting ------------------------------------------------------
def cancel(db: Session, campaign: GiftCampaign) -> GiftCampaign:
    """Cancel: stop further sends. Pending/sending jobs → skipped; granted stay."""
    if campaign.status in ("draft", "scheduled", "sending"):
        campaign.status = "cancelled"
        db.query(GiftSendJob).filter(
            GiftSendJob.campaign_id == campaign.id,
            GiftSendJob.status.in_(("pending", "sending")),
        ).update({"status": "skipped"}, synchronize_session=False)
        db.commit()
        db.refresh(campaign)
    return campaign


def retry_failed(db: Session, campaign: GiftCampaign) -> int:
    """Requeue failed jobs to re-send the email only (ledger prevents re-grant)."""
    n = (
        db.query(GiftSendJob)
        .filter(GiftSendJob.campaign_id == campaign.id, GiftSendJob.status == "failed")
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
        db.query(GiftSendJob.status, func.count(GiftSendJob.id))
        .filter(GiftSendJob.campaign_id == campaign_id)
        .group_by(GiftSendJob.status)
        .all()
    )
    return {status: cnt for status, cnt in rows}


def mark_completed_if_done(db: Session, campaign: GiftCampaign) -> bool:
    if campaign.status != "sending":
        return False
    pending = (
        db.query(func.count(GiftSendJob.id))
        .filter(
            GiftSendJob.campaign_id == campaign.id,
            GiftSendJob.status.in_(("pending", "sending")),
        )
        .scalar()
    )
    if pending:
        return False
    counts = _status_counts(db, campaign.id)
    campaign.sent_count = counts.get("sent", 0)
    campaign.failed_count = counts.get("failed", 0)
    campaign.skipped_count = counts.get("skipped", 0)
    campaign.status = "completed"
    campaign.completed_at = _now()
    db.commit()
    return True


def stats(db: Session, campaign: GiftCampaign, *, failed_page: int = 1, failed_size: int = 50) -> GiftCampaignStats:
    counts = _status_counts(db, campaign.id)
    failed_total = counts.get("failed", 0)
    failed_rows = (
        db.query(GiftSendJob)
        .filter(GiftSendJob.campaign_id == campaign.id, GiftSendJob.status == "failed")
        .order_by(GiftSendJob.email)
        .offset((failed_page - 1) * failed_size)
        .limit(failed_size)
        .all()
    )
    return GiftCampaignStats(
        total=sum(counts.values()),
        sent=counts.get("sent", 0),
        failed=failed_total,
        pending=counts.get("pending", 0) + counts.get("sending", 0),
        skipped=counts.get("skipped", 0),
        last_error=campaign.last_error,
        failed_jobs=[GiftSendJobRead.model_validate(j) for j in failed_rows],
        failed_total=failed_total,
    )
