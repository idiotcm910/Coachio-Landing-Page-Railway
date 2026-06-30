"""Pydantic schemas for Funnel admin CRUD, landing/SEO, sections, variables, clone,
and the public landing response (resolved payload served via the write-through cache).
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.schemas.variable_meta import validate_variables_meta


class FunnelTrackingConfig(BaseModel):
    """Per-funnel Meta Pixel + CAPI config stored as JSON on funnels.tracking_config.

    meta_capi_token is treated as a secret: never expose in public payloads;
    admin read returns it (owner-scoped admin only) — masking optional per D1.
    """
    meta_pixel_id: Optional[str] = Field(None, max_length=64)
    meta_capi_token: Optional[str] = Field(None, max_length=512)
    meta_test_event_code: Optional[str] = Field(None, max_length=64)
    enabled: bool = False


class FunnelTrackingDefaults(BaseModel):
    """Non-secret view of the global env tracking defaults for the admin UI.

    Lets the tracking workspace tell whether a funnel is reporting to the global
    default dataset or a custom override. Never carries the CAPI token value.
    """
    configured: bool  # both default pixel id + CAPI token are set in the env
    meta_pixel_id: Optional[str] = None
    has_capi_token: bool = False
    has_test_event_code: bool = False

FUNNEL_STATUSES = {"draft", "published", "archived"}

# Reserved default-variable keys (D13 v1 fixed set) — custom vars cannot override them
DEFAULT_VARIABLE_KEYS = {
    "product_name",
    "funnel_title",
    "price",
    # Funnel-level price after the funnel's default stackable discount + the total
    # default discount percent. Landing-safe (no buyer) and baked into the cache.
    "discounted_price",
    "discount_percent",
    "checkout_url",
    "success_url",
    "zalo_link",
}


def _reject_reserved_keys(variables: Optional[dict]) -> Optional[dict]:
    if variables:
        reserved = set(variables) & DEFAULT_VARIABLE_KEYS
        if reserved:
            raise ValueError(f"Custom variables cannot override reserved default keys: {sorted(reserved)}")
    return variables


# Admin-authored thank-you HTML lives in success_config.html. Length-capped like
# landing sections (not nh3-stripped — isolated in a srcdoc iframe on render).
SUCCESS_HTML_MAX_LENGTH = 400_000


def _cap_success_html(success_config: Optional[dict]) -> Optional[dict]:
    if success_config:
        html = success_config.get("html")
        if isinstance(html, str) and len(html) > SUCCESS_HTML_MAX_LENGTH:
            raise ValueError(f"success_config.html exceeds {SUCCESS_HTML_MAX_LENGTH} characters")
    return success_config


class FunnelCreate(BaseModel):
    product_id: str = Field(..., min_length=1)
    title: str = Field(..., min_length=1, max_length=255)
    slug: str = Field(..., min_length=1, max_length=255, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
    currency: str = Field("VND", max_length=10)
    checkout_config: Optional[dict] = None
    success_config: Optional[dict] = None
    zalo_link: Optional[str] = Field(None, max_length=1024)
    variables: Optional[dict[str, str]] = None
    variables_meta: Optional[dict[str, dict]] = None

    _validate_variables = field_validator("variables")(_reject_reserved_keys)
    _validate_success_html = field_validator("success_config")(_cap_success_html)

    @model_validator(mode="after")
    def _validate_meta(self) -> "FunnelCreate":
        validate_variables_meta(self.variables, self.variables_meta, DEFAULT_VARIABLE_KEYS)
        return self


class FunnelUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    slug: Optional[str] = Field(None, min_length=1, max_length=255, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
    status: Optional[str] = Field(None, max_length=50)
    currency: Optional[str] = Field(None, max_length=10)
    checkout_config: Optional[dict] = None
    success_config: Optional[dict] = None
    zalo_link: Optional[str] = Field(None, max_length=1024)
    variables: Optional[dict[str, str]] = None
    variables_meta: Optional[dict[str, dict]] = None
    # Tracking config accepts raw FunnelTrackingConfig dict from admin UI
    tracking_config: Optional[FunnelTrackingConfig] = None

    _validate_variables = field_validator("variables")(_reject_reserved_keys)
    _validate_success_html = field_validator("success_config")(_cap_success_html)

    @model_validator(mode="after")
    def _validate_meta(self) -> "FunnelUpdate":
        validate_variables_meta(self.variables, self.variables_meta, DEFAULT_VARIABLE_KEYS)
        return self

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in FUNNEL_STATUSES:
            raise ValueError(f"status must be one of {sorted(FUNNEL_STATUSES)}")
        return v


class FunnelRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    product_id: str
    title: str
    slug: str
    status: str
    currency: str
    checkout_config: Optional[dict] = None
    success_config: Optional[dict] = None
    zalo_link: Optional[str] = None
    variables: Optional[dict] = None
    variables_meta: Optional[dict] = None
    # tracking_config returned to admin (owner-scoped); raw token included for admin edit UX.
    # Decision D1: keeping raw token on admin read (simplifies edit UX); flag has_capi_token
    # is surfaced alongside so UI can show masked hint without parsing the token.
    tracking_config: Optional[dict] = None
    published_at: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime] = None


class FunnelListResponse(BaseModel):
    items: list[FunnelRead]
    total: int


class FunnelCloneRequest(BaseModel):
    """Clone copies everything; new slug + title, status draft, counters reset (D6)."""

    slug: str = Field(..., min_length=1, max_length=255, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
    title: Optional[str] = Field(None, min_length=1, max_length=255)


# ─── Landing page (SEO, D14) ────────────────────────────────────────────────


class FunnelLandingSeoUpdate(BaseModel):
    seo_title: Optional[str] = Field(None, max_length=255)
    seo_description: Optional[str] = Field(None, max_length=500)
    seo_keywords: Optional[str] = Field(None, max_length=500)
    canonical_url: Optional[str] = Field(None, max_length=1024)
    robots_index: Optional[bool] = None
    robots_follow: Optional[bool] = None
    og_title: Optional[str] = Field(None, max_length=255)
    og_description: Optional[str] = Field(None, max_length=500)
    og_image_url: Optional[str] = Field(None, max_length=1024)
    og_type: Optional[str] = Field(None, max_length=50)
    twitter_card: Optional[str] = Field(None, max_length=50)
    twitter_title: Optional[str] = Field(None, max_length=255)
    twitter_description: Optional[str] = Field(None, max_length=500)
    twitter_image_url: Optional[str] = Field(None, max_length=1024)
    favicon_url: Optional[str] = Field(None, max_length=1024)


class FunnelLandingRead(FunnelLandingSeoUpdate):
    model_config = ConfigDict(from_attributes=True)

    id: str
    funnel_id: str
    robots_index: bool = True
    robots_follow: bool = True
    theme_config: Optional[dict] = None
    settings: Optional[dict] = None


# ─── Landing sections (mirror course landing sections, D10) ─────────────────


def normalize_anchor(v: Optional[str]) -> Optional[str]:
    """Slugify an optional section anchor: lowercase, dashes, [a-z0-9-] only.

    Empty/whitespace → None (no anchor). Shared by funnel + course section schemas.
    """
    if v is None:
        return None
    import re

    slug = re.sub(r"[^a-z0-9]+", "-", v.strip().lower()).strip("-")
    return slug or None


class FunnelSectionCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=150)
    html: str = Field("", max_length=400_000)
    theme_mode: str = Field("light", max_length=20)
    section_type: str = Field("custom", max_length=50)
    anchor: Optional[str] = Field(None, max_length=80)
    responsive_config: Optional[dict] = None
    sort_order: int = 0
    is_visible: bool = True

    _normalize_anchor = field_validator("anchor")(normalize_anchor)


class FunnelSectionUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=150)
    html: Optional[str] = Field(None, max_length=400_000)
    theme_mode: Optional[str] = Field(None, max_length=20)
    section_type: Optional[str] = Field(None, max_length=50)
    anchor: Optional[str] = Field(None, max_length=80)
    responsive_config: Optional[dict] = None
    sort_order: Optional[int] = None
    is_visible: Optional[bool] = None

    _normalize_anchor = field_validator("anchor")(normalize_anchor)


class FunnelSectionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    landing_page_id: str
    name: str
    html: str
    theme_mode: str
    section_type: str
    anchor: Optional[str] = None
    responsive_config: Optional[dict] = None
    sort_order: int
    is_visible: bool


class FunnelSectionReorderRequest(BaseModel):
    """Ordered section ids → new sort_order assignment."""

    section_ids: list[str] = Field(..., min_length=1)


# ─── Public landing response (cached payload shape, D16) ────────────────────


class PublicFunnelSection(BaseModel):
    id: str
    name: str
    html: str  # variables already resolved server-side
    theme_mode: str
    section_type: str
    anchor: Optional[str] = None
    responsive_config: Optional[dict] = None
    sort_order: int


class PublicFunnelSeo(BaseModel):
    seo_title: Optional[str] = None
    seo_description: Optional[str] = None
    seo_keywords: Optional[str] = None
    canonical_url: Optional[str] = None
    robots_index: bool = True
    robots_follow: bool = True
    og_title: Optional[str] = None
    og_description: Optional[str] = None
    og_image_url: Optional[str] = None
    og_type: Optional[str] = None
    twitter_card: Optional[str] = None
    twitter_title: Optional[str] = None
    twitter_description: Optional[str] = None
    twitter_image_url: Optional[str] = None
    favicon_url: Optional[str] = None


class PublicFunnelLandingResponse(BaseModel):
    """Fully-resolved public landing payload — exactly what the cache stores."""

    funnel_id: str
    slug: str
    title: str
    product_name: str
    currency: str
    price: int
    final_price: int
    zalo_link: Optional[str] = None
    seo: PublicFunnelSeo
    sections: list[PublicFunnelSection]
    variables: dict[str, str]
    # Meta Pixel fields — CAPI token NEVER included here (D1, tracking spec)
    meta_pixel_id: Optional[str] = None
    tracking_enabled: bool = False
