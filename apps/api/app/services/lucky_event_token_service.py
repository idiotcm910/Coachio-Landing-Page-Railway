"""Per-event public token lifecycle (funnel-lucky-draw, mirrors
funnel_capture_token_service).

Token format: 'let_' + 32 url-safe chars (~47 chars, fits VARCHAR(48)).
Rotate = generate new token; old token is immediately invalid.
"""
import secrets

from sqlalchemy.orm import Session

from app.models.lucky_event import LuckyEvent

_TOKEN_PREFIX = "let_"
_RANDOM_BYTES = 32


def generate_event_token() -> str:
    """Return a new public token string."""
    return _TOKEN_PREFIX + secrets.token_urlsafe(_RANDOM_BYTES)


def get_or_create_event_token(db: Session, event: LuckyEvent) -> str:
    """Return existing token or generate + persist a new one."""
    if event.public_token:
        return event.public_token
    return _rotate(db, event)


def rotate_event_token(db: Session, event: LuckyEvent) -> str:
    """Invalidate the current token and issue a new one."""
    return _rotate(db, event)


def resolve_event_by_token(db: Session, token: str) -> LuckyEvent | None:
    """Return the LuckyEvent matching this public token, or None."""
    if not token:
        return None
    return db.query(LuckyEvent).filter(LuckyEvent.public_token == token).first()


def resolve_event_by_token_or_slug(db: Session, key: str) -> LuckyEvent | None:
    """Resolve a public key that may be either a public_token or a friendly slug.

    Tries an exact public_token match first (backward-compatible), then an exact
    slug match. Returns None if neither matches.
    """
    if not key:
        return None
    event = db.query(LuckyEvent).filter(LuckyEvent.public_token == key).first()
    if event is not None:
        return event
    return db.query(LuckyEvent).filter(LuckyEvent.slug == key).first()


def _rotate(db: Session, event: LuckyEvent) -> str:
    token = generate_event_token()
    event.public_token = token
    db.flush()
    return token
