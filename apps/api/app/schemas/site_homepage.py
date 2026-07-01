"""Site-homepage schemas (funnel-only edition).

The homepage is stored in the generic `site_settings` table under key `homepage`
as JSON `{"target_type": "funnel", "target_id": "<id>"}`. Absence of the row (or
an empty/invalid value) means the default homepage is served.
"""
from typing import Literal, Optional

from pydantic import BaseModel

from app.schemas.funnel import PublicFunnelLandingResponse

HomepageTargetType = Literal["funnel"]


class HomepageOption(BaseModel):
    """A selectable homepage target (a published funnel landing)."""

    type: HomepageTargetType
    id: str  # funnel id
    title: str
    slug: str


class HomepageOptionsResponse(BaseModel):
    funnels: list[HomepageOption]


class SiteHomepageSetRequest(BaseModel):
    target_type: HomepageTargetType
    target_id: str


class SiteHomepageAdminResponse(BaseModel):
    """Current homepage selection for the admin menu (None = default homepage)."""

    target_type: Optional[HomepageTargetType] = None
    target_id: Optional[str] = None
    title: Optional[str] = None
    slug: Optional[str] = None


class PublicHomepageResponse(BaseModel):
    """Discriminated resolved homepage payload consumed by the public root `/`."""

    type: Literal["funnel", "none"]
    funnel: Optional[PublicFunnelLandingResponse] = None
