"""Shared lead lifecycle-status counting for funnel rollups.

Single source of truth for how a lead's status is derived, used by both the
per-funnel analytics overview and the cross-funnel/cross-product revenue rollups
so the numbers always agree.

A lead counts as ``purchased`` when it has a SUCCESS funnel order whose
``final_amount`` strictly exceeds the purchase threshold (mirrors the admin leads
list). Remaining leads keep their stored status (``subscribed`` | ``lead``).
``purchased`` is derived at query time and never stored.
"""
from datetime import datetime

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.funnel_order import FunnelOrder
from app.models.lead import Lead

# A lead counts as "purchased" only when a completed order strictly exceeds this
# VND threshold — mirrors the admin leads list derivation.
PURCHASE_THRESHOLD = settings.META_PURCHASE_MIN_VND

# Zero-valued breakdown used as the default for funnels with no leads.
EMPTY_COUNTS = {"subscribed": 0, "lead": 0, "purchased": 0, "total": 0}


def _purchased_exists(db: Session):
    """Correlated EXISTS: the outer Lead has a qualifying SUCCESS order."""
    return (
        db.query(FunnelOrder.id)
        .filter(
            FunnelOrder.lead_id == Lead.id,
            FunnelOrder.status == "SUCCESS",
            FunnelOrder.final_amount > PURCHASE_THRESHOLD,
        )
        .exists()
    )


def lead_counts_for_funnel(
    db: Session, funnel_id: str, start_dt: datetime, end_dt: datetime
) -> dict[str, int]:
    """Status breakdown for a single funnel's leads captured inside the window."""
    base = db.query(Lead).filter(
        Lead.source_funnel_id == funnel_id,
        Lead.created_at >= start_dt,
        Lead.created_at < end_dt,
    )
    paid_exists = _purchased_exists(db)
    purchased = base.filter(paid_exists).count()
    subscribed = base.filter(~paid_exists, Lead.status == "subscribed").count()
    lead = base.filter(~paid_exists, Lead.status == "lead").count()
    return {
        "subscribed": subscribed,
        "lead": lead,
        "purchased": purchased,
        "total": purchased + subscribed + lead,
    }


def lead_counts_by_funnel(
    db: Session, funnel_ids: list[str], start_dt: datetime, end_dt: datetime
) -> dict[str, dict[str, int]]:
    """Bulk status breakdown grouped by ``source_funnel_id`` for many funnels.

    Returns a mapping funnel_id -> {subscribed, lead, purchased, total}; every
    requested funnel id is present (zero-filled when it has no leads).
    """
    result: dict[str, dict[str, int]] = {fid: dict(EMPTY_COUNTS) for fid in funnel_ids}
    if not funnel_ids:
        return result

    paid_exists = _purchased_exists(db)
    base = db.query(Lead.source_funnel_id, func.count(Lead.id)).filter(
        Lead.source_funnel_id.in_(funnel_ids),
        Lead.created_at >= start_dt,
        Lead.created_at < end_dt,
    )
    for fid, count in base.filter(paid_exists).group_by(Lead.source_funnel_id).all():
        result[fid]["purchased"] = count
    for fid, count in base.filter(~paid_exists, Lead.status == "subscribed").group_by(Lead.source_funnel_id).all():
        result[fid]["subscribed"] = count
    for fid, count in base.filter(~paid_exists, Lead.status == "lead").group_by(Lead.source_funnel_id).all():
        result[fid]["lead"] = count

    for counts in result.values():
        counts["total"] = counts["subscribed"] + counts["lead"] + counts["purchased"]
    return result
