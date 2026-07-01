"""Public lead-capture endpoint — POST /public/funnels/leads/capture.

Authentication: per-funnel capture token in request body (D1, D2).
Accepts both multipart/form-data and application/json (D1).
Token-in-body makes form-data POSTs a CORS 'simple request' (no preflight),
but we still add Access-Control-Allow-Origin: * to the response so browsers
can read the JSON reply (needed for JSON content-type calls too).
"""

import logging
from typing import Any

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.db.base import get_db
from app.models.lead import Lead
from app.schemas.funnel_lead_capture import LeadCaptureResponse
from app.services.funnel_capture_token_service import resolve_funnel_by_token

logger = logging.getLogger(__name__)

router = APIRouter()

# CORS headers added to every response from this public endpoint.
# Limited to just this route — global CORS stays restrictive.
_CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
}

# Known standard field names — everything else goes into meta.
_STANDARD_FIELDS = {"token", "email", "name", "phone"}


async def _parse_payload(request: Request) -> dict[str, Any]:
    """Parse both multipart/form-data and application/json into a plain dict."""
    content_type = request.headers.get("content-type", "")
    if "multipart/form-data" in content_type or "application/x-www-form-urlencoded" in content_type:
        form = await request.form()
        return dict(form)
    # Default: attempt JSON parse.
    try:
        return await request.json()
    except Exception:
        return {}


def _build_meta(raw: dict[str, Any]) -> dict[str, Any] | None:
    """Collect non-standard fields into a meta dict; return None if empty."""
    meta = {k: v for k, v in raw.items() if k not in _STANDARD_FIELDS}
    return meta if meta else None


@router.options("/leads/capture", include_in_schema=False)
async def capture_preflight():
    """Handle CORS preflight for JSON clients that send OPTIONS."""
    return JSONResponse(content={}, headers=_CORS_HEADERS)


@router.post(
    "/leads/capture",
    response_model=LeadCaptureResponse,
    summary="Public: capture lead via funnel token (cross-origin)",
    status_code=status.HTTP_200_OK,
)
async def capture_lead(
    request: Request, background_tasks: BackgroundTasks, db: Session = Depends(get_db)
):
    """Record a landing-page opt-in lead authenticated by a per-funnel capture token.

    - Accepts multipart/form-data or JSON.
    - Token must match an active (non-archived) funnel.
    - Upsert by (email, funnel): new → subscribed; existing → update fields, no status downgrade.
    - Returns { ok: true } on success; 401 on bad token; 422 on bad email; 410 on archived funnel.
    """
    raw = await _parse_payload(request)

    token = (raw.get("token") or "").strip()
    email_raw = (raw.get("email") or "").strip().lower()

    # --- Token validation ---
    if not token:
        return JSONResponse(
            status_code=status.HTTP_401_UNAUTHORIZED,
            content={"detail": "Missing capture token"},
            headers=_CORS_HEADERS,
        )

    funnel = resolve_funnel_by_token(db, token)
    if funnel is None:
        return JSONResponse(
            status_code=status.HTTP_401_UNAUTHORIZED,
            content={"detail": "Invalid or rotated capture token"},
            headers=_CORS_HEADERS,
        )

    # --- Funnel availability check ---
    if funnel.status == "archived":
        return JSONResponse(
            status_code=status.HTTP_410_GONE,
            content={"detail": "Funnel is no longer accepting leads"},
            headers=_CORS_HEADERS,
        )

    # --- Email validation ---
    if not email_raw or "@" not in email_raw or "." not in email_raw.split("@")[-1]:
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={"detail": "Invalid or missing email address"},
            headers=_CORS_HEADERS,
        )

    name = (raw.get("name") or "").strip() or None
    phone = (raw.get("phone") or "").strip() or None
    meta = _build_meta(raw)

    # --- Upsert lead (D4 — idempotent by email+funnel) ---
    lead = (
        db.query(Lead)
        .filter(Lead.email == email_raw, Lead.source_funnel_id == funnel.id)
        .first()
    )

    is_new_lead = lead is None
    if lead is None:
        # New lead from landing form → subscribed
        lead = Lead(
            email=email_raw,
            source_funnel_id=funnel.id,
            name=name,
            phone=phone,
            status="subscribed",
            meta=meta,
        )
        db.add(lead)
    else:
        # Existing lead — update contact fields + meta; never downgrade status
        if name:
            lead.name = name
        if phone:
            lead.phone = phone
        if meta:
            # Merge new meta on top of existing (latest submission wins per key)
            existing_meta = lead.meta or {}
            lead.meta = {**existing_meta, **meta}

    try:
        db.commit()
    except Exception:
        db.rollback()
        logger.exception("Failed to upsert lead for funnel=%s email=%s", funnel.id, email_raw)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"detail": "Failed to record lead"},
            headers=_CORS_HEADERS,
        )

    return JSONResponse(
        content={"ok": True},
        headers=_CORS_HEADERS,
    )
