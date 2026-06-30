"""Admin Lucky-Draw endpoints — /api/v1/admin/lucky-events (tasks 3.1).

require_role("admin") on every route. Event CRUD + list-filter-by-funnel,
status open/lock, prizes CRUD, participants list/add/remove, spin, winners list.
"""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.base import get_db
from app.middleware.auth import require_role
from app.models import Funnel, LuckyEvent, LuckyEventParticipant, LuckyPrize, LuckyWinner
from app.models.admin_user import AdminUser
from app.schemas.lucky_draw import (
    ParticipantListResponse,
    ParticipantManualCreate,
    ParticipantRead,
    PrizeCreate,
    PrizeListResponse,
    PrizeRead,
    PrizeUpdate,
    SpinRequest,
    SpinResponse,
    WinnerListResponse,
)
from app.schemas.lucky_event import (
    LuckyEventCreate,
    LuckyEventListResponse,
    LuckyEventRead,
    LuckyEventStatusUpdate,
    LuckyEventTokenRead,
    LuckyEventUpdate,
)
from app.services import lucky_draw_service as svc
from app.services import lucky_spin_service as spin_svc
from app.services.lucky_draw_service import LuckyDrawError
from app.services.lucky_event_token_service import (
    get_or_create_event_token,
    rotate_event_token,
)
from app.api.v1.endpoints.admin.lucky_event_serializers import (
    event_list_item,
    prize_read,
    winner_read,
)

router = APIRouter()

_REGISTER_ENDPOINT = f"{settings.API_V1_PREFIX}/public/lucky-events"


def _event_or_404(db: Session, event_id: str) -> LuckyEvent:
    event = db.query(LuckyEvent).filter(LuckyEvent.id == event_id).first()
    if event is None:
        raise HTTPException(status_code=404, detail="Lucky event not found")
    return event


def _prize_or_404(db: Session, event_id: str, prize_id: str) -> LuckyPrize:
    prize = (
        db.query(LuckyPrize)
        .filter(LuckyPrize.id == prize_id, LuckyPrize.event_id == event_id)
        .first()
    )
    if prize is None:
        raise HTTPException(status_code=404, detail="Prize not found")
    return prize


def _bad(err: LuckyDrawError) -> HTTPException:
    # Slug clashes surface as 409 so the FE can show "already in use" clearly.
    code = status.HTTP_409_CONFLICT if getattr(err, "conflict", False) else status.HTTP_400_BAD_REQUEST
    return HTTPException(status_code=code, detail=str(err))


# --- Event CRUD ---------------------------------------------------------------


@router.get("", response_model=LuckyEventListResponse)
def list_events(
    funnel_id: str | None = Query(None),
    db: Session = Depends(get_db),
    current_user: AdminUser = Depends(require_role("admin")),
):
    query = db.query(LuckyEvent)
    if funnel_id:
        query = query.filter(LuckyEvent.funnel_id == funnel_id)
    events = query.order_by(LuckyEvent.created_at.desc()).all()
    items = [event_list_item(db, e) for e in events]
    return LuckyEventListResponse(items=items, total=len(items))


@router.post("", response_model=LuckyEventRead, status_code=status.HTTP_201_CREATED)
def create_event(
    payload: LuckyEventCreate,
    db: Session = Depends(get_db),
    current_user: AdminUser = Depends(require_role("admin")),
):
    if db.query(Funnel).filter(Funnel.id == payload.funnel_id).first() is None:
        raise HTTPException(status_code=404, detail="Funnel not found")
    data = payload.model_dump()
    raw_slug = data.pop("slug", None)
    form_schema = data.get("form_schema")
    if form_schema:
        try:
            svc.validate_form_schema(form_schema, data.get("name_field_key"))
        except LuckyDrawError as e:
            raise _bad(e)
    event = LuckyEvent(**data)
    get_or_create_event_token(db, event)
    if raw_slug:
        try:
            svc.set_event_slug(db, event, raw_slug)
        except LuckyDrawError as e:
            raise _bad(e)
    db.add(event)
    db.commit()
    db.refresh(event)
    return event


@router.get("/{event_id}", response_model=LuckyEventRead)
def get_event(
    event_id: str,
    db: Session = Depends(get_db),
    current_user: AdminUser = Depends(require_role("admin")),
):
    return _event_or_404(db, event_id)


@router.patch("/{event_id}", response_model=LuckyEventRead)
def update_event(
    event_id: str,
    payload: LuckyEventUpdate,
    db: Session = Depends(get_db),
    current_user: AdminUser = Depends(require_role("admin")),
):
    event = _event_or_404(db, event_id)
    updates = payload.model_dump(exclude_unset=True)
    # Validate the resulting form schema when either part is being changed.
    if "form_schema" in updates or "name_field_key" in updates:
        new_schema = updates.get("form_schema", event.form_schema)
        new_key = updates.get("name_field_key", event.name_field_key)
        if new_schema:
            try:
                svc.validate_form_schema(new_schema, new_key)
            except LuckyDrawError as e:
                raise _bad(e)
    # Slug goes through normalize/validate/uniqueness (handled in the service).
    if "slug" in updates:
        try:
            svc.set_event_slug(db, event, updates.pop("slug"))
        except LuckyDrawError as e:
            raise _bad(e)
    for k, v in updates.items():
        setattr(event, k, v)
    db.commit()
    db.refresh(event)
    return event


@router.delete("/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_event(
    event_id: str,
    db: Session = Depends(get_db),
    current_user: AdminUser = Depends(require_role("admin")),
):
    event = _event_or_404(db, event_id)
    db.delete(event)
    db.commit()


# --- Status + token -----------------------------------------------------------


@router.patch("/{event_id}/status", response_model=LuckyEventRead)
def update_status(
    event_id: str,
    payload: LuckyEventStatusUpdate,
    db: Session = Depends(get_db),
    current_user: AdminUser = Depends(require_role("admin")),
):
    event = _event_or_404(db, event_id)
    try:
        if payload.action == "open":
            svc.open_event(db, event)
        else:
            svc.lock_event(db, event)
    except LuckyDrawError as e:
        raise _bad(e)
    db.commit()
    db.refresh(event)
    return event


@router.get("/{event_id}/token", response_model=LuckyEventTokenRead)
def get_token(
    event_id: str,
    db: Session = Depends(get_db),
    current_user: AdminUser = Depends(require_role("admin")),
):
    event = _event_or_404(db, event_id)
    token = get_or_create_event_token(db, event)
    db.commit()
    return LuckyEventTokenRead(
        event_id=event.id, public_token=token, register_endpoint=_REGISTER_ENDPOINT
    )


@router.post("/{event_id}/token/rotate", response_model=LuckyEventTokenRead)
def rotate_token(
    event_id: str,
    db: Session = Depends(get_db),
    current_user: AdminUser = Depends(require_role("admin")),
):
    event = _event_or_404(db, event_id)
    token = rotate_event_token(db, event)
    db.commit()
    return LuckyEventTokenRead(
        event_id=event.id, public_token=token, register_endpoint=_REGISTER_ENDPOINT
    )


# --- Prizes -------------------------------------------------------------------


@router.get("/{event_id}/prizes", response_model=PrizeListResponse)
def list_prizes(
    event_id: str,
    db: Session = Depends(get_db),
    current_user: AdminUser = Depends(require_role("admin")),
):
    _event_or_404(db, event_id)
    prizes = (
        db.query(LuckyPrize)
        .filter(LuckyPrize.event_id == event_id)
        .order_by(LuckyPrize.sort_order)
        .all()
    )
    items = [prize_read(db, p) for p in prizes]
    return PrizeListResponse(items=items, total=len(items))


@router.post("/{event_id}/prizes", response_model=PrizeRead, status_code=201)
def create_prize(
    event_id: str,
    payload: PrizeCreate,
    db: Session = Depends(get_db),
    current_user: AdminUser = Depends(require_role("admin")),
):
    _event_or_404(db, event_id)
    prize = LuckyPrize(event_id=event_id, **payload.model_dump())
    db.add(prize)
    db.commit()
    db.refresh(prize)
    return prize_read(db, prize)


@router.patch("/{event_id}/prizes/{prize_id}", response_model=PrizeRead)
def update_prize(
    event_id: str,
    prize_id: str,
    payload: PrizeUpdate,
    db: Session = Depends(get_db),
    current_user: AdminUser = Depends(require_role("admin")),
):
    prize = _prize_or_404(db, event_id, prize_id)
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(prize, k, v)
    db.commit()
    db.refresh(prize)
    return prize_read(db, prize)


@router.delete("/{event_id}/prizes/{prize_id}", status_code=204)
def delete_prize(
    event_id: str,
    prize_id: str,
    db: Session = Depends(get_db),
    current_user: AdminUser = Depends(require_role("admin")),
):
    prize = _prize_or_404(db, event_id, prize_id)
    db.delete(prize)
    db.commit()


# --- Participants -------------------------------------------------------------


@router.get("/{event_id}/participants", response_model=ParticipantListResponse)
def list_participants(
    event_id: str,
    db: Session = Depends(get_db),
    current_user: AdminUser = Depends(require_role("admin")),
):
    _event_or_404(db, event_id)
    rows = (
        db.query(LuckyEventParticipant)
        .filter(LuckyEventParticipant.event_id == event_id)
        .order_by(LuckyEventParticipant.created_at.desc())
        .all()
    )
    return ParticipantListResponse(
        items=[ParticipantRead.model_validate(r) for r in rows], total=len(rows)
    )


@router.post("/{event_id}/participants", response_model=ParticipantRead, status_code=201)
def add_participant(
    event_id: str,
    payload: ParticipantManualCreate,
    db: Session = Depends(get_db),
    current_user: AdminUser = Depends(require_role("admin")),
):
    event = _event_or_404(db, event_id)
    try:
        p = svc.add_participant_manual(
            db, event, payload.display_name, payload.phone, payload.answers
        )
    except LuckyDrawError as e:
        raise _bad(e)
    db.commit()
    db.refresh(p)
    return p


@router.delete("/{event_id}/participants/{participant_id}", status_code=204)
def remove_participant(
    event_id: str,
    participant_id: str,
    db: Session = Depends(get_db),
    current_user: AdminUser = Depends(require_role("admin")),
):
    p = (
        db.query(LuckyEventParticipant)
        .filter(
            LuckyEventParticipant.id == participant_id,
            LuckyEventParticipant.event_id == event_id,
        )
        .first()
    )
    if p is None:
        raise HTTPException(status_code=404, detail="Participant not found")
    svc.remove_participant(db, p)
    db.commit()


# --- Spin + winners -----------------------------------------------------------


@router.post("/{event_id}/spin", response_model=SpinResponse)
def spin(
    event_id: str,
    payload: SpinRequest,
    db: Session = Depends(get_db),
    current_user: AdminUser = Depends(require_role("admin")),
):
    event = _event_or_404(db, event_id)
    prize = _prize_or_404(db, event_id, payload.prize_id)
    try:
        winner = spin_svc.spin(db, event, prize)
    except LuckyDrawError as e:
        raise _bad(e)
    return SpinResponse(winner=winner_read(winner))


@router.get("/{event_id}/winners", response_model=WinnerListResponse)
def list_winners(
    event_id: str,
    db: Session = Depends(get_db),
    current_user: AdminUser = Depends(require_role("admin")),
):
    event = _event_or_404(db, event_id)
    items = [winner_read(w) for w in event.winners]
    return WinnerListResponse(items=items, total=len(items))


@router.delete("/{event_id}/winners/{winner_id}", status_code=204)
def discard_winner(
    event_id: str,
    winner_id: str,
    db: Session = Depends(get_db),
    current_user: AdminUser = Depends(require_role("admin")),
):
    """Discard a winner and remove the underlying participant.

    Deleting the participant cascade-removes the winner row and excludes that
    person from future spins; the prize's remaining quantity self-restores since
    awarded counts are computed from live winner rows.
    """
    _event_or_404(db, event_id)
    winner = (
        db.query(LuckyWinner)
        .filter(LuckyWinner.id == winner_id, LuckyWinner.event_id == event_id)
        .first()
    )
    if winner is None:
        raise HTTPException(status_code=404, detail="Winner not found")
    participant = winner.participant
    if participant is not None:
        svc.remove_participant(db, participant)
    else:
        db.delete(winner)
    db.commit()
