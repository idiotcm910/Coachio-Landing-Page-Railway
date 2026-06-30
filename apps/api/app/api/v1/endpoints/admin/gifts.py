"""Gift package admin endpoints — /admin/gifts.

CRUD + soft-archive only. Gifts are data (no email); the delivery email +
preview/test-send live on the campaign/automation endpoints.
"""
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from app.db.base import get_db
from app.middleware.auth import require_role
from app.models.admin_user import AdminUser
from app.schemas.gift import GiftCreate, GiftRead, GiftUpdate
from app.services import gift_service as svc

router = APIRouter()


def _get_or_404(db: Session, gift_id: str):
    gift = svc.get_gift(db, gift_id)
    if gift is None:
        raise HTTPException(status_code=404, detail="Gift not found")
    return gift


@router.get("", response_model=list[GiftRead])
def list_gifts(
    include_archived: bool = Query(False),
    db: Session = Depends(get_db),
    user: AdminUser = Depends(require_role("admin")),
):
    return svc.list_gifts(db, include_archived=include_archived)


@router.post("", response_model=GiftRead, status_code=201)
def create_gift(
    payload: GiftCreate,
    db: Session = Depends(get_db),
    user: AdminUser = Depends(require_role("admin")),
):
    try:
        return svc.create_gift(db, payload=payload, created_by=user.id)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))


@router.get("/{gift_id}", response_model=GiftRead)
def get_gift(gift_id: str, db: Session = Depends(get_db), user: AdminUser = Depends(require_role("admin"))):
    return _get_or_404(db, gift_id)


@router.patch("/{gift_id}", response_model=GiftRead)
def update_gift(
    gift_id: str,
    payload: GiftUpdate,
    db: Session = Depends(get_db),
    user: AdminUser = Depends(require_role("admin")),
):
    gift = _get_or_404(db, gift_id)
    try:
        return svc.update_gift(db, gift, payload)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))


@router.delete("/{gift_id}", response_model=GiftRead)
def archive_gift(gift_id: str, db: Session = Depends(get_db), user: AdminUser = Depends(require_role("admin"))):
    """Soft-archive (never hard-delete — preserves the grant ledger)."""
    return svc.archive_gift(db, _get_or_404(db, gift_id))
