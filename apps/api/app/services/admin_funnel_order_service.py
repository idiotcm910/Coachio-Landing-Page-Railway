"""Admin read-only service for funnel orders (keyset pagination + summary)."""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import func, tuple_
from sqlalchemy.orm import Session

from app.models.funnel_order import FunnelOrder
from app.services._cursor import decode, encode


# ---------------------------------------------------------------------------
# Internal filter builder
# ---------------------------------------------------------------------------

def _apply_filters(
    query,
    *,
    status: str,
    q: Optional[str],
    funnel_id: Optional[str],
    date_from: Optional[datetime],
    date_to: Optional[datetime],
):
    """Apply shared WHERE clauses to a SQLAlchemy query."""
    if status != "ALL":
        query = query.filter(FunnelOrder.status == status)

    if q:
        ql = q.lower()
        ql_escaped = ql.replace("%", r"\%").replace("_", r"\_")
        qu_escaped = q.upper().replace("%", r"\%").replace("_", r"\_")
        query = query.filter(
            func.lower(FunnelOrder.buyer_email).like(f"{ql_escaped}%") |
            FunnelOrder.order_code.like(f"{qu_escaped}%") |
            func.lower(FunnelOrder.buyer_full_name).like(f"{ql_escaped}%")
        )

    if funnel_id:
        query = query.filter(FunnelOrder.funnel_id == funnel_id)

    # Date range: use paid_at for SUCCESS-only view, else created_at
    date_col = FunnelOrder.paid_at if status != "ALL" else FunnelOrder.created_at
    if date_from:
        query = query.filter(date_col >= date_from)
    if date_to:
        query = query.filter(date_col <= date_to)

    return query


# ---------------------------------------------------------------------------
# List (keyset pagination)
# ---------------------------------------------------------------------------

def list_keyset(
    db: Session,
    *,
    status: str = "SUCCESS",
    q: Optional[str] = None,
    funnel_id: Optional[str] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    cursor: Optional[str] = None,
    per_page: int = 20,
    sort_by: str = "paid_at",
    sort_order: str = "desc",
):
    """Return one page of lightweight funnel order rows using keyset pagination."""
    # paid_at is only non-NULL for SUCCESS orders; fall back to created_at otherwise.
    use_paid_at = (sort_by == "paid_at" and status == "SUCCESS")
    sort_col = FunnelOrder.paid_at if use_paid_at else FunnelOrder.created_at
    is_desc = sort_order.lower() != "asc"

    query = db.query(
        FunnelOrder.id,
        FunnelOrder.order_code,
        FunnelOrder.buyer_email,
        FunnelOrder.buyer_full_name,
        FunnelOrder.buyer_phone,
        FunnelOrder.funnel_title,
        FunnelOrder.product_name,
        FunnelOrder.final_amount,
        FunnelOrder.status,
        FunnelOrder.payment_provider,
        FunnelOrder.paid_at,
        FunnelOrder.created_at,
    )

    query = _apply_filters(
        query, status=status, q=q, funnel_id=funnel_id,
        date_from=date_from, date_to=date_to,
    )

    # Keyset cursor
    if cursor:
        cur_ts_str, cur_id = decode(cursor)  # ValueError propagated to caller
        try:
            cur_ts = datetime.fromisoformat(cur_ts_str) if cur_ts_str else None
        except ValueError:
            raise ValueError("invalid cursor timestamp")
        if cur_ts is not None:
            predicate = (
                tuple_(sort_col, FunnelOrder.id) < (cur_ts, cur_id)
                if is_desc
                else tuple_(sort_col, FunnelOrder.id) > (cur_ts, cur_id)
            )
            query = query.filter(predicate)
        else:
            predicate = FunnelOrder.id < cur_id if is_desc else FunnelOrder.id > cur_id
            query = query.filter(predicate)

    if is_desc:
        query = query.order_by(sort_col.desc(), FunnelOrder.id.desc())
    else:
        query = query.order_by(sort_col.asc(), FunnelOrder.id.asc())

    rows = query.limit(per_page + 1).all()
    has_next = len(rows) > per_page
    rows = rows[:per_page]

    next_cursor: Optional[str] = None
    if has_next and rows:
        last = rows[-1]
        last_ts = last.paid_at if use_paid_at else last.created_at  # type: ignore[attr-defined]
        next_cursor = encode(last_ts, last.id)

    return rows, next_cursor, has_next


# ---------------------------------------------------------------------------
# Summary (aggregate)
# ---------------------------------------------------------------------------

def get_summary(
    db: Session,
    *,
    status: str = "SUCCESS",  # accepted for signature parity; summary is always SUCCESS-only
    q: Optional[str] = None,
    funnel_id: Optional[str] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
) -> dict:
    """Return SUCCESS-order KPIs: success_count, revenue, aov."""
    def _success_base():
        return _apply_filters(
            db.query(FunnelOrder), status="SUCCESS", q=q, funnel_id=funnel_id,
            date_from=date_from, date_to=date_to,
        )

    agg = _success_base().with_entities(
        func.count(FunnelOrder.id).label("cnt"),
        func.coalesce(func.sum(FunnelOrder.final_amount), 0).label("rev"),
    ).one()

    success_count = agg.cnt or 0
    revenue = int(agg.rev or 0)
    aov = revenue // success_count if success_count > 0 else 0

    return {
        "success_count": success_count,
        "revenue": revenue,
        "aov": aov,
    }


# ---------------------------------------------------------------------------
# Detail
# ---------------------------------------------------------------------------

def get_detail(db: Session, order_id: str) -> Optional[FunnelOrder]:
    """Fetch a single funnel order by id."""
    return (
        db.query(FunnelOrder)
        .filter(FunnelOrder.id == order_id)
        .first()
    )
