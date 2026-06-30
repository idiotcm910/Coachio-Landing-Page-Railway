"""Admin URL redirect CRUD + 404 fallback config — /api/v1/admin/url-redirects."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.base import get_db
from app.middleware.auth import require_role
from app.models import UrlRedirect
from app.models.admin_user import AdminUser
from app.schemas.url_redirect import (
    NotFoundConfig,
    RedirectCreate,
    RedirectListResponse,
    RedirectRead,
    RedirectUpdate,
)
from app.services import url_redirect_service as svc

router = APIRouter()


# --- 404 fallback config (declared before /{rule_id} to avoid path capture) ----

@router.get("/not-found-config", response_model=NotFoundConfig)
def get_not_found_config(
    db: Session = Depends(get_db),
    current_user: AdminUser = Depends(require_role("admin")),
):
    return NotFoundConfig(**svc.get_not_found_config(db))


@router.put("/not-found-config", response_model=NotFoundConfig)
def update_not_found_config(
    payload: NotFoundConfig,
    db: Session = Depends(get_db),
    current_user: AdminUser = Depends(require_role("admin")),
):
    saved = svc.set_not_found_config(db, payload.enabled, payload.target_url)
    return NotFoundConfig(**saved)


# --- Redirect rules CRUD -------------------------------------------------------

@router.get("", response_model=RedirectListResponse)
def list_redirects(
    db: Session = Depends(get_db),
    current_user: AdminUser = Depends(require_role("admin")),
):
    items = svc.list_rules(db)
    return RedirectListResponse(items=items, total=len(items))


@router.post("", response_model=RedirectRead, status_code=status.HTTP_201_CREATED)
def create_redirect(
    payload: RedirectCreate,
    db: Session = Depends(get_db),
    current_user: AdminUser = Depends(require_role("admin")),
):
    if svc.source_exists(db, payload.source_path):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="source_path already exists")
    rule = UrlRedirect(**payload.model_dump(), created_by=current_user.id)
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return rule


@router.patch("/{rule_id}", response_model=RedirectRead)
def update_redirect(
    rule_id: str,
    payload: RedirectUpdate,
    db: Session = Depends(get_db),
    current_user: AdminUser = Depends(require_role("admin")),
):
    rule = svc.get_rule(db, rule_id)
    if rule is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Redirect not found")
    updates = payload.model_dump(exclude_unset=True)
    new_source = updates.get("source_path")
    if new_source and new_source != rule.source_path and svc.source_exists(db, new_source, exclude_id=rule_id):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="source_path already exists")
    for key, value in updates.items():
        setattr(rule, key, value)
    db.commit()
    db.refresh(rule)
    return rule


@router.delete("/{rule_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_redirect(
    rule_id: str,
    db: Session = Depends(get_db),
    current_user: AdminUser = Depends(require_role("admin")),
):
    rule = svc.get_rule(db, rule_id)
    if rule is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Redirect not found")
    db.delete(rule)
    db.commit()
