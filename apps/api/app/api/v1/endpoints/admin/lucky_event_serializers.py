"""Read-model serializers for admin lucky-draw endpoints.

Keeps endpoint files thin; computes derived counts (participant/winner totals,
prize awarded_count, winner display/prize names) that aren't plain columns.
"""
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.lucky_event import (
    LuckyEvent,
    LuckyEventParticipant,
    LuckyPrize,
    LuckyWinner,
)
from app.schemas.lucky_draw import PrizeRead, WinnerRead
from app.schemas.lucky_event import LuckyEventListItem
from app.services.lucky_draw_service import extract_email


def event_list_item(db: Session, event: LuckyEvent) -> LuckyEventListItem:
    p_count = (
        db.query(func.count(LuckyEventParticipant.id))
        .filter(LuckyEventParticipant.event_id == event.id)
        .scalar()
        or 0
    )
    w_count = (
        db.query(func.count(LuckyWinner.id))
        .filter(LuckyWinner.event_id == event.id)
        .scalar()
        or 0
    )
    return LuckyEventListItem(
        id=event.id,
        funnel_id=event.funnel_id,
        title=event.title,
        status=event.status,
        participant_count=p_count,
        winner_count=w_count,
        created_at=event.created_at,
    )


def prize_read(db: Session, prize: LuckyPrize) -> PrizeRead:
    awarded = (
        db.query(func.count(LuckyWinner.id))
        .filter(LuckyWinner.prize_id == prize.id)
        .scalar()
        or 0
    )
    return PrizeRead(
        id=prize.id,
        event_id=prize.event_id,
        name=prize.name,
        quantity=prize.quantity,
        sort_order=prize.sort_order,
        awarded_count=awarded,
    )


def winner_read(winner: LuckyWinner) -> WinnerRead:
    participant = winner.participant
    # Contact details are derived from the participant: phone from its column,
    # email resolved from the answers via the event's email-type field.
    phone = participant.phone if participant else None
    email = (
        extract_email(
            participant.answers,
            winner.event.form_schema if winner.event else None,
        )
        if participant
        else None
    )
    return WinnerRead(
        id=winner.id,
        event_id=winner.event_id,
        prize_id=winner.prize_id,
        prize_name=winner.prize.name if winner.prize else None,
        participant_id=winner.participant_id,
        display_name=participant.display_name if participant else None,
        phone=phone,
        email=email,
        spin_order=winner.spin_order,
        won_at=winner.won_at,
    )
