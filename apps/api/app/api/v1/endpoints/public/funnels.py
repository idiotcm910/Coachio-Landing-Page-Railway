"""Public (anonymous) funnel endpoints.

Routes:
  GET    /public/funnels/{slug}                    — resolved landing (write-through cache)
  POST   /public/funnels/{slug}/quote              — stackable-discount quote (no auth)
  POST   /public/funnels/{slug}/checkout           — lead capture + order (SePay QR or free)
  GET    /public/funnels/orders/{order_id}/status  — poll order status (+ success payload)
  POST   /public/funnels/{slug}/track               — anonymous page-view tracking (analytics)
"""

import logging

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.rate_limit import rate_limit
from app.db.base import get_db
from app.models import Funnel, FunnelOrder
from app.schemas.funnel import PublicFunnelLandingResponse
from app.schemas.funnel_analytics import FunnelTrackRequest
from app.schemas.funnel_checkout import (
    FunnelCheckoutRequest,
    FunnelCheckoutResponse,
    FunnelOrderStatusResponse,
    FunnelQuoteRequest,
    FunnelQuoteResponse,
)
from app.services.funnel_analytics_service import FunnelAnalyticsService
from app.services.funnel_landing_service import get_public_landing
from app.services.funnel_order_service import FunnelOrderService

logger = logging.getLogger(__name__)

router = APIRouter()

_checkout_rate_limit = rate_limit(max_calls=5, window_seconds=60, key_prefix="funnels:checkout")
_track_rate_limit = rate_limit(max_calls=30, window_seconds=60, key_prefix="funnels:track")


def _get_published_funnel(db: Session, slug: str) -> Funnel:
    funnel = db.query(Funnel).filter(Funnel.slug == slug, Funnel.status == "published").first()
    if funnel is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Funnel not found")
    return funnel


@router.get("/{slug}", response_model=PublicFunnelLandingResponse, summary="Public funnel landing (cached)")
def public_funnel_landing(slug: str, db: Session = Depends(get_db)):
    """Resolved landing payload (sections + SEO + variables) via write-through cache (D16)."""
    funnel = _get_published_funnel(db, slug)
    return get_public_landing(db, funnel)


@router.post("/{slug}/quote", response_model=FunnelQuoteResponse, summary="Quote with stackable discounts")
def public_funnel_quote(slug: str, payload: FunnelQuoteRequest, db: Session = Depends(get_db)):
    funnel = _get_published_funnel(db, slug)
    return FunnelOrderService.quote(db, funnel, payload.discount_codes)


@router.post(
    "/{slug}/checkout",
    response_model=FunnelCheckoutResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create funnel order (free orders complete immediately)",
    dependencies=[_checkout_rate_limit],  # rate_limit() already returns Depends(...)
)
def public_funnel_checkout(
    slug: str,
    payload: FunnelCheckoutRequest,
    background_tasks: BackgroundTasks,
    request: Request,
    db: Session = Depends(get_db),
):
    funnel = _get_published_funnel(db, slug)
    # Build request_meta for Meta CAPI Advanced Matching (browser signals, D4, D5)
    # fbp/fbc from checkout body; IP/UA from HTTP headers
    request_meta: dict = {}
    if request.client:
        request_meta["client_ip_address"] = request.client.host
    ua = request.headers.get("user-agent")
    if ua:
        request_meta["client_user_agent"] = ua
    if payload.fbp:
        request_meta["fbp"] = payload.fbp
    if payload.fbc:
        request_meta["fbc"] = payload.fbc
    # event_id from body takes precedence; fallback is deterministic (set in complete_order)
    if payload.event_id:
        request_meta["event_id"] = payload.event_id
    return FunnelOrderService.checkout(db, funnel, payload, background_tasks=background_tasks, request_meta=request_meta)


@router.get(
    "/orders/{order_id}/status",
    response_model=FunnelOrderStatusResponse,
    summary="Poll funnel order status",
)
def public_funnel_order_status(order_id: str, db: Session = Depends(get_db)):
    order = db.query(FunnelOrder).filter(FunnelOrder.id == order_id).first()
    if order is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    return FunnelOrderService.order_status(db, order)


@router.post(
    "/{slug}/track",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Track an anonymous funnel page view (analytics)",
    dependencies=[_track_rate_limit],
)
def public_funnel_track(slug: str, payload: FunnelTrackRequest, db: Session = Depends(get_db)):
    """Best-effort page-view tracking. Tracking failures never break the public UX."""
    funnel = _get_published_funnel(db, slug)
    try:
        FunnelAnalyticsService.track_page_view(db, funnel.id, payload.page, payload.visitor_id)
    except Exception:  # noqa: BLE001 — tracking is best-effort, must not surface to visitors
        logger.warning("Funnel page-view tracking failed for slug=%s page=%s", slug, payload.page, exc_info=True)
    return None
