"""Meta Conversions API (CAPI) service — server-side conversion events (D2, D3, D6, D8).

Design choice — sync httpx.Client instead of async:
  complete_order() is a synchronous function. Making send_event sync (httpx.Client)
  is simpler (KISS) and correct: the 5-second bounded timeout plus swallow-all
  exception handling means this is a best-effort fire-and-forget that never blocks
  the order for long. No asyncio.run() / thread gymnastics required.

Advanced Matching Enrichment (E1–E5 / Groups 9–12):
  E1 — effective_meta uses live request_meta first, falls back to order persisted columns.
  E2 — external_id = sha256(order.lead_id).
  E3 — geo lookup via meta_geo_service; hashed ct/st/zp/country added to user_data.
  E4 — Purchase custom_data gains content_type:"product" + contents:[{id,qty,item_price}].
  E5 — fire_capi_event_bg opens its own SessionLocal so background tasks work safely.

PII normalization rules (Advanced Matching spec):
  em / ph / fn / ln → trim, lowercase; phone → digits only; then SHA-256 hex.
  client_ip_address, client_user_agent, fbp, fbc → passed through UNHASHED.
  Raw PII is NEVER sent to Meta.
"""
import hashlib
import logging
import re
from datetime import datetime, timezone
from typing import Optional

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


# ─── PII normalization & hashing helpers ────────────────────────────────────


def _sha256_hex(value: str) -> str:
    """SHA-256 hex digest of a pre-normalized string."""
    return hashlib.sha256(value.encode()).hexdigest()


def _normalize_email(email: str) -> str:
    return email.strip().lower()


def _normalize_phone(phone: str) -> str:
    """Digits only, no spaces/dashes/+."""
    return re.sub(r"\D", "", phone)


def _normalize_name(name: str) -> str:
    return name.strip().lower()


# ─── Effective-meta builder (E1 — fallback to persisted order columns) ──────


def _effective_meta(order, request_meta: Optional[dict]) -> dict:
    """Merge live request_meta with order-persisted browser signals.

    Live request_meta values take priority; persisted order columns are used
    as fallback so webhook-path purchases carry the attribution captured at checkout.
    """
    live = request_meta or {}
    return {
        "client_ip_address": live.get("client_ip_address") or order.client_ip_address or None,
        "client_user_agent": live.get("client_user_agent") or order.client_user_agent or None,
        "fbp": live.get("fbp") or order.fbp or None,
        "fbc": live.get("fbc") or order.fbc or None,
    }


# ─── User data builder ──────────────────────────────────────────────────────


def build_user_data(order, request_meta: Optional[dict], geo: Optional[dict] = None) -> dict:
    """Build CAPI user_data dict.

    Hashes PII (em/ph/fn/ln/external_id/ct/st/zp/country); forwards attribution
    signals unhashed. Empty values are dropped (Meta ignores absent keys; empty
    strings degrade match quality).

    Args:
        order: FunnelOrder instance.
        request_meta: Effective meta dict (already merged with persisted columns
                      by the caller via _effective_meta).
        geo: Optional geo dict {ct, st, zp, country} from meta_geo_service (E3).
    """
    meta = request_meta or {}
    user_data: dict = {}

    # Hashed PII
    if order.buyer_email:
        user_data["em"] = _sha256_hex(_normalize_email(order.buyer_email))
    if order.buyer_phone:
        phone_normalized = _normalize_phone(order.buyer_phone)
        if phone_normalized:
            user_data["ph"] = _sha256_hex(phone_normalized)
    # Split buyer_full_name into fn/ln best-effort (first word = fn, rest = ln)
    full_name = (order.buyer_full_name or "").strip()
    if full_name:
        parts = full_name.split(None, 1)  # split on first whitespace
        user_data["fn"] = _sha256_hex(_normalize_name(parts[0]))
        if len(parts) > 1:
            user_data["ln"] = _sha256_hex(_normalize_name(parts[1]))

    # external_id — stable per-customer identifier hashed (E2)
    if order.lead_id:
        user_data["external_id"] = _sha256_hex(str(order.lead_id).strip().lower())

    # Unhashed attribution signals (passed through from browser / effective_meta)
    for key in ("client_ip_address", "client_user_agent", "fbp", "fbc"):
        val = meta.get(key)
        if val:
            user_data[key] = val

    # Geo Advanced Matching — normalized then hashed (E3)
    if geo:
        _geo_field_map = [
            ("ct", "city"),    # ipinfo "city"   → ct (hashed)
            ("st", "region"),  # ipinfo "region" → st (hashed)
            ("zp", "postal"),  # ipinfo "postal" → zp (hashed)
            ("country", "country"),  # ipinfo "country" → country (hashed)
        ]
        # geo dict already uses the 4-key form {ct, st, zp, country} from meta_geo_service
        geo_key_normalizers = {
            "ct": lambda v: v.lower().strip(),
            "st": lambda v: v.lower().strip(),
            "zp": lambda v: v.lower().replace(" ", ""),
            "country": lambda v: v.lower().strip(),
        }
        for geo_key, normalizer in geo_key_normalizers.items():
            val = geo.get(geo_key)
            if val:
                user_data[geo_key] = _sha256_hex(normalizer(val))

    return user_data


# ─── Event builder ──────────────────────────────────────────────────────────


def build_event(order, funnel, event_name: str, event_id: str, user_data: dict) -> dict:
    """Assemble a single CAPI event dict.

    Purchase custom_data now includes content_type + contents (E4) in addition to
    existing content_ids/value/currency/content_name/order_id.
    """
    event_time = int((order.paid_at or datetime.now(timezone.utc)).timestamp())
    event_source_url = f"{settings.PUBLIC_WEB_BASE_URL.rstrip('/')}/funnels/{funnel.slug}"

    custom_data: dict = {"order_id": order.order_code}
    if event_name == "Purchase":
        product_id = funnel.product_id or funnel.id
        custom_data.update(
            {
                "value": order.final_amount,
                "currency": funnel.currency or "VND",
                "content_ids": [product_id],
                "content_name": order.product_name,
                # E4 — complete custom_data per spec
                "content_type": "product",
                "contents": [
                    {
                        "id": product_id,
                        "quantity": 1,
                        "item_price": order.final_amount,
                    }
                ],
            }
        )

    return {
        "event_name": event_name,
        "event_time": event_time,
        "event_id": event_id,
        "action_source": "website",
        "event_source_url": event_source_url,
        "user_data": user_data,
        "custom_data": custom_data,
    }


# ─── Event mapping helper ────────────────────────────────────────────────────


def map_event_name_and_id(order) -> tuple[str, str]:
    """Return (event_name, event_id) based on final_amount threshold (D3).

    Purchase  — paid amount >= META_PURCHASE_MIN_VND
    Lead      — free order or paid amount < threshold
    event_id is deterministic per order for deduplication with browser Pixel.
    """
    amount = order.final_amount or 0
    event_name = "Purchase" if amount >= settings.META_PURCHASE_MIN_VND else "Lead"
    event_id = f"order_{order.order_code}"
    return event_name, event_id


# ─── CAPI send (sync, fail-safe) ─────────────────────────────────────────────


def send_event(tracking_config: dict, event: dict) -> None:
    """POST event to Meta Graph API — synchronous, bounded, fail-safe (D6).

    Never raises. Any failure (network, timeout, bad token, non-2xx) is
    logged as a warning and swallowed so the caller's order completion is
    never affected.
    """
    if not tracking_config:
        return
    if not tracking_config.get("enabled"):
        return
    pixel_id = tracking_config.get("meta_pixel_id")
    token = tracking_config.get("meta_capi_token")
    if not pixel_id or not token:
        return

    url = f"https://graph.facebook.com/{settings.META_GRAPH_API_VERSION}/{pixel_id}/events"
    body: dict = {"data": [event]}
    test_code = tracking_config.get("meta_test_event_code")
    if test_code:
        body["test_event_code"] = test_code

    try:
        with httpx.Client(timeout=5.0) as client:
            resp = client.post(url, params={"access_token": token}, json=body)
            if resp.status_code >= 400:
                logger.warning(
                    "Meta CAPI non-2xx response: status=%s body=%.200s event_id=%s",
                    resp.status_code,
                    resp.text,
                    event.get("event_id"),
                )
    except httpx.HTTPError as exc:
        logger.warning("Meta CAPI HTTP error: %s event_id=%s", exc, event.get("event_id"))
    except Exception as exc:  # noqa: BLE001 — must never propagate
        logger.warning("Meta CAPI unexpected error: %s event_id=%s", exc, event.get("event_id"))


# ─── High-level convenience ──────────────────────────────────────────────────


def fire_capi_event(db, order, request_meta: Optional[dict] = None) -> None:
    """Load funnel tracking config and fire the correct CAPI event for an order.

    Called inside complete_order() after the idempotent PENDING→SUCCESS guard,
    or from fire_capi_event_bg (background task path, E5).

    E1: builds effective_meta by merging live request_meta with persisted order columns.
    E3: geo lookup via ipinfo for the effective client IP.
    """
    from app.models import Funnel  # local import to avoid circular dependency
    from app.services.meta_geo_service import lookup_geo

    funnel = db.get(Funnel, order.funnel_id)
    if funnel is None:
        logger.warning("Meta CAPI: funnel not found for order %s", order.order_code)
        return

    tracking_config = funnel.tracking_config or {}
    if not tracking_config.get("enabled") or not tracking_config.get("meta_capi_token"):
        return  # tracking disabled — skip silently

    try:
        # E1 — use live request_meta when available; fall back to order-persisted columns
        eff_meta = _effective_meta(order, request_meta)

        # E3 — geo lookup (fail-safe; None when token absent, private IP, or error)
        geo = lookup_geo(eff_meta.get("client_ip_address"))

        event_name, event_id = map_event_name_and_id(order)
        user_data = build_user_data(order, eff_meta, geo=geo)
        event = build_event(order, funnel, event_name, event_id, user_data)
        send_event(tracking_config, event)
    except Exception as exc:  # noqa: BLE001 — extra safety net; must not raise
        logger.warning("Meta CAPI fire_capi_event failed: %s order=%s", exc, order.order_code)


def fire_capi_event_bg(order_id: str, request_meta: Optional[dict] = None) -> None:
    """Background-task wrapper for fire_capi_event (E5).

    Opens its own SessionLocal so this runs safely after the HTTP response is
    returned (the request-scoped session is already closed at that point).
    Fully fail-safe: any exception is logged, never raised.
    """
    from app.db.base import SessionLocal
    from app.models import FunnelOrder  # local import — avoid circular at module load

    db = SessionLocal()
    try:
        order = db.get(FunnelOrder, order_id)
        if order is None:
            logger.warning("Meta CAPI bg: order not found id=%s", order_id)
            return
        fire_capi_event(db, order, request_meta=request_meta)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Meta CAPI bg task failed: %s order_id=%s", exc, order_id)
    finally:
        db.close()
