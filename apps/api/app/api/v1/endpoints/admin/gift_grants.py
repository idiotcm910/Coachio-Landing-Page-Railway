"""Gift grant tracking / audit admin endpoints — /admin/gift-grants.

Filterable list + aggregate stats + detail + resend (single + bulk). Resend
re-sends the email only; the ledger prevents any perk re-grant.
"""
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db.base import get_db
from app.middleware.auth import require_role
from app.models.admin_user import AdminUser
from app.schemas.gift import GiftGrantDetail, GiftGrantListResponse, GiftGrantStats, ResendResult
from app.services import gift_grant_tracking_service as svc

router = APIRouter()


def _filters(
    gift_id: str | None,
    funnel_id: str | None,
    source_type: str | None,
    email_status: str | None,
    email: str | None,
    content: str | None,
    new_account_created: bool | None,
    date_from: datetime | None,
    date_to: datetime | None,
) -> dict:
    return {
        "gift_id": gift_id, "funnel_id": funnel_id, "source_type": source_type,
        "email_status": email_status, "email": email, "content": content,
        "new_account_created": new_account_created, "date_from": date_from, "date_to": date_to,
    }


@router.get("", response_model=GiftGrantListResponse)
def list_grants(
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=200),
    gift_id: str | None = None,
    funnel_id: str | None = None,
    source_type: str | None = Query(None, description="auto | campaign"),
    email_status: str | None = Query(None, description="sent | pending | failed"),
    email: str | None = None,
    content: str | None = Query(None, description="includes_credits | skills_only"),
    new_account_created: bool | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    db: Session = Depends(get_db),
    user: AdminUser = Depends(require_role("admin")),
):
    f = _filters(gift_id, funnel_id, source_type, email_status, email, content, new_account_created, date_from, date_to)
    return svc.list_grants(db, page=page, size=size, **f)


@router.get("/stats", response_model=GiftGrantStats)
def grant_stats(
    gift_id: str | None = None,
    funnel_id: str | None = None,
    source_type: str | None = None,
    email_status: str | None = None,
    email: str | None = None,
    content: str | None = None,
    new_account_created: bool | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    db: Session = Depends(get_db),
    user: AdminUser = Depends(require_role("admin")),
):
    f = _filters(gift_id, funnel_id, source_type, email_status, email, content, new_account_created, date_from, date_to)
    return svc.stats(db, **f)


@router.post("/bulk-retry", response_model=ResendResult)
def bulk_retry(
    gift_id: str | None = None,
    funnel_id: str | None = None,
    source_type: str | None = None,
    email: str | None = None,
    content: str | None = None,
    new_account_created: bool | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    db: Session = Depends(get_db),
    user: AdminUser = Depends(require_role("admin")),
):
    f = _filters(gift_id, funnel_id, source_type, None, email, content, new_account_created, date_from, date_to)
    return svc.bulk_retry_failed(db, **f)


@router.get("/{grant_id}", response_model=GiftGrantDetail)
def grant_detail(grant_id: str, db: Session = Depends(get_db), user: AdminUser = Depends(require_role("admin"))):
    d = svc.detail(db, grant_id)
    if d is None:
        raise HTTPException(status_code=404, detail="Grant not found")
    return d


@router.post("/{grant_id}/resend", response_model=ResendResult)
def resend_grant(grant_id: str, db: Session = Depends(get_db), user: AdminUser = Depends(require_role("admin"))):
    ok = svc.resend(db, grant_id)
    return ResendResult(resent=1 if ok else 0, failed=0 if ok else 1)
