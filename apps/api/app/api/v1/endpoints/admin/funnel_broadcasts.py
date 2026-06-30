"""Funnel-scoped broadcast campaigns — /admin/funnels/{funnel_id}/broadcasts.

origin='funnel': custom funnel variables available; audience = this funnel's leads.
"""
from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.api.v1.endpoints.admin import _broadcast_common as common
from app.api.v1.endpoints.admin.funnels import get_funnel_or_404
from app.db.base import get_db
from app.middleware.auth import require_role
from app.models.admin_user import AdminUser
from app.schemas.broadcast import (
    AudiencePreview,
    BroadcastCampaignCreate,
    BroadcastCampaignRead,
    BroadcastCampaignUpdate,
    CampaignStats,
    SendRequest,
    TestSendRequest,
)
from app.services import broadcast_campaign_service as svc

router = APIRouter()
ORIGIN = "funnel"


@router.get("/{funnel_id}/broadcasts", response_model=list[BroadcastCampaignRead])
def list_broadcasts(
    funnel_id: str,
    db: Session = Depends(get_db),
    user: AdminUser = Depends(require_role("admin")),
):
    get_funnel_or_404(db, funnel_id)
    return svc.list_campaigns(db, origin=ORIGIN, funnel_id=funnel_id)


@router.post("/{funnel_id}/broadcasts", response_model=BroadcastCampaignRead, status_code=201)
def create_broadcast(
    funnel_id: str,
    payload: BroadcastCampaignCreate,
    db: Session = Depends(get_db),
    user: AdminUser = Depends(require_role("admin")),
):
    get_funnel_or_404(db, funnel_id)
    return common.create(db, origin=ORIGIN, funnel_id=funnel_id, payload=payload, created_by=user.id)


@router.get("/{funnel_id}/broadcasts/{cid}", response_model=BroadcastCampaignRead)
def get_broadcast(
    funnel_id: str,
    cid: str,
    db: Session = Depends(get_db),
    user: AdminUser = Depends(require_role("admin")),
):
    return common.get_or_404(db, origin=ORIGIN, funnel_id=funnel_id, campaign_id=cid)


@router.patch("/{funnel_id}/broadcasts/{cid}", response_model=BroadcastCampaignRead)
def update_broadcast(
    funnel_id: str,
    cid: str,
    payload: BroadcastCampaignUpdate,
    db: Session = Depends(get_db),
    user: AdminUser = Depends(require_role("admin")),
):
    return common.update(db, origin=ORIGIN, funnel_id=funnel_id, campaign_id=cid, payload=payload)


@router.delete("/{funnel_id}/broadcasts/{cid}", status_code=204)
def delete_broadcast(
    funnel_id: str,
    cid: str,
    db: Session = Depends(get_db),
    user: AdminUser = Depends(require_role("admin")),
):
    common.delete(db, origin=ORIGIN, funnel_id=funnel_id, campaign_id=cid)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{funnel_id}/broadcasts/{cid}/audience-preview", response_model=AudiencePreview)
def preview_broadcast(
    funnel_id: str,
    cid: str,
    db: Session = Depends(get_db),
    user: AdminUser = Depends(require_role("admin")),
):
    return common.preview(db, origin=ORIGIN, funnel_id=funnel_id, campaign_id=cid)


@router.post("/{funnel_id}/broadcasts/{cid}/send", response_model=BroadcastCampaignRead)
def send_broadcast(
    funnel_id: str,
    cid: str,
    body: SendRequest,
    db: Session = Depends(get_db),
    user: AdminUser = Depends(require_role("admin")),
):
    return common.send(db, origin=ORIGIN, funnel_id=funnel_id, campaign_id=cid, scheduled_at=body.scheduled_at)


@router.post("/{funnel_id}/broadcasts/{cid}/cancel", response_model=BroadcastCampaignRead)
def cancel_broadcast(
    funnel_id: str,
    cid: str,
    db: Session = Depends(get_db),
    user: AdminUser = Depends(require_role("admin")),
):
    return common.cancel_(db, origin=ORIGIN, funnel_id=funnel_id, campaign_id=cid)


@router.post("/{funnel_id}/broadcasts/{cid}/test", status_code=204)
def test_broadcast(
    funnel_id: str,
    cid: str,
    body: TestSendRequest,
    db: Session = Depends(get_db),
    user: AdminUser = Depends(require_role("admin")),
):
    common.test_send(db, origin=ORIGIN, funnel_id=funnel_id, campaign_id=cid, email=body.email)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{funnel_id}/broadcasts/{cid}/retry-failed", response_model=BroadcastCampaignRead)
def retry_broadcast(
    funnel_id: str,
    cid: str,
    db: Session = Depends(get_db),
    user: AdminUser = Depends(require_role("admin")),
):
    return common.retry(db, origin=ORIGIN, funnel_id=funnel_id, campaign_id=cid)


@router.get("/{funnel_id}/broadcasts/{cid}/stats", response_model=CampaignStats)
def stats_broadcast(
    funnel_id: str,
    cid: str,
    failed_page: int = Query(1, ge=1),
    failed_size: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    user: AdminUser = Depends(require_role("admin")),
):
    return common.stats_(
        db, origin=ORIGIN, funnel_id=funnel_id, campaign_id=cid,
        failed_page=failed_page, failed_size=failed_size,
    )
