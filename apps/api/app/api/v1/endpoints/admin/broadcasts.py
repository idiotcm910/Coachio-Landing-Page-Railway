"""Global broadcast campaigns — /admin/broadcasts.

origin='admin': no custom funnel variables; audience picker accepts many funnels.
"""
from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.api.v1.endpoints.admin import _broadcast_common as common
from app.db.base import get_db
from app.middleware.auth import require_role
from app.models.admin_user import AdminUser
from app.schemas.broadcast import (
    AudienceConfig,
    AudiencePreview,
    AudiencePreviewRequest,
    BroadcastCampaignCreate,
    BroadcastCampaignRead,
    BroadcastCampaignUpdate,
    CampaignStats,
    SendRequest,
    TestSendRequest,
)
from app.services import broadcast_campaign_service as svc

router = APIRouter()
ORIGIN = "admin"


@router.get("", response_model=list[BroadcastCampaignRead])
def list_broadcasts(
    db: Session = Depends(get_db),
    user: AdminUser = Depends(require_role("admin")),
):
    return svc.list_campaigns(db, origin=ORIGIN, funnel_id=None)


@router.post("", response_model=BroadcastCampaignRead, status_code=201)
def create_broadcast(
    payload: BroadcastCampaignCreate,
    db: Session = Depends(get_db),
    user: AdminUser = Depends(require_role("admin")),
):
    return common.create(db, origin=ORIGIN, funnel_id=None, payload=payload, created_by=user.id)


# Unbound audience preview — accepts funnel_ids+filters in body (pre-save count)
@router.post("/audience-preview", response_model=AudiencePreview)
def preview_admin_unbound(
    body: AudiencePreviewRequest,
    db: Session = Depends(get_db),
    user: AdminUser = Depends(require_role("admin")),
):
    cfg = AudienceConfig(funnel_ids=body.funnel_ids, filters=body.filters)
    return common.preview(db, origin=ORIGIN, funnel_id=None, override=cfg)


@router.get("/{cid}", response_model=BroadcastCampaignRead)
def get_broadcast(
    cid: str,
    db: Session = Depends(get_db),
    user: AdminUser = Depends(require_role("admin")),
):
    return common.get_or_404(db, origin=ORIGIN, funnel_id=None, campaign_id=cid)


@router.patch("/{cid}", response_model=BroadcastCampaignRead)
def update_broadcast(
    cid: str,
    payload: BroadcastCampaignUpdate,
    db: Session = Depends(get_db),
    user: AdminUser = Depends(require_role("admin")),
):
    return common.update(db, origin=ORIGIN, funnel_id=None, campaign_id=cid, payload=payload)


@router.delete("/{cid}", status_code=204)
def delete_broadcast(
    cid: str,
    db: Session = Depends(get_db),
    user: AdminUser = Depends(require_role("admin")),
):
    common.delete(db, origin=ORIGIN, funnel_id=None, campaign_id=cid)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{cid}/audience-preview", response_model=AudiencePreview)
def preview_broadcast(
    cid: str,
    db: Session = Depends(get_db),
    user: AdminUser = Depends(require_role("admin")),
):
    return common.preview(db, origin=ORIGIN, funnel_id=None, campaign_id=cid)


@router.post("/{cid}/send", response_model=BroadcastCampaignRead)
def send_broadcast(
    cid: str,
    body: SendRequest,
    db: Session = Depends(get_db),
    user: AdminUser = Depends(require_role("admin")),
):
    return common.send(db, origin=ORIGIN, funnel_id=None, campaign_id=cid, scheduled_at=body.scheduled_at)


@router.post("/{cid}/cancel", response_model=BroadcastCampaignRead)
def cancel_broadcast(
    cid: str,
    db: Session = Depends(get_db),
    user: AdminUser = Depends(require_role("admin")),
):
    return common.cancel_(db, origin=ORIGIN, funnel_id=None, campaign_id=cid)


@router.post("/{cid}/test", status_code=204)
def test_broadcast(
    cid: str,
    body: TestSendRequest,
    db: Session = Depends(get_db),
    user: AdminUser = Depends(require_role("admin")),
):
    common.test_send(db, origin=ORIGIN, funnel_id=None, campaign_id=cid, email=body.email)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{cid}/retry-failed", response_model=BroadcastCampaignRead)
def retry_broadcast(
    cid: str,
    db: Session = Depends(get_db),
    user: AdminUser = Depends(require_role("admin")),
):
    return common.retry(db, origin=ORIGIN, funnel_id=None, campaign_id=cid)


@router.get("/{cid}/stats", response_model=CampaignStats)
def stats_broadcast(
    cid: str,
    failed_page: int = Query(1, ge=1),
    failed_size: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    user: AdminUser = Depends(require_role("admin")),
):
    return common.stats_(
        db, origin=ORIGIN, funnel_id=None, campaign_id=cid,
        failed_page=failed_page, failed_size=failed_size,
    )
