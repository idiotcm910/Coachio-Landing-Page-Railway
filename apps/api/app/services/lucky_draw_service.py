"""Lucky-draw business logic (funnel-lucky-draw, tasks 2.3).

Covers: form-schema validation, event status transitions (open/lock recording
opened_at/locked_at), participant submission with per-event phone dedup, and
manual add/remove. Spin logic lives in `lucky_spin_service.py`.

Raised errors use ValueError with a clear message; the endpoint layer maps them
to HTTP responses.
"""
import re
import unicodedata
from typing import Any, Optional

from sqlalchemy.orm import Session
from sqlalchemy.sql import func

from app.models.lucky_event import LuckyEvent, LuckyEventParticipant

# Choice fields must carry options; rating fields must carry scale_max.
_CHOICE_TYPES = {"single_choice", "multi_choice"}
# Display-only blocks: never collect an answer, never required, excluded from
# the display-name rule.
_DISPLAY_TYPES = {"rich_text", "image"}


def is_display_field(field: dict) -> bool:
    """True for non-input content blocks (rich_text/image)."""
    return field.get("type") in _DISPLAY_TYPES


class LuckyDrawError(ValueError):
    """Domain error; carries an HTTP-friendly message."""


# --- Slug normalization + validation ------------------------------------------

_SLUG_MAX_LEN = 80
# Valid normalized slug: lowercase alnum groups joined by single hyphens.
_SLUG_VALID_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


def normalize_slug(value: Optional[str]) -> Optional[str]:
    """Normalize a user-supplied slug to a URL-safe form, or None.

    Lowercases, transliterates unicode → ascii, turns spaces/underscores into
    hyphens, strips anything outside [a-z0-9-], collapses repeated hyphens, and
    trims leading/trailing hyphens. Caps at ~80 chars. Empty/None → None (clear).
    """
    if value is None:
        return None
    # Transliterate accented chars (e.g. "Cà" → "Ca") before lowercasing.
    text = unicodedata.normalize("NFKD", value)
    text = text.encode("ascii", "ignore").decode("ascii")
    text = text.strip().lower()
    text = re.sub(r"[\s_]+", "-", text)
    text = re.sub(r"[^a-z0-9-]+", "", text)
    text = re.sub(r"-+", "-", text).strip("-")
    text = text[:_SLUG_MAX_LEN].strip("-")
    return text or None


def validate_slug(slug: str) -> None:
    """Raise LuckyDrawError if a (already-normalized) slug is not URL-safe."""
    if not _SLUG_VALID_RE.match(slug):
        raise LuckyDrawError("Slug must contain only lowercase letters, numbers and hyphens")


def validate_form_schema(fields: list[dict], name_field_key: Optional[str]) -> None:
    """Validate the form schema.

    Display fields (rich_text/image) carry no answer and are excluded from the
    display-name rule. Among the INPUT fields, exactly one short_text field must
    be the designated display-name field (`name_field_key`).

    Raises LuckyDrawError on any violation.
    """
    if not fields:
        raise LuckyDrawError("Form must have at least one field")

    keys = [f.get("key") for f in fields]
    if len(keys) != len(set(keys)):
        raise LuckyDrawError("Field keys must be unique")

    input_fields = [f for f in fields if not is_display_field(f)]
    if not input_fields:
        raise LuckyDrawError("Form must have at least one input field")

    for f in input_fields:
        ftype = f.get("type")
        if not (f.get("label") or "").strip():
            raise LuckyDrawError(f"Field '{f.get('key')}' must have a label")
        if ftype in _CHOICE_TYPES and not f.get("options"):
            raise LuckyDrawError(f"Field '{f.get('key')}' must have options")
        if ftype == "rating" and not f.get("scale_max"):
            raise LuckyDrawError(f"Rating field '{f.get('key')}' must have scale_max")

    if not name_field_key:
        raise LuckyDrawError("A display-name field must be designated")
    name_field = next((f for f in input_fields if f.get("key") == name_field_key), None)
    if name_field is None:
        raise LuckyDrawError("name_field_key does not match any input field")
    if name_field.get("type") != "short_text":
        raise LuckyDrawError("The display-name field must be of type short_text")


def open_event(db: Session, event: LuckyEvent) -> LuckyEvent:
    """Transition to `open`; valid from draft or locked. Records opened_at."""
    if event.status not in ("draft", "locked", "open"):
        raise LuckyDrawError(f"Cannot open an event in status '{event.status}'")
    event.status = "open"
    event.opened_at = func.now()
    db.flush()
    return event


def lock_event(db: Session, event: LuckyEvent) -> LuckyEvent:
    """Transition `open` → `locked`. Records locked_at."""
    if event.status != "open":
        raise LuckyDrawError("Only an open event can be locked")
    event.status = "locked"
    event.locked_at = func.now()
    db.flush()
    return event


def set_event_slug(db: Session, event: LuckyEvent, raw_slug: Optional[str]) -> LuckyEvent:
    """Normalize, validate and assign a slug. Empty/None clears it (NULL).

    Enforces uniqueness across events (excluding self). Raises LuckyDrawError
    ("Slug already in use", flagged via .conflict) on collision.
    """
    slug = normalize_slug(raw_slug)
    if slug is None:
        event.slug = None
        db.flush()
        return event

    validate_slug(slug)
    clash = (
        db.query(LuckyEvent)
        .filter(LuckyEvent.slug == slug, LuckyEvent.id != event.id)
        .first()
    )
    if clash is not None:
        err = LuckyDrawError("Slug already in use")
        err.conflict = True
        raise err
    event.slug = slug
    db.flush()
    return event


def _extract_display_name(
    event: LuckyEvent, answers: dict[str, Any]
) -> str:
    """Pull the display name from answers using the event's name_field_key."""
    key = event.name_field_key
    value = (answers.get(key) if key else None) or ""
    value = str(value).strip()
    if not value:
        raise LuckyDrawError("Display name is required")
    return value[:255]


def _extract_phone(answers: dict[str, Any], form_schema: list[dict]) -> Optional[str]:
    """Find the first `phone`-type field value in answers, if any."""
    for f in form_schema or []:
        if f.get("type") == "phone":
            v = answers.get(f.get("key"))
            if v:
                return str(v).strip()[:50]
    return None


def extract_email(
    answers: Optional[dict[str, Any]], form_schema: Optional[list[dict]]
) -> Optional[str]:
    """Resolve the participant's email from answers.

    Prefer the value of the form's `email`-type field; fall back to the first
    answer that looks like an email address. Returns None when none is found.
    """
    answers = answers or {}
    for f in form_schema or []:
        if f.get("type") == "email":
            v = answers.get(f.get("key"))
            if v:
                return str(v).strip()[:255]
    for v in answers.values():
        if isinstance(v, str) and "@" in v and "." in v.split("@")[-1]:
            return v.strip()[:255]
    return None


def submit_participant(
    db: Session, event: LuckyEvent, answers: dict[str, Any], source: str = "public"
) -> LuckyEventParticipant:
    """Create or update a participant for the event.

    Dedup is by (event_id, phone) when a phone is present: a duplicate phone
    updates the existing row's answers/display_name instead of inserting.
    """
    display_name = _extract_display_name(event, answers)
    phone = _extract_phone(answers, event.form_schema or [])

    existing = None
    if phone:
        existing = (
            db.query(LuckyEventParticipant)
            .filter(
                LuckyEventParticipant.event_id == event.id,
                LuckyEventParticipant.phone == phone,
            )
            .first()
        )

    if existing is not None:
        existing.display_name = display_name
        existing.answers = answers
        db.flush()
        return existing

    participant = LuckyEventParticipant(
        event_id=event.id,
        display_name=display_name,
        phone=phone,
        answers=answers,
        source=source,
    )
    db.add(participant)
    db.flush()
    return participant


def add_participant_manual(
    db: Session,
    event: LuckyEvent,
    display_name: str,
    phone: Optional[str] = None,
    answers: Optional[dict] = None,
) -> LuckyEventParticipant:
    """Admin manual add, subject to the per-event phone uniqueness rule."""
    phone = (phone or "").strip() or None
    if phone:
        dup = (
            db.query(LuckyEventParticipant)
            .filter(
                LuckyEventParticipant.event_id == event.id,
                LuckyEventParticipant.phone == phone,
            )
            .first()
        )
        if dup is not None:
            raise LuckyDrawError("A participant with this phone already exists")

    participant = LuckyEventParticipant(
        event_id=event.id,
        display_name=display_name.strip()[:255],
        phone=phone,
        answers=answers,
        source="manual",
    )
    db.add(participant)
    db.flush()
    return participant


def remove_participant(db: Session, participant: LuckyEventParticipant) -> None:
    """Delete a participant (cascade removes any winner row via FK)."""
    db.delete(participant)
    db.flush()
