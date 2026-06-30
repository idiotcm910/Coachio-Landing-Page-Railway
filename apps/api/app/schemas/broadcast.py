"""Pydantic schemas for broadcast campaigns (spec §3, §4)."""
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class AudienceFilters(BaseModel):
    status: str | None = None  # "purchased" | "lead" | None
    converted: bool | None = None
    created_from: datetime | None = None
    created_to: datetime | None = None


class AudienceConfig(BaseModel):
    funnel_ids: list[str] = Field(default_factory=list)
    filters: AudienceFilters = Field(default_factory=AudienceFilters)


class BroadcastCampaignCreate(BaseModel):
    title: str
    subject: str
    html_body: str
    audience_config: AudienceConfig | None = None
    scheduled_at: datetime | None = None


class BroadcastCampaignUpdate(BaseModel):
    title: str | None = None
    subject: str | None = None
    html_body: str | None = None
    audience_config: AudienceConfig | None = None
    scheduled_at: datetime | None = None


class BroadcastCampaignRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    origin: str
    funnel_id: str | None
    title: str
    subject: str
    html_body: str
    audience_config: dict | None
    status: str
    scheduled_at: datetime | None
    total_recipients: int
    sent_count: int
    failed_count: int
    last_error: str | None
    started_at: datetime | None
    completed_at: datetime | None
    created_at: datetime
    updated_at: datetime | None


class AudiencePreview(BaseModel):
    count: int


class SendJobRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    email: str
    name: str | None
    status: str
    attempts: int
    error: str | None
    sent_at: datetime | None


class CampaignStats(BaseModel):
    total: int
    sent: int
    failed: int
    pending: int
    last_error: str | None
    failed_jobs: list[SendJobRead]
    failed_total: int


class SendRequest(BaseModel):
    scheduled_at: datetime | None = None


class TestSendRequest(BaseModel):
    email: EmailStr


class AudiencePreviewRequest(BaseModel):
    """Used by the GLOBAL (origin=admin) preview endpoint."""
    funnel_ids: list[str] = Field(default_factory=list)
    filters: AudienceFilters = Field(default_factory=AudienceFilters)
