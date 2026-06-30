"""Gift package CRUD (data only — no email) + delivery-email preview/test-send.

Gifts are soft-archived (never hard-deleted) to preserve the grant ledger audit.
External items only — internal perks (credits, skills, API access) are not
supported in this build (internal_config column exists in DB but is always null).
"""
import logging

import resend
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.gift import Gift
from app.schemas.gift import GiftCreate, GiftUpdate
from app.services.gift_email_render import render_gift_html, render_gift_text

logger = logging.getLogger(__name__)


def create_gift(db: Session, *, payload: GiftCreate, created_by: str | None) -> Gift:
    external = [e.model_dump() for e in payload.external_items] if payload.external_items else []
    if not external:
        raise ValueError("A gift must have at least one external item")
    gift = Gift(
        name=payload.name,
        description=payload.description,
        external_items=external,
        created_by=created_by,
    )
    db.add(gift)
    db.commit()
    db.refresh(gift)
    return gift


def list_gifts(db: Session, *, include_archived: bool = False) -> list[Gift]:
    q = db.query(Gift)
    if not include_archived:
        q = q.filter(Gift.is_archived.is_(False))
    return q.order_by(Gift.created_at.desc()).all()


def get_gift(db: Session, gift_id: str) -> Gift | None:
    return db.query(Gift).filter(Gift.id == gift_id).first()


def update_gift(db: Session, gift: Gift, payload: GiftUpdate) -> Gift:
    data = payload.model_dump(exclude_unset=True)
    if "external_items" in data and payload.external_items is not None:
        data["external_items"] = [e.model_dump() for e in payload.external_items]
    new_external = data.get("external_items", gift.external_items)
    if not new_external:
        raise ValueError("A gift must have at least one external item")
    for k, v in data.items():
        setattr(gift, k, v)
    db.commit()
    db.refresh(gift)
    return gift


def archive_gift(db: Session, gift: Gift) -> Gift:
    """Soft-archive (preferred over delete; keeps the audit trail)."""
    gift.is_archived = True
    db.commit()
    db.refresh(gift)
    return gift


# --- Delivery-email preview / test-send (used by campaign + automation editors) ---
def _sample_ctx() -> dict:
    return {"recipient_name": "Jane Doe", "login_email": "jane@example.com"}


def preview_email(db: Session, *, gift_ids: list[str], subject: str, html: str) -> dict:
    ctx = _sample_ctx()
    return {"subject": render_gift_text(subject, ctx), "html": render_gift_html(html, ctx)}


def test_send_email(db: Session, *, gift_ids: list[str], subject: str, html: str, to_email: str) -> None:
    """Render the delivery email with sample data and send it. Raises on failure."""
    rendered = preview_email(db, gift_ids=gift_ids, subject=subject, html=html)
    resend.Emails.send(
        {"from": settings.RESEND_FROM_EMAIL, "to": to_email, "subject": rendered["subject"], "html": rendered["html"]}
    )
