"""Resolve audience_config (multi-funnel + filters) -> deduped recipients.

Generalizes admin/leads `_filtered_leads` to many funnels. Dedup by email:
Postgres uses DISTINCT ON (lower(email)); SQLite (tests) falls back to Python dedup.
"""
from collections.abc import Iterator

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.funnel_order import FunnelOrder
from app.models.lead import Lead
from app.schemas.broadcast import AudienceConfig

_PURCHASE_THRESHOLD = settings.META_PURCHASE_MIN_VND


def resolve_audience_config(raw) -> AudienceConfig:
    if raw is None:
        return AudienceConfig()
    if isinstance(raw, AudienceConfig):
        return raw
    return AudienceConfig.model_validate(raw)


def _paid_subquery(db: Session):
    return db.query(FunnelOrder.id).filter(
        FunnelOrder.lead_id == Lead.id,
        FunnelOrder.status == "SUCCESS",
        FunnelOrder.final_amount > _PURCHASE_THRESHOLD,
    )


def _filtered_query(db: Session, cfg: AudienceConfig):
    """Base filtered Lead query (NOT yet deduped)."""
    q = db.query(Lead).filter(Lead.source_funnel_id.in_(cfg.funnel_ids))
    f = cfg.filters
    if f.converted is True:
        q = q.filter(Lead.converted_at.isnot(None))
    elif f.converted is False:
        q = q.filter(Lead.converted_at.is_(None))
    if f.status == "purchased":
        q = q.filter(_paid_subquery(db).exists())
    elif f.status == "lead":
        # Stored status 'lead' AND no paid order
        q = q.filter(~_paid_subquery(db).exists(), Lead.status == "lead")
    elif f.status == "subscribed":
        # Opted in via landing form, no paid order yet
        q = q.filter(~_paid_subquery(db).exists(), Lead.status == "subscribed")
    if f.created_from:
        q = q.filter(Lead.created_at >= f.created_from)
    if f.created_to:
        q = q.filter(Lead.created_at <= f.created_to)
    return q


def count_audience(db: Session, cfg: AudienceConfig) -> int:
    if not cfg.funnel_ids:
        return 0
    sub = _filtered_query(db, cfg).with_entities(func.lower(Lead.email)).distinct().subquery()
    return db.query(func.count()).select_from(sub).scalar() or 0


def iter_audience(
    db: Session, cfg: AudienceConfig, chunk_size: int = 5000
) -> Iterator[list[tuple[str, str | None, str]]]:
    """Yield chunks of (email, name, lead_id), deduped by lowercased email.

    Postgres path uses DISTINCT ON (lower(email)); SQLite path dedups in Python.
    """
    if not cfg.funnel_ids:
        return
    bind = db.get_bind()
    is_pg = bind is not None and bind.dialect.name == "postgresql"
    base = _filtered_query(db, cfg)
    if is_pg:
        rows_q = (
            base.order_by(func.lower(Lead.email), Lead.created_at.desc())
            .distinct(func.lower(Lead.email))
            .with_entities(Lead.email, Lead.name, Lead.id)
        )
        rows = rows_q.yield_per(chunk_size)
    else:
        # SQLite: order newest-first, dedup in Python keeping first seen.
        rows_q = base.order_by(Lead.created_at.desc()).with_entities(Lead.email, Lead.name, Lead.id)
        rows = rows_q.all()
    seen: set[str] = set()
    chunk: list[tuple[str, str | None, str]] = []
    for email, name, lead_id in rows:
        key = (email or "").lower()
        if not key or key in seen:
            continue
        seen.add(key)
        chunk.append((email, name, lead_id))
        if len(chunk) >= chunk_size:
            yield chunk
            chunk = []
    if chunk:
        yield chunk
