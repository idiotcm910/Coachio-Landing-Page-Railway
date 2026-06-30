"""Pydantic schemas for the Media Library API (admin)."""
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


class MediaAssetResponse(BaseModel):
    """A single catalogued media asset."""
    id: str
    object_key: str
    url: str = Field(..., description="Public CDN/S3 URL — reusable in HTML/email/SEO")
    content_type: Optional[str] = None
    kind: str = Field(..., description='"image" | "other"')
    file_size: Optional[int] = Field(None, description="File size in bytes")
    original_filename: Optional[str] = None
    uploaded_by: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class MediaListResponse(BaseModel):
    """Paginated media listing."""
    items: List[MediaAssetResponse]
    total: int
    page: int
    page_size: int
