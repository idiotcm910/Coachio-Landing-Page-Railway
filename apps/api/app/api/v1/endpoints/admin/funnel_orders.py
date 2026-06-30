"""Admin read-only API for funnel orders."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db.base import get_db
from app.middleware.auth import require_role
from app.models.funnel_order import FunnelOrder
from app.models.admin_user import AdminUser
from app.schemas.funnel_order_admin import (
    AdminFunnelOrderDetail,
    AdminFunnelOrderListItem,
    AdminFunnelOrderListResponse,
    AdminFunnelOrderSummary,
)
from app.services import admin_funnel_order_service as svc
from app.services.funnel_order_service import FunnelOrderService

router = APIRouter()


def _to_detail(order: FunnelOrder) -> AdminFunnelOrderDetail:
    """Map a FunnelOrder row to the admin detail schema (amount = final_amount)."""
    return AdminFunnelOrderDetail(
        id=order.id,
        order_code=order.order_code,
        status=order.status,
        payment_provider=order.payment_provider,
        amount=order.final_amount,
        subtotal_amount=order.subtotal_amount,
        discount_amount=order.discount_amount,
        buyer_email=order.buyer_email,
        buyer_full_name=order.buyer_full_name,
        buyer_phone=order.buyer_phone,
        funnel_title=order.funnel_title,
        funnel_slug=order.funnel_slug,
        product_name=order.product_name,
        funnel_id=order.funnel_id,
        lead_id=order.lead_id,
        created_at=order.created_at,
        paid_at=order.paid_at,
        updated_at=order.updated_at,
        manual_activated_by=order.manual_activated_by,
        manual_activated_at=order.manual_activated_at,
    )


def _common_filters(
    status: str = Query("SUCCESS", description="Order status; use ALL for any"),
    q: Optional[str] = Query(None, max_length=200, description="Prefix search on email/name/order_code"),
    funnel_id: Optional[str] = Query(None),
    date_from: Optional[datetime] = Query(None),
    date_to: Optional[datetime] = Query(None),
):
    return dict(status=status, q=q, funnel_id=funnel_id,
                date_from=date_from, date_to=date_to)


# NOTE: /summary MUST be declared before /{order_id} to avoid path collision.


@router.get("/summary", response_model=AdminFunnelOrderSummary)
def get_summary(
    filters: dict = Depends(_common_filters),
    db: Session = Depends(get_db),
    _admin: AdminUser = Depends(require_role("admin")),
):
    """Aggregate stats for the current filter set."""
    data = svc.get_summary(db, **filters)
    return AdminFunnelOrderSummary(**data)


@router.get("", response_model=AdminFunnelOrderListResponse)
def list_orders(
    filters: dict = Depends(_common_filters),
    cursor: Optional[str] = Query(None),
    per_page: int = Query(20, ge=1, le=100),
    sort_by: str = Query("paid_at", pattern="^(paid_at|created_at)$"),
    sort_order: str = Query("desc", pattern="^(asc|desc)$"),
    db: Session = Depends(get_db),
    _admin: AdminUser = Depends(require_role("admin")),
):
    """Keyset-paginated list of funnel orders. Pass `cursor` from previous response."""
    try:
        rows, next_cursor, has_next = svc.list_keyset(
            db,
            cursor=cursor,
            per_page=per_page,
            sort_by=sort_by,
            sort_order=sort_order,
            **filters,
        )
    except ValueError:
        raise HTTPException(status_code=400, detail="invalid cursor")

    items = [
        AdminFunnelOrderListItem(
            id=r.id,
            order_code=r.order_code,
            buyer_email=r.buyer_email,
            buyer_full_name=r.buyer_full_name,
            buyer_phone=r.buyer_phone,
            funnel_title=r.funnel_title,
            product_name=r.product_name,
            amount=r.final_amount,
            status=r.status,
            payment_provider=r.payment_provider,
            paid_at=r.paid_at,
            created_at=r.created_at,
        )
        for r in rows
    ]
    return AdminFunnelOrderListResponse(items=items, next_cursor=next_cursor, has_next=has_next)


@router.get("/{order_id}", response_model=AdminFunnelOrderDetail)
def get_order_detail(
    order_id: str,
    db: Session = Depends(get_db),
    _admin: AdminUser = Depends(require_role("admin")),
):
    """Full detail for a single funnel order."""
    order = svc.get_detail(db, order_id)
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")

    return _to_detail(order)


@router.post("/{order_id}/activate", response_model=AdminFunnelOrderDetail)
def activate_order(
    order_id: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    admin: AdminUser = Depends(require_role("admin")),
):
    """Manually mark a PENDING funnel order as SUCCESS and run every success-flow.

    For the real-world case where the buyer paid but altered the SePay transfer
    memo, so the webhook could not auto-match by order_code/amount. Reuses the
    shared, idempotent `complete_order` routine — same side-effects as a webhook:
    receipt email, lead conversion, discount redemption, course/agent-skill
    fulfilment, and Meta CAPI (using the browser signals persisted at checkout).
    """
    order = svc.get_detail(db, order_id)
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.status != "PENDING":
        raise HTTPException(status_code=409, detail="Order is not pending")

    activated = FunnelOrderService.complete_order(db, order, background_tasks=background_tasks)
    if not activated:
        # Lost a race with the webhook between the guard above and the UPDATE.
        raise HTTPException(status_code=409, detail="Order is not pending")

    order.manual_activated_by = admin.id
    order.manual_activated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(order)

    return _to_detail(order)
