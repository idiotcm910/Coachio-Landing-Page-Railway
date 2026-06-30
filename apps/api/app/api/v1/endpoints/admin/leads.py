"""Admin Leads list/filter/export — /api/v1/admin/leads (task 6.5, D5)."""

import csv
import io
from datetime import datetime

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.core.config import settings
from app.db.base import get_db
from app.middleware.auth import require_role
from app.models import Lead
from app.models.funnel_order import FunnelOrder
from app.models.admin_user import AdminUser
from app.schemas.lead import LeadListResponse, LeadRead

router = APIRouter()

# A lead counts as "purchased" only when a completed order exceeds this VND
# threshold (strictly greater). Cheaper/free completions stay plain "lead".
_PURCHASE_THRESHOLD = settings.META_PURCHASE_MIN_VND


def _paid_amount_subquery(db: Session):
    """EXISTS condition: lead has a SUCCESS order above the purchase threshold."""
    return db.query(FunnelOrder.id).filter(
        FunnelOrder.lead_id == Lead.id,
        FunnelOrder.status == "SUCCESS",
        FunnelOrder.final_amount > _PURCHASE_THRESHOLD,
    )


def _filtered_leads(
    db: Session,
    funnel_id: str | None,
    converted: bool | None,
    created_from: datetime | None,
    created_to: datetime | None,
    email: str | None = None,
    status: str | None = None,
):
    query = db.query(Lead).options(joinedload(Lead.source_funnel))
    if funnel_id:
        query = query.filter(Lead.source_funnel_id == funnel_id)
    if email:
        query = query.filter(Lead.email.ilike(f"%{email.strip()}%"))
    if converted is True:
        query = query.filter(Lead.converted_at.isnot(None))
    elif converted is False:
        query = query.filter(Lead.converted_at.is_(None))
    if status == "purchased":
        # Has a qualifying paid order — derived status
        query = query.filter(_paid_amount_subquery(db).exists())
    elif status == "lead":
        # Stored status 'lead' AND no paid order
        query = query.filter(~_paid_amount_subquery(db).exists(), Lead.status == "lead")
    elif status == "subscribed":
        # Stored status 'subscribed' AND no paid order (opted in via landing form)
        query = query.filter(~_paid_amount_subquery(db).exists(), Lead.status == "subscribed")
    if created_from:
        query = query.filter(Lead.created_at >= created_from)
    if created_to:
        query = query.filter(Lead.created_at <= created_to)
    return query.order_by(Lead.created_at.desc())


def _purchase_amounts(db: Session, lead_ids: list[str]) -> dict[str, int]:
    """Max SUCCESS order amount per lead — one query, avoids N+1."""
    if not lead_ids:
        return {}
    rows = (
        db.query(FunnelOrder.lead_id, func.max(FunnelOrder.final_amount))
        .filter(FunnelOrder.lead_id.in_(lead_ids), FunnelOrder.status == "SUCCESS")
        .group_by(FunnelOrder.lead_id)
        .all()
    )
    return {lead_id: (amount or 0) for lead_id, amount in rows}


def _serialize(lead: Lead, amount: int) -> LeadRead:
    # purchased is always derived from paid orders; otherwise use the stored status
    # (subscribed | lead) so all three states are reflected in list/export/broadcast.
    if amount > _PURCHASE_THRESHOLD:
        derived_status = "purchased"
    else:
        derived_status = lead.status  # 'subscribed' or 'lead'
    return LeadRead(
        id=lead.id,
        email=lead.email,
        name=lead.name,
        phone=lead.phone,
        source_funnel_id=lead.source_funnel_id,
        funnel_title=lead.source_funnel.title if lead.source_funnel else None,
        converted_at=lead.converted_at,
        created_at=lead.created_at,
        purchase_amount=amount,
        status=derived_status,
    )


@router.get("", response_model=LeadListResponse)
def list_leads(
    funnel_id: str | None = Query(None),
    converted: bool | None = Query(None),
    status: str | None = Query(None, description="Filter by lifecycle status: subscribed | lead | purchased"),
    created_from: datetime | None = Query(None),
    created_to: datetime | None = Query(None),
    email: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: AdminUser = Depends(require_role("admin")),
):
    query = _filtered_leads(db, funnel_id, converted, created_from, created_to, email, status)
    total = query.count()
    leads = query.offset((page - 1) * page_size).limit(page_size).all()
    amounts = _purchase_amounts(db, [lead.id for lead in leads])
    items = [_serialize(lead, amounts.get(lead.id, 0)) for lead in leads]
    return LeadListResponse(items=items, total=total, page=page, page_size=page_size)


@router.get("/export")
def export_leads_csv(
    funnel_id: str | None = Query(None),
    converted: bool | None = Query(None),
    status: str | None = Query(None),
    created_from: datetime | None = Query(None),
    created_to: datetime | None = Query(None),
    email: str | None = Query(None),
    db: Session = Depends(get_db),
    current_user: AdminUser = Depends(require_role("admin")),
):
    """CSV export for remarketing (BR-5)."""
    leads = _filtered_leads(db, funnel_id, converted, created_from, created_to, email, status).all()
    amounts = _purchase_amounts(db, [lead.id for lead in leads])
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(
        ["email", "name", "phone", "funnel", "status", "purchase_amount", "converted_at", "created_at"]
    )
    for lead in leads:
        row = _serialize(lead, amounts.get(lead.id, 0))
        writer.writerow(
            [
                row.email,
                row.name or "",
                row.phone or "",
                row.funnel_title or "",
                row.status,
                row.purchase_amount,
                row.converted_at.isoformat() if row.converted_at else "",
                row.created_at.isoformat() if row.created_at else "",
            ]
        )
    buffer.seek(0)
    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=leads.csv"},
    )
