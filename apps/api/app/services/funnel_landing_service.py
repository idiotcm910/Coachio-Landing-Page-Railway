"""Funnel public-landing payload builder + write-through cache (D16).

Reuses `app/core/landing_cache.py` (cache_get/set/evict — versioned keys, TTL
backstop, graceful cache-miss fallback). One refresh/evict helper is the ONLY
cache write path so admin write sites can't miss an invalidation.

Read path:  get_public_landing()  — cache GET → miss: build + SET.
Write path: refresh_funnel_landing_cache(funnel) — called from ALL admin write
            sites (section/SEO/variable/price/Zalo saves, default-discount
            changes, publish).
Eviction:   evict_funnel_landing_cache(slug) — unpublish/delete/slug-change.
"""
import logging

from sqlalchemy.orm import Session

from app.core.landing_cache import cache_evict, cache_get, cache_set
from app.models import Funnel
from app.services.funnel_discount_engine import compute_quote
from app.services.funnel_variable_resolver import render_funnel_tokens, resolve_variables

logger = logging.getLogger(__name__)

_CACHE_VERSION = "v1"


def funnel_landing_key(slug: str) -> str:
    return f"funnel:landing:{_CACHE_VERSION}:{slug}"


def build_public_landing_payload(db: Session, funnel: Funnel) -> dict:
    """Fully-resolved public landing payload — sections + SEO + variables.

    `price`/`final_price` bake in the funnel's valid default discounts, which
    is why default-discount changes must also write through (D16).
    """
    price = funnel.product.base_price if funnel.product else 0
    quote = compute_quote(db, "funnel", funnel.id, price, codes=[], include_default=True)
    variables = resolve_variables(
        funnel, discounted_price=quote.final_amount, discount_percent=quote.total_percent
    )

    landing = funnel.landing_page
    sections = []
    if landing:
        for section in landing.sections:
            if not section.is_visible:
                continue
            sections.append(
                {
                    "id": section.id,
                    "name": section.name,
                    # Landing HTML mirrors the course builder: length-validated on
                    # save (not nh3-stripped) and rendered in an isolated iframe.
                    "html": render_funnel_tokens(section.html, variables),
                    "theme_mode": section.theme_mode,
                    "section_type": section.section_type,
                    "anchor": section.anchor,
                    "responsive_config": section.responsive_config,
                    "sort_order": section.sort_order,
                }
            )

    seo = {
        "seo_title": (landing.seo_title if landing else None) or funnel.title,
        "seo_description": landing.seo_description if landing else None,
        "seo_keywords": landing.seo_keywords if landing else None,
        "canonical_url": landing.canonical_url if landing else None,
        "robots_index": landing.robots_index if landing else True,
        "robots_follow": landing.robots_follow if landing else True,
        "og_title": landing.og_title if landing else None,
        "og_description": landing.og_description if landing else None,
        "og_image_url": landing.og_image_url if landing else None,
        "og_type": landing.og_type if landing else None,
        "twitter_card": landing.twitter_card if landing else None,
        "twitter_title": landing.twitter_title if landing else None,
        "twitter_description": landing.twitter_description if landing else None,
        "twitter_image_url": landing.twitter_image_url if landing else None,
        "favicon_url": landing.favicon_url if landing else None,
    }

    # Meta Pixel: expose pixel_id + tracking_enabled; NEVER expose capi_token or test_code (D1)
    tracking_cfg = funnel.tracking_config or {}
    meta_pixel_id = tracking_cfg.get("meta_pixel_id") or None
    tracking_enabled = bool(tracking_cfg.get("enabled") and meta_pixel_id)

    return {
        "funnel_id": funnel.id,
        "slug": funnel.slug,
        "title": funnel.title,
        "product_name": funnel.product.name if funnel.product else "",
        "currency": funnel.currency or "VND",
        "price": price,
        "final_price": quote.final_amount,
        "zalo_link": funnel.zalo_link,
        "seo": seo,
        "sections": sections,
        "variables": variables,
        "meta_pixel_id": meta_pixel_id,
        "tracking_enabled": tracking_enabled,
    }


def get_public_landing(db: Session, funnel: Funnel) -> dict:
    """Read path: serve from cache; on miss compute + populate (published only)."""
    key = funnel_landing_key(funnel.slug)
    cached = cache_get(key)
    if cached is not None:
        return cached
    payload = build_public_landing_payload(db, funnel)
    if funnel.status == "published":
        cache_set(key, payload)
    return payload


def refresh_funnel_landing_cache(db: Session, funnel: Funnel) -> None:
    """Write-through: recompute + SET within the admin write request (D16).

    Draft/unpublished funnels are never cached — refresh degrades to eviction.
    """
    if funnel.status != "published":
        evict_funnel_landing_cache(funnel.slug)
        return
    try:
        payload = build_public_landing_payload(db, funnel)
        cache_set(funnel_landing_key(funnel.slug), payload)
    except Exception as exc:  # noqa: BLE001 - cache must never break admin writes
        logger.warning("Funnel landing cache refresh failed (%s): %s", funnel.slug, exc)


def evict_funnel_landing_cache(slug: str) -> None:
    """Eviction: unpublish/delete, or the OLD slug on slug change."""
    cache_evict(funnel_landing_key(slug))
