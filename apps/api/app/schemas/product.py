"""Pydantic schemas for the generic Product entity (admin CRUD)."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

PRODUCT_TYPES = {"digital", "service"}
PRODUCT_STATUSES = {"draft", "active", "archived"}


class ProductCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    slug: str = Field(..., min_length=1, max_length=255, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
    description: Optional[str] = None
    base_price: int = Field(0, ge=0, description="Integer VND")
    type: str = Field(..., min_length=1, max_length=50)
    status: str = Field("draft", max_length=50)
    thumbnail_url: Optional[str] = Field(None, max_length=1024)


class ProductUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    slug: Optional[str] = Field(None, min_length=1, max_length=255, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
    description: Optional[str] = None
    base_price: Optional[int] = Field(None, ge=0)
    type: Optional[str] = Field(None, min_length=1, max_length=50)
    status: Optional[str] = Field(None, max_length=50)
    thumbnail_url: Optional[str] = Field(None, max_length=1024)


class ProductRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    slug: str
    description: Optional[str] = None
    base_price: int
    type: str
    status: str
    thumbnail_url: Optional[str] = None
    source_id: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None


class ProductListResponse(BaseModel):
    items: list[ProductRead]
    total: int
