"""Admin site-homepage management — /api/v1/admin/site-homepage.

Centralized control over which published funnel landing is the public homepage.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.base import get_db
from app.middleware.auth import require_role
from app.models.admin_user import AdminUser
from app.schemas.site_homepage import (
    HomepageOptionsResponse,
    SiteHomepageAdminResponse,
    SiteHomepageSetRequest,
)
from app.services import site_homepage_service as svc

router = APIRouter()


@router.get("", response_model=SiteHomepageAdminResponse)
def get_site_homepage(
    db: Session = Depends(get_db),
    current_user: AdminUser = Depends(require_role("admin")),
):
    return SiteHomepageAdminResponse(**svc.get_admin_setting(db))


@router.get("/options", response_model=HomepageOptionsResponse)
def list_homepage_options(
    db: Session = Depends(get_db),
    current_user: AdminUser = Depends(require_role("admin")),
):
    return HomepageOptionsResponse(**svc.list_options(db))


@router.put("", response_model=SiteHomepageAdminResponse)
def set_site_homepage(
    payload: SiteHomepageSetRequest,
    db: Session = Depends(get_db),
    current_user: AdminUser = Depends(require_role("admin")),
):
    return SiteHomepageAdminResponse(**svc.set_target(db, payload.target_type, payload.target_id))


@router.delete("", response_model=SiteHomepageAdminResponse)
def clear_site_homepage(
    db: Session = Depends(get_db),
    current_user: AdminUser = Depends(require_role("admin")),
):
    return SiteHomepageAdminResponse(**svc.clear_target(db))
