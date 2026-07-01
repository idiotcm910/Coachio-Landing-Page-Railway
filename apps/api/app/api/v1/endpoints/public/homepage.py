"""Public site-homepage resolver — /api/v1/public/homepage.

Returns the discriminated payload (funnel | none) the public root `/` renders in
place. Write-through cached; the setter evicts the cache key.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core import landing_cache
from app.db.base import get_db
from app.schemas.site_homepage import PublicHomepageResponse
from app.services import site_homepage_service as svc

router = APIRouter()


@router.get("", response_model=PublicHomepageResponse)
def get_public_homepage(db: Session = Depends(get_db)):
    cached = landing_cache.cache_get(landing_cache.homepage_key())
    if cached is not None:
        return cached
    payload = svc.resolve_public(db)
    landing_cache.cache_set(landing_cache.homepage_key(), payload)
    return payload
