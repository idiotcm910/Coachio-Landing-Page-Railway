"""Gift campaign admin endpoints — /admin/gift-campaigns (mechanism 2).

CRUD + audience preview (bound + unbound) + confirm (freeze snapshot) +
send/schedule + cancel + retry-failed + stats.
"""
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from app.db.base import get_db
from app.middleware.auth import require_role
from app.models.admin_user import AdminUser
from app.schemas.gift import GiftAudienceConfig
from app.schemas.gift_campaign import (
    GiftAudiencePreview,
    GiftAudiencePreviewRequest,
    GiftCampaignCreate,
    GiftCampaignRead,
    GiftCampaignStats,
    GiftCampaignUpdate,
    GiftEmailPreviewRequest,
    GiftEmailTestSendRequest,
    GiftSendRequest,
)
from app.services import gift_audience_service as audience
from app.services import gift_campaign_service as svc
from app.services import gift_service
from app.services.gift_email_render import variable_metadata

router = APIRouter()


@router.get("/email-variables")
def email_variables(user: AdminUser = Depends(require_role("admin"))):
    """Token palette for the delivery email editor (campaign + automation)."""
    return variable_metadata()


@router.post("/preview-email")
def preview_email(
    body: GiftEmailPreviewRequest,
    db: Session = Depends(get_db),
    user: AdminUser = Depends(require_role("admin")),
):
    """Render the delivery email with sample data + the selected gifts' contents."""
    return gift_service.preview_email(
        db, gift_ids=body.gift_ids, subject=body.email_subject, html=body.email_html
    )


@router.post("/test-send-email", status_code=204)
def test_send_email(
    body: GiftEmailTestSendRequest,
    db: Session = Depends(get_db),
    user: AdminUser = Depends(require_role("admin")),
):
    try:
        gift_service.test_send_email(
            db, gift_ids=body.gift_ids, subject=body.email_subject,
            html=body.email_html, to_email=body.to_email,
        )
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Test email failed: {e}")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


def _get_or_404(db: Session, campaign_id: str):
    c = svc.get_campaign(db, campaign_id)
    if c is None:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return c


@router.get("", response_model=list[GiftCampaignRead])
def list_campaigns(db: Session = Depends(get_db), user: AdminUser = Depends(require_role("admin"))):
    return svc.list_campaigns(db)


@router.post("", response_model=GiftCampaignRead, status_code=201)
def create_campaign(
    payload: GiftCampaignCreate,
    db: Session = Depends(get_db),
    user: AdminUser = Depends(require_role("admin")),
):
    return svc.create_campaign(db, payload=payload, created_by=user.id)


@router.post("/audience-preview", response_model=GiftAudiencePreview)
def preview_unbound(
    body: GiftAudiencePreviewRequest,
    db: Session = Depends(get_db),
    user: AdminUser = Depends(require_role("admin")),
):
    cfg = body.audience_config or GiftAudienceConfig()
    return audience.preview(db, body.gift_ids, cfg)


@router.get("/{cid}", response_model=GiftCampaignRead)
def get_campaign(cid: str, db: Session = Depends(get_db), user: AdminUser = Depends(require_role("admin"))):
    return _get_or_404(db, cid)


@router.patch("/{cid}", response_model=GiftCampaignRead)
def update_campaign(
    cid: str,
    payload: GiftCampaignUpdate,
    db: Session = Depends(get_db),
    user: AdminUser = Depends(require_role("admin")),
):
    return svc.update_campaign(db, _get_or_404(db, cid), payload)


@router.delete("/{cid}", status_code=204)
def delete_campaign(cid: str, db: Session = Depends(get_db), user: AdminUser = Depends(require_role("admin"))):
    svc.delete_campaign(db, _get_or_404(db, cid))
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{cid}/audience-preview", response_model=GiftAudiencePreview)
def preview_bound(cid: str, db: Session = Depends(get_db), user: AdminUser = Depends(require_role("admin"))):
    return svc.preview(db, _get_or_404(db, cid))


@router.post("/{cid}/confirm", response_model=GiftCampaignRead)
def confirm_campaign(cid: str, db: Session = Depends(get_db), user: AdminUser = Depends(require_role("admin"))):
    """Freeze the recipient snapshot into send jobs."""
    c = _get_or_404(db, cid)
    svc.confirm(db, c)
    db.refresh(c)
    return c


@router.post("/{cid}/send", response_model=GiftCampaignRead)
def send_campaign(
    cid: str,
    body: GiftSendRequest,
    db: Session = Depends(get_db),
    user: AdminUser = Depends(require_role("admin")),
):
    return svc.schedule_or_send(db, _get_or_404(db, cid), body.scheduled_at)


@router.post("/{cid}/cancel", response_model=GiftCampaignRead)
def cancel_campaign(cid: str, db: Session = Depends(get_db), user: AdminUser = Depends(require_role("admin"))):
    return svc.cancel(db, _get_or_404(db, cid))


@router.post("/{cid}/retry-failed", response_model=GiftCampaignRead)
def retry_campaign(cid: str, db: Session = Depends(get_db), user: AdminUser = Depends(require_role("admin"))):
    c = _get_or_404(db, cid)
    svc.retry_failed(db, c)
    db.refresh(c)
    return c


@router.get("/{cid}/stats", response_model=GiftCampaignStats)
def stats_campaign(
    cid: str,
    failed_page: int = Query(1, ge=1),
    failed_size: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    user: AdminUser = Depends(require_role("admin")),
):
    return svc.stats(db, _get_or_404(db, cid), failed_page=failed_page, failed_size=failed_size)
