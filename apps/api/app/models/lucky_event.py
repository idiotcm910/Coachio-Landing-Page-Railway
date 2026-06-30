"""Lucky-draw models — in-app workshop lucky draw scoped to a funnel (D2).

Four relational tables:
  lucky_events             — one per draw; belongs to a funnel; carries the
                             registration form_schema (JSON) + public_token.
  lucky_event_participants — attendees, stored SEPARATELY from leads; answers
                             kept as JSON; unique (event_id, phone).
  lucky_prizes             — ordered prizes with quantities (relational so
                             remaining-quantity can be counted at spin time).
  lucky_winners            — recorded spins; unique (event_id, participant_id)
                             enforces "win at most once per event".

Public auth reuses the capture-token pattern (per-event public_token, D3).
"""
import uuid

from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    Integer,
    JSON,
    String,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base import Base


def uuid_str() -> str:
    return str(uuid.uuid4())


def _json_col():
    """JSON column that uses JSONB on postgresql."""
    return JSON().with_variant(JSONB, "postgresql")


# Event status lifecycle: draft → open ↔ locked → completed
LUCKY_EVENT_STATUSES = ("draft", "open", "locked", "completed")


class LuckyEvent(Base):
    __tablename__ = "lucky_events"

    id = Column(String(36), primary_key=True, index=True, default=uuid_str)
    funnel_id = Column(
        String(36),
        ForeignKey("funnels.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    title = Column(String(255), nullable=False)
    status = Column(
        String(20), default="draft", server_default="draft", nullable=False, index=True
    )
    # Per-event public token for the registration page (D3). 'let_' + 32 url-safe.
    public_token = Column(String(48), nullable=True, unique=True, index=True)
    # Optional human-friendly slug for /draw/<slug>. Normalized to [a-z0-9-].
    # NULL falls back to the public_token link. Backward-compatible.
    slug = Column(String(255), nullable=True, unique=True, index=True)
    # Ordered list of form fields (JSON, D2). Each field:
    # {key, type, label, required, options?, scale_max?}
    form_schema = Column(_json_col(), nullable=True)
    # Post-submission success page config: {headline, message}
    success_config = Column(_json_col(), nullable=True)
    # Presentation/display tweaks (reserved): {...}
    display_config = Column(_json_col(), nullable=True)
    # The form_schema field key designated as the wheel display name.
    name_field_key = Column(String(100), nullable=True)
    opened_at = Column(DateTime(timezone=True), nullable=True)
    locked_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    funnel = relationship("Funnel")
    participants = relationship(
        "LuckyEventParticipant",
        back_populates="event",
        cascade="all, delete-orphan",
    )
    prizes = relationship(
        "LuckyPrize",
        back_populates="event",
        cascade="all, delete-orphan",
        order_by="LuckyPrize.sort_order",
    )
    winners = relationship(
        "LuckyWinner",
        back_populates="event",
        cascade="all, delete-orphan",
        order_by="LuckyWinner.spin_order",
    )


class LuckyEventParticipant(Base):
    __tablename__ = "lucky_event_participants"
    __table_args__ = (
        UniqueConstraint("event_id", "phone", name="uq_lucky_participant_event_phone"),
    )

    id = Column(String(36), primary_key=True, index=True, default=uuid_str)
    event_id = Column(
        String(36),
        ForeignKey("lucky_events.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    display_name = Column(String(255), nullable=False)
    phone = Column(String(50), nullable=True)
    # Full submitted answers keyed by field key.
    answers = Column(_json_col(), nullable=True)
    # 'public' (registration page) | 'manual' (admin-added)
    source = Column(String(20), default="public", server_default="public", nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    event = relationship("LuckyEvent", back_populates="participants")


class LuckyPrize(Base):
    __tablename__ = "lucky_prizes"

    id = Column(String(36), primary_key=True, index=True, default=uuid_str)
    event_id = Column(
        String(36),
        ForeignKey("lucky_events.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name = Column(String(255), nullable=False)
    quantity = Column(Integer, default=1, server_default="1", nullable=False)
    sort_order = Column(Integer, default=0, server_default="0", nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    event = relationship("LuckyEvent", back_populates="prizes")
    winners = relationship("LuckyWinner", back_populates="prize")


class LuckyWinner(Base):
    __tablename__ = "lucky_winners"
    __table_args__ = (
        UniqueConstraint(
            "event_id", "participant_id", name="uq_lucky_winner_event_participant"
        ),
    )

    id = Column(String(36), primary_key=True, index=True, default=uuid_str)
    event_id = Column(
        String(36),
        ForeignKey("lucky_events.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    prize_id = Column(
        String(36),
        ForeignKey("lucky_prizes.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    participant_id = Column(
        String(36),
        ForeignKey("lucky_event_participants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # 1-based monotonically incrementing draw order within the event.
    spin_order = Column(Integer, nullable=False)
    won_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    event = relationship("LuckyEvent", back_populates="winners")
    prize = relationship("LuckyPrize", back_populates="winners")
    participant = relationship("LuckyEventParticipant")
