"""Shared endpoint logic for both broadcast routers (DRY).

Funnel-scoped router passes origin='funnel'+funnel_id (audience forced to that
funnel's leads, custom vars available). Global router passes origin='admin'.
"""
import resend
from fastapi import HTTPException, status

from app.core.config import settings
from app.schemas.broadcast import (
    AudienceConfig,
    AudiencePreview,
    BroadcastCampaignCreate,
    BroadcastCampaignUpdate,
    CampaignStats,
)
from app.services import broadcast_campaign_service as svc
from app.services.broadcast_audience_service import count_audience, resolve_audience_config
from app.services.broadcast_sender import build_base_context, render_for_recipient

# Statuses from which a campaign can be cancelled
_CANCELABLE = {"scheduled", "sending"}
# Statuses from which a campaign can be sent / re-triggered
_SENDABLE = {"draft", "scheduled", "failed"}


def _force_funnel_audience(funnel_id: str, cfg: AudienceConfig | None) -> AudienceConfig:
    filters = cfg.filters if cfg else AudienceConfig().filters
    return AudienceConfig(funnel_ids=[funnel_id], filters=filters)


def create(db, *, origin, funnel_id, payload: BroadcastCampaignCreate, created_by):
    if origin == "funnel":
        payload = payload.model_copy(
            update={"audience_config": _force_funnel_audience(funnel_id, payload.audience_config)}
        )
    return svc.create_campaign(
        db, origin=origin, funnel_id=funnel_id, payload=payload, created_by=created_by
    )


def get_or_404(db, *, origin, funnel_id, campaign_id):
    c = svc.get_campaign(db, campaign_id, origin=origin, funnel_id=funnel_id)
    if c is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found")
    return c


def update(db, *, origin, funnel_id, campaign_id, payload: BroadcastCampaignUpdate):
    c = get_or_404(db, origin=origin, funnel_id=funnel_id, campaign_id=campaign_id)
    # A scheduled campaign has not materialized any send jobs yet (the worker does
    # that at send time), so its content/audience is still safe to edit. Sending /
    # completed / cancelled campaigns are locked.
    if c.status not in ("draft", "scheduled"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot edit a campaign in status '{c.status}'. Only draft or scheduled campaigns can be edited.",
        )
    if origin == "funnel" and payload.audience_config is not None:
        payload = payload.model_copy(
            update={"audience_config": _force_funnel_audience(funnel_id, payload.audience_config)}
        )
    return svc.update_campaign(db, c, payload)


def delete(db, *, origin, funnel_id, campaign_id):
    c = get_or_404(db, origin=origin, funnel_id=funnel_id, campaign_id=campaign_id)
    if c.status != "draft":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot delete a campaign in status '{c.status}'. Only draft campaigns can be deleted.",
        )
    svc.delete_campaign(db, c)


def preview(db, *, origin, funnel_id, campaign_id=None, override=None) -> AudiencePreview:
    if override is not None:
        cfg = override if origin == "admin" else _force_funnel_audience(funnel_id, override)
    else:
        c = get_or_404(db, origin=origin, funnel_id=funnel_id, campaign_id=campaign_id)
        cfg = resolve_audience_config(c.audience_config)
    return AudiencePreview(count=count_audience(db, cfg))


def send(db, *, origin, funnel_id, campaign_id, scheduled_at):
    c = get_or_404(db, origin=origin, funnel_id=funnel_id, campaign_id=campaign_id)
    if c.status not in _SENDABLE:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot send a campaign in status '{c.status}'. Allowed: draft, scheduled, failed.",
        )
    return svc.schedule_or_send(db, c, scheduled_at)


def cancel_(db, *, origin, funnel_id, campaign_id):
    c = get_or_404(db, origin=origin, funnel_id=funnel_id, campaign_id=campaign_id)
    if c.status not in _CANCELABLE:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot cancel a campaign in status '{c.status}'. Allowed: scheduled, sending.",
        )
    return svc.cancel(db, c)


def test_send(db, *, origin, funnel_id, campaign_id, email) -> None:
    c = get_or_404(db, origin=origin, funnel_id=funnel_id, campaign_id=campaign_id)
    sanitized_body, base_ctx = build_base_context(db, c)
    subject, html = render_for_recipient(sanitized_body, c.subject, base_ctx, name="Test", email=email)
    resend.api_key = settings.RESEND_API_KEY
    resend.Emails.send(
        {"from": settings.RESEND_FROM_EMAIL, "to": email, "subject": subject, "html": html}
    )


def retry(db, *, origin, funnel_id, campaign_id):
    c = get_or_404(db, origin=origin, funnel_id=funnel_id, campaign_id=campaign_id)
    n = svc.retry_failed(db, c)
    if n == 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No failed jobs to retry.",
        )
    return c


def stats_(db, *, origin, funnel_id, campaign_id, failed_page, failed_size) -> CampaignStats:
    c = get_or_404(db, origin=origin, funnel_id=funnel_id, campaign_id=campaign_id)
    return svc.stats(db, c, failed_page=failed_page, failed_size=failed_size)
