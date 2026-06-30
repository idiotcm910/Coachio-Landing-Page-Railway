"""Geo lookup for Meta CAPI Advanced Matching — ipinfo.io provider (E3).

Behaviour:
- Returns None (silently) when: no IP, no IPINFO_TOKEN, private/loopback/reserved IP,
  or any network/parse/cache error.
- Caches the parsed 4-key result per IP in the in-process cache for ~30 days to
  limit API usage (best-effort; cache miss is silently tolerated).
- Result dict keys: ct (city), st (region), zp (postal), country.  Missing keys are
  omitted so callers can add them without extra None-guards.
- NEVER raises — every code path ends with return None on failure.
"""
import ipaddress
import json
import logging
from typing import Optional

import httpx

from app.core.config import settings
from app.core.cache import get_backend

logger = logging.getLogger(__name__)

_GEO_CACHE_TTL = 2592000  # 30 days in seconds
_GEO_CACHE_PREFIX = "funnel:geo:v1:"
_IPINFO_URL = "https://ipinfo.io/{ip}?token={token}"


def _is_non_public(ip: str) -> bool:
    """Return True for IPs that should not be geo-looked-up (private/loopback/reserved/link-local)."""
    try:
        addr = ipaddress.ip_address(ip)
        return addr.is_private or addr.is_loopback or addr.is_reserved or addr.is_link_local
    except ValueError:
        return True  # unparseable → skip


def _parse_ipinfo_response(data: dict) -> dict:
    """Extract only the 4 geo keys we need; absent/falsy keys are omitted."""
    result: dict = {}
    if data.get("city"):
        result["ct"] = data["city"]
    if data.get("region"):
        result["st"] = data["region"]
    if data.get("postal"):
        result["zp"] = data["postal"]
    if data.get("country"):
        result["country"] = data["country"]
    return result


def lookup_geo(ip: Optional[str]) -> Optional[dict]:
    """Return geo dict {ct, st, zp, country} for a public IP, or None.

    Fail-safe: any exception returns None without raising.
    Cache miss → HTTP call → cache result (even empty dict to avoid re-calling).
    """
    if not ip:
        return None
    if not settings.IPINFO_TOKEN:
        return None  # geo disabled
    if _is_non_public(ip):
        return None  # private/loopback/reserved — skip

    cache_key = f"{_GEO_CACHE_PREFIX}{ip}"

    # ── Try in-process cache first (best-effort) ─────────────────────────────
    try:
        cached = get_backend().get(cache_key)
        if cached is not None:
            return json.loads(cached)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Meta geo: cache read error for ip=%s: %s", ip, exc)
        # Continue without cache — do the HTTP call anyway

    # ── HTTP lookup ───────────────────────────────────────────────────────────
    try:
        url = _IPINFO_URL.format(ip=ip, token=settings.IPINFO_TOKEN)
        with httpx.Client(timeout=3.0) as client:
            resp = client.get(url)
        if resp.status_code >= 400:
            logger.warning("Meta geo: ipinfo returned status=%s for ip=%s", resp.status_code, ip)
            return None
        data = resp.json()
        geo = _parse_ipinfo_response(data)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Meta geo: lookup failed for ip=%s: %s", ip, exc)
        return None

    # ── Cache result (even empty dict → avoid repeated calls for bad IPs) ────
    try:
        get_backend().setex(cache_key, _GEO_CACHE_TTL, json.dumps(geo))
    except Exception as exc:  # noqa: BLE001
        logger.warning("Meta geo: cache write error for ip=%s: %s", ip, exc)

    return geo or None  # return None when empty dict (no usable geo fields)
