"""Public read-only redirect config — /api/v1/public/url-redirects/config.

Consumed by the Next.js middleware and not-found page. Returns only active rules
plus the 404 fallback config. No auth (public, cacheable).
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.base import get_db
from app.schemas.url_redirect import NotFoundConfig, RedirectPublicConfig
from app.services import url_redirect_service as svc

router = APIRouter()


@router.get("/config", response_model=RedirectPublicConfig)
def get_redirect_config(db: Session = Depends(get_db)):
    rules = svc.list_active_rules(db)
    not_found = NotFoundConfig(**svc.get_not_found_config(db))
    return RedirectPublicConfig(rules=rules, not_found=not_found)
