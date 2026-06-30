"""Public lucky-draw endpoints — /api/v1/public/lucky-events (tasks 3.2).

Token-authenticated (per-event public_token in the URL path / body), no login.
  GET  /{token}           → event meta + form schema (only when status=open)
  POST /{token}/register  → validate answers against schema, dedup by phone, store

Mirrors the funnel lead-capture CORS approach so the registration page can call
cross-origin.
"""
import logging
import re
from typing import Any

from fastapi import APIRouter, Depends, Request, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.db.base import get_db
from app.schemas.lucky_event import PublicLuckyEventResponse
from app.services.html_sanitizer_service import sanitize_html as _sanitize_html
from app.services.lucky_draw_service import (
    LuckyDrawError,
    is_display_field,
    submit_participant,
)
from app.services.lucky_event_token_service import resolve_event_by_token_or_slug

logger = logging.getLogger(__name__)

router = APIRouter()

_CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
}


def _cors_json(status_code: int, content: dict) -> JSONResponse:
    return JSONResponse(status_code=status_code, content=content, headers=_CORS_HEADERS)


async def _parse_payload(request: Request) -> dict[str, Any]:
    content_type = request.headers.get("content-type", "")
    if "form-data" in content_type or "x-www-form-urlencoded" in content_type:
        return dict(await request.form())
    try:
        return await request.json()
    except Exception:
        return {}


# Vietnamese mobile: 10 digits starting with 0. Email: standard simple format.
_PHONE_RE = re.compile(r"^0\d{9}$")
_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _validate_answers(form_schema: list[dict], answers: dict[str, Any]) -> None:
    """Ensure required fields are present and email/phone fields are well-formed.
    Display fields carry no answer and are ignored. Raises LuckyDrawError on failure."""
    for f in form_schema or []:
        if is_display_field(f):
            continue
        key = f.get("key")
        label = f.get("label") or key
        val = answers.get(key)
        is_empty = val in (None, "", [])
        if f.get("required") and is_empty:
            raise LuckyDrawError(f"Vui lòng nhập '{label}'")
        if is_empty:
            continue
        ftype = f.get("type")
        if ftype == "phone":
            digits = str(val).strip()
            if not _PHONE_RE.match(digits):
                raise LuckyDrawError(f"'{label}' phải gồm 10 chữ số và bắt đầu bằng 0")
        elif ftype == "email":
            if not _EMAIL_RE.match(str(val).strip()):
                raise LuckyDrawError(f"'{label}' không đúng định dạng email")


def _public_form_schema(form_schema: list[dict] | None) -> list[dict]:
    """Sanitize rich_text `content` for safe FE rendering; other fields pass
    through unchanged."""
    result: list[dict] = []
    for f in form_schema or []:
        if f.get("type") == "rich_text":
            f = {**f, "content": _sanitize_html(f.get("content"))}
        result.append(f)
    return result


def _public_success_config(success_config: dict | None) -> dict | None:
    """Sanitize success custom_html for safe FE rendering."""
    if not success_config:
        return success_config
    if success_config.get("custom_html"):
        return {
            **success_config,
            "custom_html": _sanitize_html(success_config["custom_html"]),
        }
    return success_config


@router.options("/{token}", include_in_schema=False)
async def event_preflight(token: str):
    return JSONResponse(content={}, headers=_CORS_HEADERS)


@router.options("/{token}/register", include_in_schema=False)
async def register_preflight(token: str):
    return JSONResponse(content={}, headers=_CORS_HEADERS)


@router.get("/{token}", response_model=PublicLuckyEventResponse)
async def get_public_event(token: str, db: Session = Depends(get_db)):
    """Return event meta + form schema. 401 unknown token; 423 when not open."""
    event = resolve_event_by_token_or_slug(db, token)
    if event is None:
        return _cors_json(status.HTTP_401_UNAUTHORIZED, {"detail": "Invalid token"})
    if event.status != "open":
        return _cors_json(
            status.HTTP_423_LOCKED, {"detail": "Registration is not open"}
        )
    body = PublicLuckyEventResponse(
        title=event.title,
        status=event.status,
        form_schema=_public_form_schema(event.form_schema),
        name_field_key=event.name_field_key,
        success_config=_public_success_config(event.success_config),
    )
    return JSONResponse(content=body.model_dump(mode="json"), headers=_CORS_HEADERS)


@router.post("/{token}/register")
async def register(token: str, request: Request, db: Session = Depends(get_db)):
    """Validate answers against schema, dedup by phone, store the participant.

    401 unknown token; 423 when not open; 422 on validation error.
    Returns { ok: true, success_config } on success.
    """
    event = resolve_event_by_token_or_slug(db, token)
    if event is None:
        return _cors_json(status.HTTP_401_UNAUTHORIZED, {"detail": "Invalid token"})
    if event.status != "open":
        return _cors_json(
            status.HTTP_423_LOCKED, {"detail": "Registration is closed"}
        )

    raw = await _parse_payload(request)
    answers = raw.get("answers") if isinstance(raw.get("answers"), dict) else raw

    try:
        _validate_answers(event.form_schema or [], answers)
        submit_participant(db, event, answers, source="public")
        db.commit()
    except LuckyDrawError as e:
        db.rollback()
        return _cors_json(status.HTTP_422_UNPROCESSABLE_ENTITY, {"detail": str(e)})
    except Exception:
        db.rollback()
        logger.exception("Lucky-draw register failed for event=%s", event.id)
        return _cors_json(
            status.HTTP_500_INTERNAL_SERVER_ERROR, {"detail": "Failed to register"}
        )

    return _cors_json(
        status.HTTP_200_OK,
        {"ok": True, "success_config": _public_success_config(event.success_config)},
    )
