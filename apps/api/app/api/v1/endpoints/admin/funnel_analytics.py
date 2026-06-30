"""Admin funnel analytics — /api/v1/admin/funnels/{funnel_id}/analytics.

Single overview endpoint returning revenue, per-page traffic, conversion rates
and a daily series. Time window is capped at 1 month (31 days, D21).
"""
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.base import get_db
from app.middleware.auth import require_role
from app.models import Funnel
from app.models.admin_user import AdminUser
from app.schemas.funnel_analytics import FunnelAnalyticsOverview
from app.services.funnel_analytics_service import FunnelAnalyticsService
from app.utils.date_utils import DateWindowError

router = APIRouter()


def get_funnel_or_404(db: Session, funnel_id: str) -> Funnel:
    funnel = db.query(Funnel).filter(Funnel.id == funnel_id).first()
    if funnel is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Funnel not found")
    return funnel


@router.get("/{funnel_id}/analytics", response_model=FunnelAnalyticsOverview)
def get_funnel_analytics(
    funnel_id: str,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: AdminUser = Depends(require_role("admin")),
):
    get_funnel_or_404(db, funnel_id)
    try:
        start_dt, end_dt = FunnelAnalyticsService.resolve_analytics_window(start_date, end_date)
    except DateWindowError as error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error))
    return FunnelAnalyticsService.get_overview(db, funnel_id, start_dt, end_dt)
