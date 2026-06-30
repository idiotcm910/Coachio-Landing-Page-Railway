"""Admin endpoints: cross-funnel and cross-product revenue rollups.

Feeds the Funnel and Product tabs of the system-admin Revenue page. System-admin
auth only; date window mirrors course-analytics (default last 30 days, max 31).
"""
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.db.base import get_db
from app.middleware.auth import require_role
from app.models.admin_user import AdminUser
from app.schemas.funnel_revenue_analytics import (
    FunnelRevenueListResponse,
    ProductRevenueDetail,
    ProductRevenueListResponse,
)
from app.services.funnel_product_detail_service import get_product_revenue_detail
from app.services.funnel_revenue_analytics_service import FunnelRevenueAnalyticsService
from app.utils.date_utils import DateWindowError


router = APIRouter()


class AdminOnlyDependency:
    async def __call__(self, current_user: AdminUser = Depends(require_role("admin"))):
        return current_user


admin_only = AdminOnlyDependency()


def resolve_window_or_400(start_date: Optional[date], end_date: Optional[date]):
    try:
        return FunnelRevenueAnalyticsService.resolve_analytics_window(start_date, end_date)
    except DateWindowError as error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error))


@router.get("/revenue/by-funnel", response_model=FunnelRevenueListResponse)
async def get_revenue_by_funnel(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    admin: AdminUser = Depends(admin_only),
):
    start_dt, end_dt = resolve_window_or_400(start_date, end_date)
    return FunnelRevenueAnalyticsService.get_revenue_by_funnel(db, start_dt, end_dt, page, page_size, search)


@router.get("/revenue/by-product", response_model=ProductRevenueListResponse)
async def get_revenue_by_product(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    admin: AdminUser = Depends(admin_only),
):
    start_dt, end_dt = resolve_window_or_400(start_date, end_date)
    return FunnelRevenueAnalyticsService.get_revenue_by_product(db, start_dt, end_dt, page, page_size, search)


@router.get("/revenue/by-product/{product_id}", response_model=ProductRevenueDetail)
async def get_product_detail(
    product_id: str,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: Session = Depends(get_db),
    admin: AdminUser = Depends(admin_only),
):
    start_dt, end_dt = resolve_window_or_400(start_date, end_date)
    return get_product_revenue_detail(db, product_id, start_dt, end_dt)
