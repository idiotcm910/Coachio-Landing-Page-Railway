"""Server-side spin (funnel-lucky-draw, task 2.4 / D4).

In one DB transaction: pick a RANDOM participant who has not already won any
prize in the event, enforce the prize quantity cap, and record a winner with an
incrementing spin_order. The (event_id, participant_id) unique constraint is the
final guard against double-winning under concurrency.
"""
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.lucky_event import (
    LuckyEvent,
    LuckyEventParticipant,
    LuckyPrize,
    LuckyWinner,
)
from app.services.lucky_draw_service import LuckyDrawError


def awarded_count(db: Session, prize: LuckyPrize) -> int:
    """How many winners already recorded for this prize."""
    return (
        db.query(func.count(LuckyWinner.id))
        .filter(LuckyWinner.prize_id == prize.id)
        .scalar()
        or 0
    )


def spin(db: Session, event: LuckyEvent, prize: LuckyPrize) -> LuckyWinner:
    """Draw one winner for `prize` in `event`.

    Raises LuckyDrawError with a clear message:
      - "Prize is fully awarded" when quantity is reached.
      - "No eligible participants remain" when every participant has won.
    Commits the transaction on success.
    """
    if prize.event_id != event.id:
        raise LuckyDrawError("Prize does not belong to this event")

    # --- Prize quantity cap ---
    if awarded_count(db, prize) >= prize.quantity:
        raise LuckyDrawError("Prize is fully awarded")

    # --- Eligible = participants of this event with no winner row ---
    won_ids = db.query(LuckyWinner.participant_id).filter(
        LuckyWinner.event_id == event.id
    )
    candidate = (
        db.query(LuckyEventParticipant)
        .filter(
            LuckyEventParticipant.event_id == event.id,
            ~LuckyEventParticipant.id.in_(won_ids),
        )
        .order_by(func.random())
        .first()
    )
    if candidate is None:
        raise LuckyDrawError("No eligible participants remain")

    # --- Incrementing spin_order within the event ---
    max_order = (
        db.query(func.max(LuckyWinner.spin_order))
        .filter(LuckyWinner.event_id == event.id)
        .scalar()
    )
    next_order = (max_order or 0) + 1

    winner = LuckyWinner(
        event_id=event.id,
        prize_id=prize.id,
        participant_id=candidate.id,
        spin_order=next_order,
    )
    db.add(winner)
    try:
        db.commit()
    except Exception:
        # Unique-constraint race (concurrent spin picked the same participant).
        db.rollback()
        raise LuckyDrawError("Spin conflict, please retry")
    db.refresh(winner)
    return winner
