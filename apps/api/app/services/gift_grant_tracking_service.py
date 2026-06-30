"""Gift grant tracking / audit — read the ledger with rich filters + stats + resend.

The ledger row already records who/when/what/source/email-status; this service
adds filtering, aggregate stats, a detail view with navigation context, and
resend (single + bulk) that re-sends email WITHOUT re-granting perks.
"""
from datetime import datetime, timezone

from sqlalchemy import func, literal, or_
from sqlalchemy.orm import Session

from app.models.funnel_order import FunnelOrder
from app.models.gift import Gift
from app.models.gift_campaign import GiftCampaign
from app.models.gift_grant import GiftGrant
from app.models.lead import Lead
from app.services.gift_fulfilment_service import send_delivery_email


def _source_type(source: str | None) -> str | None:
    if not source:
        return None
    if source.startswith("campaign:"):
        return "campaign"
    return "auto"  # order: / lead:


def _apply_filters(db: Session, q, *, gift_id=None, funnel_id=None, source_type=None,
                   email_status=None, email=None, date_from=None, date_to=None):
    if gift_id:
        q = q.filter(GiftGrant.gift_id == gift_id)
    if email_status:
        q = q.filter(GiftGrant.email_status == email_status)
    if email:
        q = q.filter(GiftGrant.email.ilike(f"%{email.lower()}%"))
    if date_from:
        q = q.filter(GiftGrant.granted_at >= date_from)
    if date_to:
        q = q.filter(GiftGrant.granted_at <= date_to)
    if source_type == "campaign":
        q = q.filter(GiftGrant.source.like("campaign:%"))
    elif source_type == "auto":
        q = q.filter(or_(GiftGrant.source.is_(None), ~GiftGrant.source.like("campaign:%")))
    if funnel_id:
        order_srcs = db.query(literal("order:") + FunnelOrder.id).filter(FunnelOrder.funnel_id == funnel_id)
        lead_srcs = db.query(literal("lead:") + Lead.id).filter(Lead.source_funnel_id == funnel_id)
        q = q.filter(or_(GiftGrant.source.in_(order_srcs), GiftGrant.source.in_(lead_srcs)))
    return q


def list_grants(db: Session, *, page: int = 1, size: int = 50, **filters) -> dict:
    base = _apply_filters(db, db.query(GiftGrant), **filters)
    total = base.with_entities(func.count(GiftGrant.id)).scalar() or 0
    rows = (
        base.order_by(GiftGrant.granted_at.desc())
        .offset((page - 1) * size)
        .limit(size)
        .all()
    )
    gift_names = _gift_name_map(db, {r.gift_id for r in rows})
    items = []
    for r in rows:
        d = {c.name: getattr(r, c.name) for c in GiftGrant.__table__.columns}
        d["gift_name"] = gift_names.get(r.gift_id)
        d["source_type"] = _source_type(r.source)
        items.append(d)
    return {"items": items, "total": total}


def _gift_name_map(db: Session, gift_ids: set) -> dict:
    if not gift_ids:
        return {}
    return {g.id: g.name for g in db.query(Gift.id, Gift.name).filter(Gift.id.in_(gift_ids)).all()}


def stats(db: Session, **filters) -> dict:
    base = _apply_filters(db, db.query(GiftGrant), **filters)
    total = base.with_entities(func.count(GiftGrant.id)).scalar() or 0
    distinct = base.with_entities(func.count(func.distinct(GiftGrant.email))).scalar() or 0
    failed = _apply_filters(db, db.query(GiftGrant), **{**filters, "email_status": "failed"}).with_entities(
        func.count(GiftGrant.id)
    ).scalar() or 0
    per_gift_rows = (
        base.with_entities(GiftGrant.gift_id, func.count(GiftGrant.id))
        .group_by(GiftGrant.gift_id)
        .all()
    )
    names = _gift_name_map(db, {gid for gid, _ in per_gift_rows})
    per_gift = [
        {"gift_id": gid, "gift_name": names.get(gid), "count": cnt} for gid, cnt in per_gift_rows
    ]
    return {
        "total_grants": total,
        "distinct_recipients": distinct,
        "email_failed_count": failed,
        "per_gift": per_gift,
    }


def detail(db: Session, grant_id: str) -> dict | None:
    g = db.query(GiftGrant).filter(GiftGrant.id == grant_id).first()
    if g is None:
        return None
    d = {c.name: getattr(g, c.name) for c in GiftGrant.__table__.columns}
    gift = db.query(Gift).filter(Gift.id == g.gift_id).first()
    d["gift_name"] = gift.name if gift else None
    d["source_type"] = _source_type(g.source)
    d["source_label"] = _source_label(db, g.source)
    return d


def _source_label(db: Session, source: str | None) -> str | None:
    if not source:
        return None
    kind, _, ident = source.partition(":")
    if kind == "order":
        o = db.query(FunnelOrder.order_code).filter(FunnelOrder.id == ident).first()
        return f"Order {o[0]}" if o else source
    if kind == "campaign":
        c = db.query(GiftCampaign.name).filter(GiftCampaign.id == ident).first()
        return f"Campaign {c[0]}" if c else source
    return source


def _siblings(db: Session, grant: GiftGrant) -> list[GiftGrant]:
    """All grants from the same delivery (same source + email) — one combined email."""
    return (
        db.query(GiftGrant)
        .filter(GiftGrant.source == grant.source, GiftGrant.email == grant.email)
        .all()
    )


def _resend_delivery(db: Session, grant: GiftGrant) -> bool:
    siblings = _siblings(db, grant)
    ok = send_delivery_email(
        [s.id for s in siblings],
        email_subject=grant.email_subject_snapshot or "",
        email_html=grant.email_html_snapshot or "",
        db=db,
    )
    now = datetime.now(timezone.utc)
    for s in siblings:
        s.resend_count = (s.resend_count or 0) + 1
        s.last_resend_at = now
    return ok


def resend(db: Session, grant_id: str) -> bool:
    g = db.query(GiftGrant).filter(GiftGrant.id == grant_id).first()
    if g is None:
        return False
    ok = _resend_delivery(db, g)
    db.commit()
    return ok


def bulk_retry_failed(db: Session, **filters) -> dict:
    """Re-send all email-failed deliveries in the current filter (no perk re-grant).

    Grouped by (source, email) so one combined email is re-sent per delivery.
    """
    base = _apply_filters(db, db.query(GiftGrant), **{**filters, "email_status": "failed"})
    grants = base.all()
    seen: set = set()
    resent = failed = 0
    for g in grants:
        key = (g.source, g.email)
        if key in seen:
            continue
        seen.add(key)
        ok = _resend_delivery(db, g)
        db.commit()
        if ok:
            resent += 1
        else:
            failed += 1
    return {"resent": resent, "failed": failed}
