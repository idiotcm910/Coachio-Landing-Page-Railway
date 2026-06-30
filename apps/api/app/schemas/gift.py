"""Pydantic schemas for gift packages, automations, audience, and grant tracking."""
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


# --- Gift package --------------------------------------------------------------
class ExternalItem(BaseModel):
    label: str
    url: str
    description: str | None = None


class GiftCreate(BaseModel):
    name: str
    description: str | None = None
    external_items: list[ExternalItem] = Field(default_factory=list)


class GiftUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    external_items: list[ExternalItem] | None = None
    is_archived: bool | None = None


class GiftRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    description: str | None
    # internal_config kept nullable in DB (deprecated, always null in OSS build)
    external_items: list | None
    is_archived: bool
    created_at: datetime
    updated_at: datetime | None


# --- Automation (mechanism 1) --------------------------------------------------
class GiftAutomationCreate(BaseModel):
    gift_ids: list[str] = Field(default_factory=list)
    funnel_id: str | None = None  # null = all funnels
    trigger_status: str  # purchased | subscribed | lead
    is_active: bool = True
    max_total_grants: int | None = None
    email_subject: str = ""
    email_html: str = ""


class GiftAutomationUpdate(BaseModel):
    gift_ids: list[str] | None = None
    funnel_id: str | None = None
    trigger_status: str | None = None
    is_active: bool | None = None
    max_total_grants: int | None = None
    email_subject: str | None = None
    email_html: str | None = None


class GiftAutomationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    gift_ids: list | None
    funnel_id: str | None
    trigger_status: str
    is_active: bool
    max_total_grants: int | None
    grants_count: int
    email_subject: str
    email_html: str
    created_at: datetime
    updated_at: datetime | None


# --- Audience (shared by gift campaigns) --------------------------------------
class GiftAudienceConfig(BaseModel):
    funnel_ids: list[str] = Field(default_factory=list)
    status: str | None = None  # purchased | subscribed | lead | None(any)
    date_field: str = "registration"  # registration | purchase
    date_from: datetime | None = None
    date_to: datetime | None = None
    # earliest_reg | latest_reg | earliest_purchase | latest_purchase | amount_desc
    order_by: str | None = None
    limit: int | None = None
    include_emails: list[str] = Field(default_factory=list)
    exclude_emails: list[str] = Field(default_factory=list)
    exclude_already_granted: bool = True
    # Advanced filters
    amount_min: float | None = None
    amount_max: float | None = None
    utm_source: str | None = None
    utm_campaign: str | None = None
    product_id: str | None = None
    has_account: bool | None = None


# --- Grant tracking / audit ----------------------------------------------------
class GiftGrantRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    gift_id: str
    email: str
    recipient_name: str | None
    recipient_phone: str | None
    source: str | None
    external_items_snapshot: list | None
    status: str
    email_status: str
    email_sent_at: datetime | None
    email_error: str | None
    resend_count: int
    granted_at: datetime


class GiftGrantDetail(GiftGrantRead):
    """Detail view adds the delivered snapshot + navigation context."""
    gift_name: str | None = None
    source_label: str | None = None  # human-readable order code / campaign name


class GiftPerGiftCount(BaseModel):
    gift_id: str
    gift_name: str | None = None
    count: int


class GiftGrantStats(BaseModel):
    total_grants: int
    distinct_recipients: int
    email_failed_count: int
    per_gift: list[GiftPerGiftCount] = Field(default_factory=list)


class GiftGrantListItem(GiftGrantRead):
    gift_name: str | None = None
    source_type: str | None = None  # auto | campaign


class GiftGrantListResponse(BaseModel):
    items: list[GiftGrantListItem] = Field(default_factory=list)
    total: int


class ResendResult(BaseModel):
    resent: int
    failed: int
