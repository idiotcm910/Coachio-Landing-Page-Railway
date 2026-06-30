"""Pydantic schemas for admin URL redirects + 404 fallback config.

Validation rules (design D4):
  - source_path / target_url must be internal paths starting with '/'.
  - No external domains (reject 'http://' / 'https://').
  - source_path must not equal target_url (self-redirect guard).
  - wildcard rules: both source and target must end with '/*'.
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, model_validator

MATCH_TYPES = {"exact", "wildcard"}
STATUS_CODES = {301, 302}


def _validate_internal_path(value: str, field_name: str) -> str:
    if not value.startswith("/"):
        raise ValueError(f"{field_name} must be an internal path starting with '/'")
    if "http://" in value or "https://" in value:
        raise ValueError(f"{field_name} must not point to an external domain")
    return value


class _RedirectRuleBase(BaseModel):
    source_path: str = Field(..., min_length=1, max_length=500)
    target_url: str = Field(..., min_length=1, max_length=1024)
    match_type: str = Field("exact")
    status_code: int = Field(301)

    @model_validator(mode="after")
    def _check(self):
        _validate_internal_path(self.source_path, "source_path")
        _validate_internal_path(self.target_url, "target_url")
        if self.match_type not in MATCH_TYPES:
            raise ValueError("match_type must be 'exact' or 'wildcard'")
        if self.status_code not in STATUS_CODES:
            raise ValueError("status_code must be 301 or 302")
        if self.source_path == self.target_url:
            raise ValueError("source_path and target_url must not be identical (redirect loop)")
        if self.match_type == "wildcard":
            if not self.source_path.endswith("/*") or not self.target_url.endswith("/*"):
                raise ValueError("Wildcard rule requires source_path and target_url to end with '/*'")
        return self


class RedirectCreate(_RedirectRuleBase):
    is_active: bool = True


class RedirectUpdate(BaseModel):
    """Partial update — only is_active toggle is commonly used; full edit supported."""

    source_path: Optional[str] = Field(None, min_length=1, max_length=500)
    target_url: Optional[str] = Field(None, min_length=1, max_length=1024)
    match_type: Optional[str] = None
    status_code: Optional[int] = None
    is_active: Optional[bool] = None

    @model_validator(mode="after")
    def _check(self):
        if self.source_path is not None:
            _validate_internal_path(self.source_path, "source_path")
        if self.target_url is not None:
            _validate_internal_path(self.target_url, "target_url")
        if self.match_type is not None and self.match_type not in MATCH_TYPES:
            raise ValueError("match_type must be 'exact' or 'wildcard'")
        if self.status_code is not None and self.status_code not in STATUS_CODES:
            raise ValueError("status_code must be 301 or 302")
        if (
            self.source_path is not None
            and self.target_url is not None
            and self.source_path == self.target_url
        ):
            raise ValueError("source_path and target_url must not be identical (redirect loop)")
        return self


class RedirectRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    source_path: str
    target_url: str
    match_type: str
    status_code: int
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime] = None


class RedirectListResponse(BaseModel):
    items: list[RedirectRead]
    total: int


class NotFoundConfig(BaseModel):
    """404 fallback config (stored in site_settings key `not_found_redirect`)."""

    enabled: bool = False
    target_url: str = "/"

    @model_validator(mode="after")
    def _check(self):
        _validate_internal_path(self.target_url, "target_url")
        return self


class RedirectPublicConfig(BaseModel):
    """Read-only payload consumed by the Next.js middleware / not-found page."""

    rules: list[RedirectRead]
    not_found: NotFoundConfig
