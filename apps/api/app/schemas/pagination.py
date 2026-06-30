from typing import Any

from pydantic import BaseModel, Field


class Meta(BaseModel):
    page: int
    page_size: int = Field(..., serialization_alias="pageSize")
    total_pages: int = Field(..., serialization_alias="totalPages")
    total_items: int = Field(..., serialization_alias="totalItems")


class PaginationDTOResponse(BaseModel):
    meta: Meta
    result: list[Any]