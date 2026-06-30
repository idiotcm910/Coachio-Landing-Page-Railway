"""Admin Funnel CRUD + clone — /api/v1/admin/funnels (tasks 6.2, 6.3).

Every write that affects the public landing calls
`refresh_funnel_landing_cache` (single write-through helper, D16); slug change
and unpublish/delete evict the old key. Landing/SEO/section editing lives in
`funnel_landings.py`.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.base import get_db
from app.middleware.auth import require_role
from app.models import Funnel, Product
from app.models.admin_user import AdminUser
from app.schemas.funnel import (
    FunnelCloneRequest,
    FunnelCreate,
    FunnelListResponse,
    FunnelRead,
    FunnelTrackingConfig,
    FunnelTrackingDefaults,
    FunnelUpdate,
)
from app.schemas.funnel_lead_capture import FunnelCaptureTokenRead
from app.services.funnel_capture_token_service import (
    get_or_create_capture_token,
    rotate_capture_token,
)
from app.services.funnel_clone_service import clone_funnel
from app.services.funnel_landing_service import (
    evict_funnel_landing_cache,
    refresh_funnel_landing_cache,
)

router = APIRouter()


def _default_tracking_config() -> dict | None:
    """Build a tracking_config seeded from global env defaults for a NEW funnel.

    Returns the config dict (enabled) only when both a default pixel id and CAPI
    token are configured; otherwise None so the funnel starts with tracking off.
    """
    pixel_id = (settings.META_DEFAULT_PIXEL_ID or "").strip()
    capi_token = (settings.META_DEFAULT_CAPI_TOKEN or "").strip()
    if not pixel_id or not capi_token:
        return None
    test_code = (settings.META_DEFAULT_TEST_EVENT_CODE or "").strip() or None
    return FunnelTrackingConfig(
        meta_pixel_id=pixel_id,
        meta_capi_token=capi_token,
        meta_test_event_code=test_code,
        enabled=True,
    ).model_dump()


def get_funnel_or_404(db: Session, funnel_id: str) -> Funnel:
    funnel = db.query(Funnel).filter(Funnel.id == funnel_id).first()
    if funnel is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Funnel not found")
    return funnel


@router.get("", response_model=FunnelListResponse)
def list_funnels(
    product_id: str | None = Query(None),
    status_filter: str | None = Query(None, alias="status"),
    db: Session = Depends(get_db),
    current_user: AdminUser = Depends(require_role("admin")),
):
    query = db.query(Funnel)
    if product_id:
        query = query.filter(Funnel.product_id == product_id)
    if status_filter:
        query = query.filter(Funnel.status == status_filter)
    items = query.order_by(Funnel.created_at.desc()).all()
    return FunnelListResponse(items=items, total=len(items))


@router.post("", response_model=FunnelRead, status_code=status.HTTP_201_CREATED)
def create_funnel(
    payload: FunnelCreate,
    db: Session = Depends(get_db),
    current_user: AdminUser = Depends(require_role("admin")),
):
    if db.query(Product).filter(Product.id == payload.product_id).first() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    if db.query(Funnel).filter(Funnel.slug == payload.slug).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Slug already in use")
    funnel = Funnel(**payload.model_dump(), created_by=current_user.id)
    # Auto-provision Meta tracking from global env defaults (creation only).
    funnel.tracking_config = _default_tracking_config()
    db.add(funnel)
    db.commit()
    db.refresh(funnel)
    return funnel


@router.get("/tracking-defaults", response_model=FunnelTrackingDefaults)
def get_tracking_defaults(current_user: AdminUser = Depends(require_role("admin"))):
    """Expose the global Meta tracking defaults (non-secret) so the admin UI can
    show whether a funnel is using the default dataset or a custom override.
    Never returns the CAPI token value — only whether one is configured.
    """
    pixel_id = (settings.META_DEFAULT_PIXEL_ID or "").strip()
    capi_token = (settings.META_DEFAULT_CAPI_TOKEN or "").strip()
    test_code = (settings.META_DEFAULT_TEST_EVENT_CODE or "").strip()
    return FunnelTrackingDefaults(
        configured=bool(pixel_id and capi_token),
        meta_pixel_id=pixel_id or None,
        has_capi_token=bool(capi_token),
        has_test_event_code=bool(test_code),
    )


@router.get("/{funnel_id}", response_model=FunnelRead)
def get_funnel(
    funnel_id: str,
    db: Session = Depends(get_db),
    current_user: AdminUser = Depends(require_role("admin")),
):
    return get_funnel_or_404(db, funnel_id)


@router.patch("/{funnel_id}", response_model=FunnelRead)
def update_funnel(
    funnel_id: str,
    payload: FunnelUpdate,
    db: Session = Depends(get_db),
    current_user: AdminUser = Depends(require_role("admin")),
):
    funnel = get_funnel_or_404(db, funnel_id)
    updates = payload.model_dump(exclude_unset=True)
    old_slug = funnel.slug

    if "slug" in updates and updates["slug"] != funnel.slug:
        if db.query(Funnel).filter(Funnel.slug == updates["slug"]).first():
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Slug already in use")
    # tracking_config arrives as a validated Pydantic model; persist as plain dict to the JSON column
    if "tracking_config" in updates and updates["tracking_config"] is not None:
        updates["tracking_config"] = payload.tracking_config.model_dump()
    for key, value in updates.items():
        setattr(funnel, key, value)
    funnel.updated_by = current_user.id
    db.commit()
    db.refresh(funnel)

    # Write-through (D16): price/Zalo/variables/status/slug all affect the landing
    if old_slug != funnel.slug:
        evict_funnel_landing_cache(old_slug)
    refresh_funnel_landing_cache(db, funnel)
    return funnel


@router.delete("/{funnel_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_funnel(
    funnel_id: str,
    db: Session = Depends(get_db),
    current_user: AdminUser = Depends(require_role("admin")),
):
    funnel = get_funnel_or_404(db, funnel_id)
    slug = funnel.slug
    db.delete(funnel)
    db.commit()
    evict_funnel_landing_cache(slug)


@router.get("/{funnel_id}/capture-token", response_model=FunnelCaptureTokenRead)
def get_capture_token(
    funnel_id: str,
    db: Session = Depends(get_db),
    current_user: AdminUser = Depends(require_role("admin")),
):
    """Return the current capture token for a funnel (generate one if absent).

    The full token is returned so the admin can copy it into their HTML snippet.
    """
    funnel = get_funnel_or_404(db, funnel_id)
    token = get_or_create_capture_token(db, funnel)
    db.commit()
    return FunnelCaptureTokenRead(
        funnel_id=funnel.id,
        capture_token=token,
        capture_endpoint=f"{settings.API_V1_PREFIX}/public/funnels/leads/capture",
    )


@router.post("/{funnel_id}/capture-token/rotate", response_model=FunnelCaptureTokenRead)
def rotate_funnel_capture_token(
    funnel_id: str,
    db: Session = Depends(get_db),
    current_user: AdminUser = Depends(require_role("admin")),
):
    """Rotate the capture token — old token immediately stops authorizing captures."""
    funnel = get_funnel_or_404(db, funnel_id)
    token = rotate_capture_token(db, funnel)
    db.commit()
    return FunnelCaptureTokenRead(
        funnel_id=funnel.id,
        capture_token=token,
        capture_endpoint=f"{settings.API_V1_PREFIX}/public/funnels/leads/capture",
    )


@router.post("/{funnel_id}/clone", response_model=FunnelRead, status_code=status.HTTP_201_CREATED)
def clone_funnel_endpoint(
    funnel_id: str,
    payload: FunnelCloneRequest,
    db: Session = Depends(get_db),
    current_user: AdminUser = Depends(require_role("admin")),
):
    """Deep copy: content, config, discounts (counters reset), new slug, draft (D6)."""
    source = get_funnel_or_404(db, funnel_id)
    return clone_funnel(db, source, payload.slug, payload.title, current_user.id)
