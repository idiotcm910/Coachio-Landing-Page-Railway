"""Pydantic schemas for gift campaigns (mechanism 2) and their send jobs."""
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.schemas.gift import GiftAudienceConfig


class GiftCampaignCreate(BaseModel):
    name: str
    gift_ids: list[str] = Field(default_factory=list)
    email_subject: str = ""
    email_html: str = ""
    audience_config: GiftAudienceConfig | None = None
    scheduled_at: datetime | None = None


class GiftCampaignUpdate(BaseModel):
    name: str | None = None
    gift_ids: list[str] | None = None
    email_subject: str | None = None
    email_html: str | None = None
    audience_config: GiftAudienceConfig | None = None
    scheduled_at: datetime | None = None


class GiftCampaignRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    gift_ids: list | None
    email_subject: str
    email_html: str
    audience_config: dict | None
    status: str
    scheduled_at: datetime | None
    snapshot_at: datetime | None
    total_recipients: int
    sent_count: int
    failed_count: int
    skipped_count: int
    last_error: str | None
    started_at: datetime | None
    completed_at: datetime | None
    created_at: datetime
    updated_at: datetime | None


class GiftRecipientSample(BaseModel):
    email: str
    name: str | None = None


class GiftAudiencePreview(BaseModel):
    """Recipient breakdown shown before confirming a campaign."""
    matched: int
    already_granted: int
    will_receive: int
    sample: list[GiftRecipientSample] = Field(default_factory=list)


class GiftAudiencePreviewRequest(BaseModel):
    """Unbound preview (pre-save): resolve a breakdown for gift(s) + audience."""
    gift_ids: list[str] = Field(default_factory=list)
    audience_config: GiftAudienceConfig | None = None


class GiftEmailPreviewRequest(BaseModel):
    """Render the delivery email with sample data + the selected gifts' contents."""
    gift_ids: list[str] = Field(default_factory=list)
    email_subject: str = ""
    email_html: str = ""


class GiftEmailTestSendRequest(GiftEmailPreviewRequest):
    to_email: EmailStr


class GiftSendJobRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    email: str
    name: str | None
    status: str
    attempts: int
    error: str | None
    sent_at: datetime | None


class GiftCampaignStats(BaseModel):
    total: int
    sent: int
    failed: int
    pending: int
    skipped: int
    last_error: str | None
    failed_jobs: list[GiftSendJobRead] = Field(default_factory=list)
    failed_total: int


class GiftSendRequest(BaseModel):
    scheduled_at: datetime | None = None


class GiftTestSendRequest(BaseModel):
    email: EmailStr
