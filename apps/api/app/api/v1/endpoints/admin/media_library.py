"""Admin Media Library — /api/v1/admin/media.

Global media catalog on S3: upload (catalogued), paginated list/search, delete.
Admin-only (require_role). Reusable across funnels, courses, emails, SEO.
"""
from typing import Optional

from fastapi import APIRouter, Depends, File, Query, UploadFile, status
from sqlalchemy.orm import Session

from app.db.base import get_db
from app.middleware.auth import require_role
from app.models.admin_user import AdminUser
from app.schemas.media_library import MediaAssetResponse, MediaListResponse
from app.services.media_library_service import media_library_service

router = APIRouter()


@router.post("", response_model=MediaAssetResponse, status_code=status.HTTP_201_CREATED)
async def upload_media(
    file: UploadFile = File(..., description="Media file (jpg, jpeg, png, webp, max 15MB)"),
    db: Session = Depends(get_db),
    current_user: AdminUser = Depends(require_role("admin")),
):
    """Upload a file to S3 and catalog it in the media library."""
    return await media_library_service.create_from_upload(
        db=db, file=file, uploader_id=current_user.id
    )


@router.get("", response_model=MediaListResponse)
def list_media(
    page: int = Query(1, ge=1),
    page_size: int = Query(24, ge=1, le=100),
    kind: Optional[str] = Query(None, description='Filter by kind: "image" | "other"'),
    search: Optional[str] = Query(None, description="Search by original filename"),
    db: Session = Depends(get_db),
    current_user: AdminUser = Depends(require_role("admin")),
):
    """Paginated, filterable listing of catalogued media (newest first)."""
    items, total = media_library_service.list(
        db=db, page=page, page_size=page_size, kind=kind, search=search
    )
    return MediaListResponse(items=items, total=total, page=page, page_size=page_size)


@router.delete("/{asset_id}")
async def delete_media(
    asset_id: str,
    db: Session = Depends(get_db),
    current_user: AdminUser = Depends(require_role("admin")),
):
    """Delete the S3 object and its catalog record."""
    await media_library_service.delete(db=db, asset_id=asset_id)
    return {"message": "Media asset deleted", "id": asset_id}
