"""Pydantic schemas for lucky-draw participants, prizes, winners, spin."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

# --- Participants ---


class ParticipantRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    event_id: str
    display_name: str
    phone: Optional[str] = None
    answers: Optional[dict] = None
    source: str
    created_at: datetime


class ParticipantListResponse(BaseModel):
    items: list[ParticipantRead]
    total: int


class ParticipantManualCreate(BaseModel):
    """Admin manual add — display name required, phone optional."""

    display_name: str = Field(..., min_length=1, max_length=255)
    phone: Optional[str] = Field(None, max_length=50)
    answers: Optional[dict] = None


# --- Prizes ---


class PrizeCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    quantity: int = Field(1, ge=1)
    sort_order: int = 0


class PrizeUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    quantity: Optional[int] = Field(None, ge=1)
    sort_order: Optional[int] = None


class PrizeRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    event_id: str
    name: str
    quantity: int
    sort_order: int
    awarded_count: int = 0


class PrizeListResponse(BaseModel):
    items: list[PrizeRead]
    total: int


# --- Winners + spin ---


class SpinRequest(BaseModel):
    prize_id: str


class WinnerRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    event_id: str
    prize_id: str
    prize_name: Optional[str] = None
    participant_id: str
    display_name: Optional[str] = None
    # Contact/identity derived from the participant (empty when not collected).
    phone: Optional[str] = None
    email: Optional[str] = None
    spin_order: int
    won_at: datetime


class WinnerListResponse(BaseModel):
    items: list[WinnerRead]
    total: int


class SpinResponse(BaseModel):
    """Result of a server-side spin — the revealed winner."""

    winner: WinnerRead
