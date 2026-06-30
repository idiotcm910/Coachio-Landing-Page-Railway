"""Pydantic schemas for lucky-draw events + form schema (funnel-lucky-draw).

Input field types: short_text, phone, email, rating, paragraph,
single_choice, multi_choice. Each input field carries {key, type, label,
required, options?, scale_max?}. Exactly one short_text field is the
display-name field.

Display (non-input) field types: rich_text (HTML `content`) and image
(`image_url` + optional `alt`). Display fields collect no answer, are never
required, and are excluded from the display-name rule.
"""

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

FIELD_TYPES = (
    "short_text",
    "phone",
    "email",
    "rating",
    "paragraph",
    "single_choice",
    "multi_choice",
    "rich_text",
    "image",
)

# Display-only blocks that never collect an answer.
DISPLAY_FIELD_TYPES = ("rich_text", "image")

FieldType = Literal[
    "short_text",
    "phone",
    "email",
    "rating",
    "paragraph",
    "single_choice",
    "multi_choice",
    "rich_text",
    "image",
]

EventStatus = Literal["draft", "open", "locked", "completed"]


class FormField(BaseModel):
    """A single registration form field."""

    key: str = Field(..., min_length=1, max_length=100)
    type: FieldType
    # Display fields (rich_text/image) may omit a label.
    label: str = Field("", max_length=255)
    required: bool = False
    # Choice fields carry options; rating fields carry scale_max.
    options: Optional[list[str]] = None
    scale_max: Optional[int] = Field(None, ge=2, le=10)
    # Display blocks: rich_text carries HTML `content`; image carries
    # `image_url` + optional `alt`.
    content: Optional[str] = None
    image_url: Optional[str] = Field(None, max_length=2000)
    alt: Optional[str] = Field(None, max_length=255)


class SuccessConfig(BaseModel):
    headline: Optional[str] = Field(None, max_length=255)
    message: Optional[str] = Field(None, max_length=2000)
    # Optional HTML; when set, it replaces headline+message on the success
    # screen. Sanitized on the public output before being returned.
    custom_html: Optional[str] = None


class LuckyEventCreate(BaseModel):
    funnel_id: str
    title: str = Field(..., min_length=1, max_length=255)
    slug: Optional[str] = Field(None, max_length=255)
    form_schema: Optional[list[FormField]] = None
    name_field_key: Optional[str] = None
    success_config: Optional[SuccessConfig] = None
    display_config: Optional[dict] = None


class LuckyEventUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    slug: Optional[str] = Field(None, max_length=255)
    form_schema: Optional[list[FormField]] = None
    name_field_key: Optional[str] = None
    success_config: Optional[SuccessConfig] = None
    display_config: Optional[dict] = None


class LuckyEventStatusUpdate(BaseModel):
    """Body for the open/lock status transition endpoint."""

    action: Literal["open", "lock"]


class LuckyEventRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    funnel_id: str
    title: str
    status: EventStatus
    public_token: Optional[str] = None
    slug: Optional[str] = None
    form_schema: Optional[list[FormField]] = None
    success_config: Optional[SuccessConfig] = None
    display_config: Optional[dict] = None
    name_field_key: Optional[str] = None
    opened_at: Optional[datetime] = None
    locked_at: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime] = None


class LuckyEventListItem(BaseModel):
    """Lighter list row with participant/winner counts."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    funnel_id: str
    title: str
    status: EventStatus
    participant_count: int = 0
    winner_count: int = 0
    created_at: datetime


class LuckyEventListResponse(BaseModel):
    items: list[LuckyEventListItem]
    total: int


class LuckyEventTokenRead(BaseModel):
    """Admin response with the public token + derived registration endpoint."""

    event_id: str
    public_token: Optional[str] = None
    register_endpoint: str


# --- Public (attendee-facing) schemas ---


class PublicLuckyEventResponse(BaseModel):
    """Returned to the public registration page (only when status=open)."""

    title: str
    status: EventStatus
    form_schema: list[FormField] = []
    name_field_key: Optional[str] = None
    success_config: Optional[SuccessConfig] = None


class PublicRegisterResponse(BaseModel):
    ok: bool = True
    success_config: Optional[SuccessConfig] = None
