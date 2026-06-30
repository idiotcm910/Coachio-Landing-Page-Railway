"""Capture token lifecycle for public lead-capture API (D2, funnel-landing-lead-capture).

Token format: 'fct_' + 32 url-safe chars = ~44 chars total (fits VARCHAR(48)).
Rotate = generate new token; old token is immediately invalid (single-column design, D2).
"""
import secrets

from sqlalchemy.orm import Session

from app.models.funnel import Funnel

_TOKEN_PREFIX = "fct_"
_RANDOM_BYTES = 32  # secrets.token_urlsafe(32) → 43 chars; prefix brings total to 47


def generate_capture_token() -> str:
    """Return a new unique capture token string."""
    return _TOKEN_PREFIX + secrets.token_urlsafe(_RANDOM_BYTES)


def get_or_create_capture_token(db: Session, funnel: Funnel) -> str:
    """Return existing token or generate + persist a new one."""
    if funnel.capture_token:
        return funnel.capture_token
    return _rotate_token(db, funnel)


def rotate_capture_token(db: Session, funnel: Funnel) -> str:
    """Invalidate current token and issue a new one (admin-initiated rotate)."""
    return _rotate_token(db, funnel)


def resolve_funnel_by_token(db: Session, token: str) -> Funnel | None:
    """Return the Funnel matching this capture token, or None if not found."""
    if not token:
        return None
    return db.query(Funnel).filter(Funnel.capture_token == token).first()


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _rotate_token(db: Session, funnel: Funnel) -> str:
    token = generate_capture_token()
    funnel.capture_token = token
    db.flush()
    return token
