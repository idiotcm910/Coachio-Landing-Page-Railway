"""Admin funnel landing editing — /api/v1/admin/funnels/{id}/landing (task 6.6).

Sections + full SEO (D14), mirroring the course landing editing operations so
the FE builder can be parameterized by owner. Every write goes through
`refresh_funnel_landing_cache` (write-through, D16). Landing HTML follows the
course builder behavior: length-validated, NOT nh3-stripped (renders inside an
isolated iframe on the FE).
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.v1.endpoints.admin.funnels import get_funnel_or_404
from app.db.base import get_db
from app.middleware.auth import require_role
from app.models import FunnelLandingPage, FunnelSection
from app.models.admin_user import AdminUser
from app.schemas.funnel import (
    FunnelLandingRead,
    FunnelLandingSeoUpdate,
    FunnelSectionCreate,
    FunnelSectionRead,
    FunnelSectionReorderRequest,
    FunnelSectionUpdate,
    PublicFunnelLandingResponse,
)
from app.services.funnel_landing_service import (
    build_public_landing_payload,
    refresh_funnel_landing_cache,
)

router = APIRouter()


def _get_or_create_landing(db: Session, funnel_id: str) -> FunnelLandingPage:
    landing = db.query(FunnelLandingPage).filter(FunnelLandingPage.funnel_id == funnel_id).first()
    if landing is not None:
        return landing

    # First-time create. Two concurrent GETs (landing tab + SEO modal on page load)
    # can both miss the SELECT and race the INSERT — the loser hits the unique
    # constraint on funnel_id. Catch it, roll back, and return the row the winner
    # created instead of 500-ing.
    landing = FunnelLandingPage(funnel_id=funnel_id)
    db.add(landing)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        landing = db.query(FunnelLandingPage).filter(FunnelLandingPage.funnel_id == funnel_id).first()
        if landing is None:
            raise  # not the race we expected — surface the real error
        return landing
    db.refresh(landing)
    return landing


def _validate_anchor_unique(
    landing: FunnelLandingPage, anchor: str | None, exclude_section_id: str | None = None
) -> None:
    """Anchors must be unique among the sections of one landing page (None = no anchor)."""
    if not anchor:
        return
    for s in landing.sections:
        if s.id != exclude_section_id and s.anchor == anchor:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Anchor '{anchor}' is already used by another section",
            )


def _get_section(db: Session, landing: FunnelLandingPage, section_id: str) -> FunnelSection:
    section = (
        db.query(FunnelSection)
        .filter(FunnelSection.id == section_id, FunnelSection.landing_page_id == landing.id)
        .first()
    )
    if section is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Section not found")
    return section


@router.get("/{funnel_id}/preview", response_model=PublicFunnelLandingResponse)
def preview_landing(
    funnel_id: str,
    db: Session = Depends(get_db),
    current_user: AdminUser = Depends(require_role("admin")),
):
    """Admin-only preview of the public landing for a funnel of ANY status
    (including draft/unpublished), so admins can review before publishing.

    Builds the payload directly from the DB and never reads/writes the
    landing cache (mirrors how drafts already skip the cache). Does not change
    the funnel's publish status."""
    funnel = get_funnel_or_404(db, funnel_id)
    return build_public_landing_payload(db, funnel)


@router.get("/{funnel_id}/landing", response_model=FunnelLandingRead)
def get_landing(
    funnel_id: str,
    db: Session = Depends(get_db),
    current_user: AdminUser = Depends(require_role("admin")),
):
    get_funnel_or_404(db, funnel_id)
    return _get_or_create_landing(db, funnel_id)


@router.patch("/{funnel_id}/landing", response_model=FunnelLandingRead)
def update_landing_seo(
    funnel_id: str,
    payload: FunnelLandingSeoUpdate,
    db: Session = Depends(get_db),
    current_user: AdminUser = Depends(require_role("admin")),
):
    """Full SEO options (D14): meta/canonical/robots/OG/Twitter/favicon."""
    funnel = get_funnel_or_404(db, funnel_id)
    landing = _get_or_create_landing(db, funnel_id)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(landing, key, value)
    db.commit()
    db.refresh(landing)
    refresh_funnel_landing_cache(db, funnel)
    return landing


@router.get("/{funnel_id}/landing/sections", response_model=list[FunnelSectionRead])
def list_sections(
    funnel_id: str,
    db: Session = Depends(get_db),
    current_user: AdminUser = Depends(require_role("admin")),
):
    get_funnel_or_404(db, funnel_id)
    landing = _get_or_create_landing(db, funnel_id)
    return landing.sections


@router.post("/{funnel_id}/landing/sections", response_model=FunnelSectionRead, status_code=status.HTTP_201_CREATED)
def create_section(
    funnel_id: str,
    payload: FunnelSectionCreate,
    db: Session = Depends(get_db),
    current_user: AdminUser = Depends(require_role("admin")),
):
    funnel = get_funnel_or_404(db, funnel_id)
    landing = _get_or_create_landing(db, funnel_id)
    _validate_anchor_unique(landing, payload.anchor)
    section = FunnelSection(landing_page_id=landing.id, **payload.model_dump())
    db.add(section)
    db.commit()
    db.refresh(section)
    refresh_funnel_landing_cache(db, funnel)
    return section


@router.patch("/{funnel_id}/landing/sections/{section_id}", response_model=FunnelSectionRead)
def update_section(
    funnel_id: str,
    section_id: str,
    payload: FunnelSectionUpdate,
    db: Session = Depends(get_db),
    current_user: AdminUser = Depends(require_role("admin")),
):
    funnel = get_funnel_or_404(db, funnel_id)
    landing = _get_or_create_landing(db, funnel_id)
    section = _get_section(db, landing, section_id)
    fields = payload.model_dump(exclude_unset=True)
    if "anchor" in fields:
        _validate_anchor_unique(landing, fields["anchor"], exclude_section_id=section_id)
    for key, value in fields.items():
        setattr(section, key, value)
    db.commit()
    db.refresh(section)
    refresh_funnel_landing_cache(db, funnel)
    return section


@router.delete("/{funnel_id}/landing/sections/{section_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_section(
    funnel_id: str,
    section_id: str,
    db: Session = Depends(get_db),
    current_user: AdminUser = Depends(require_role("admin")),
):
    funnel = get_funnel_or_404(db, funnel_id)
    landing = _get_or_create_landing(db, funnel_id)
    db.delete(_get_section(db, landing, section_id))
    db.commit()
    refresh_funnel_landing_cache(db, funnel)


@router.put("/{funnel_id}/landing/sections/reorder", response_model=list[FunnelSectionRead])
def reorder_sections(
    funnel_id: str,
    payload: FunnelSectionReorderRequest,
    db: Session = Depends(get_db),
    current_user: AdminUser = Depends(require_role("admin")),
):
    funnel = get_funnel_or_404(db, funnel_id)
    landing = _get_or_create_landing(db, funnel_id)
    for index, section_id in enumerate(payload.section_ids):
        _get_section(db, landing, section_id).sort_order = index
    db.commit()
    db.refresh(landing)
    refresh_funnel_landing_cache(db, funnel)
    return landing.sections
