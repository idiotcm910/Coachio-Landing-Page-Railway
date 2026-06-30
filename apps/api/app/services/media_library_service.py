"""Media Library service — catalogs S3 uploads into `media_assets`.

Wraps the existing `S3StorageService` (storage layer) and adds the catalog
concern: validate → upload to S3 → persist metadata; plus list/search/delete.
The library is global (no funnel/course coupling), reusable across surfaces.
"""
import os
import uuid as _uuid
from typing import Optional, Tuple

from fastapi import HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.models.media_asset import MediaAsset
from app.services.storage_service import storage_service
from app.utils.constants import ALLOWED_EXTENSIONS, ALLOWED_MIME_TYPES, MAX_FILE_SIZE

_MEDIA_NAMESPACE = "media-library"


def _kind_from_content_type(content_type: Optional[str]) -> str:
    """Coarse media kind for filtering — only "image" is special for now."""
    if content_type and content_type.startswith("image/"):
        return "image"
    return "other"


class MediaLibraryService:
    """Catalog + storage orchestration for the admin media library."""

    def _validate(self, file: UploadFile) -> None:
        file_ext = os.path.splitext(file.filename or "")[1].lower()
        if file_ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid file type. Supported formats: {', '.join(sorted(ALLOWED_EXTENSIONS))}",
            )
        if file.content_type not in ALLOWED_MIME_TYPES:
            raise HTTPException(
                status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                detail=f"Unsupported media type: {file.content_type}",
            )

    def _build_object_key(self, file: UploadFile) -> str:
        file_ext = os.path.splitext(file.filename or "")[1].lstrip(".").lower()
        suffix = f".{file_ext}" if file_ext else ""
        return f"{_MEDIA_NAMESPACE}/{_uuid.uuid4()}{suffix}"

    async def create_from_upload(
        self,
        db: Session,
        file: UploadFile,
        uploader_id: Optional[str],
    ) -> MediaAsset:
        """Validate, upload to S3, then persist a `media_assets` row."""
        self._validate(file)

        file_content = await file.read()
        file_size = len(file_content)
        if file_size == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot upload empty file",
            )
        if file_size > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"File size ({file_size / 1024 / 1024:.2f}MB) exceeds the 15MB limit",
            )

        object_key = self._build_object_key(file)
        url = await storage_service.upload_file_from_bytes(
            file_content=file_content,
            object_key=object_key,
        )

        asset = MediaAsset(
            object_key=object_key,
            url=url,
            content_type=file.content_type,
            kind=_kind_from_content_type(file.content_type),
            file_size=file_size,
            original_filename=file.filename,
            uploaded_by=uploader_id,
        )
        db.add(asset)
        db.commit()
        db.refresh(asset)
        return asset

    def list(
        self,
        db: Session,
        page: int = 1,
        page_size: int = 24,
        kind: Optional[str] = None,
        search: Optional[str] = None,
    ) -> Tuple[list, int]:
        """Return (items, total) ordered by created_at desc, with filters."""
        page = max(1, page)
        page_size = max(1, min(page_size, 100))

        query = db.query(MediaAsset)
        if kind:
            query = query.filter(MediaAsset.kind == kind)
        if search:
            query = query.filter(MediaAsset.original_filename.ilike(f"%{search}%"))

        total = query.count()
        items = (
            query.order_by(MediaAsset.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
            .all()
        )
        return items, total

    async def delete(self, db: Session, asset_id: str) -> None:
        """Remove the S3 object first, then the catalog record.

        S3 removal failure raises → the record is kept and no success is
        reported (avoids orphaning the file silently).
        """
        asset = db.query(MediaAsset).filter(MediaAsset.id == asset_id).first()
        if asset is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Media asset not found",
            )

        await storage_service.delete_object(asset.object_key)

        db.delete(asset)
        db.commit()


media_library_service = MediaLibraryService()
