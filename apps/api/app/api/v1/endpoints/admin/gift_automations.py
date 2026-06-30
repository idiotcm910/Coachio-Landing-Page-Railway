"""Gift automation admin endpoints — /admin/gift-automations (mechanism 1)."""
from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.db.base import get_db
from app.middleware.auth import require_role
from app.models.admin_user import AdminUser
from app.schemas.gift import GiftAutomationCreate, GiftAutomationRead, GiftAutomationUpdate
from app.services import gift_automation_service as svc

router = APIRouter()


def _get_or_404(db: Session, automation_id: str):
    auto = svc.get_automation(db, automation_id)
    if auto is None:
        raise HTTPException(status_code=404, detail="Automation not found")
    return auto


@router.get("", response_model=list[GiftAutomationRead])
def list_automations(db: Session = Depends(get_db), user: AdminUser = Depends(require_role("admin"))):
    return svc.list_automations(db)


@router.post("", response_model=GiftAutomationRead, status_code=201)
def create_automation(
    payload: GiftAutomationCreate,
    db: Session = Depends(get_db),
    user: AdminUser = Depends(require_role("admin")),
):
    return svc.create_automation(db, payload=payload, created_by=user.id)


@router.get("/{automation_id}", response_model=GiftAutomationRead)
def get_automation(automation_id: str, db: Session = Depends(get_db), user: AdminUser = Depends(require_role("admin"))):
    return _get_or_404(db, automation_id)


@router.patch("/{automation_id}", response_model=GiftAutomationRead)
def update_automation(
    automation_id: str,
    payload: GiftAutomationUpdate,
    db: Session = Depends(get_db),
    user: AdminUser = Depends(require_role("admin")),
):
    return svc.update_automation(db, _get_or_404(db, automation_id), payload)


@router.delete("/{automation_id}", status_code=204)
def delete_automation(automation_id: str, db: Session = Depends(get_db), user: AdminUser = Depends(require_role("admin"))):
    svc.delete_automation(db, _get_or_404(db, automation_id))
    return Response(status_code=status.HTTP_204_NO_CONTENT)
