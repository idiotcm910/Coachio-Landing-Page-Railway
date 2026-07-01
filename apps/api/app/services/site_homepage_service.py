"""Site-homepage service (funnel-only edition).

Single source of truth = `site_settings` row keyed `homepage`, value JSON
`{"target_type": "funnel", "target_id": "<id>"}`. Absence/empty = default.

The resolver re-validates that the target funnel is still published at read time,
so a stale pointer degrades to the default homepage (type "none") instead of
erroring.
"""
import json
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core import landing_cache
from app.models import Funnel, SiteSetting
from app.services.funnel_landing_service import get_public_landing

HOMEPAGE_KEY = "homepage"


# --- raw setting access (site_settings KV) ------------------------------------

def _read_setting(db: Session) -> Optional[dict]:
    row = db.query(SiteSetting).filter(SiteSetting.key == HOMEPAGE_KEY).first()
    if not row or not row.value:
        return None
    try:
        data = json.loads(row.value)
    except (ValueError, TypeError):
        return None
    if data.get("target_type") == "funnel" and data.get("target_id"):
        return {"target_type": "funnel", "target_id": data["target_id"]}
    return None


def _write_setting(db: Session, target_type: str, target_id: str) -> None:
    payload = json.dumps({"target_type": target_type, "target_id": target_id})
    row = db.query(SiteSetting).filter(SiteSetting.key == HOMEPAGE_KEY).first()
    if row is None:
        db.add(SiteSetting(key=HOMEPAGE_KEY, value=payload))
    else:
        row.value = payload
    db.commit()
    landing_cache.cache_evict(landing_cache.homepage_key())


def _clear_setting(db: Session) -> None:
    row = db.query(SiteSetting).filter(SiteSetting.key == HOMEPAGE_KEY).first()
    if row is not None:
        db.delete(row)
        db.commit()
    landing_cache.cache_evict(landing_cache.homepage_key())


# --- published-target lookups -------------------------------------------------

def _published_funnel(db: Session, funnel_id: str) -> Optional[Funnel]:
    return (
        db.query(Funnel)
        .filter(Funnel.id == funnel_id, Funnel.status == "published")
        .first()
    )


# --- admin operations ---------------------------------------------------------

def get_admin_setting(db: Session) -> dict:
    """Current selection resolved to a display label (None = default homepage)."""
    setting = _read_setting(db)
    if setting is None:
        return {"target_type": None, "target_id": None, "title": None, "slug": None}

    funnel = db.query(Funnel).filter(Funnel.id == setting["target_id"]).first()
    if funnel is None:
        return {"target_type": None, "target_id": None, "title": None, "slug": None}
    return {"target_type": "funnel", "target_id": funnel.id, "title": funnel.title, "slug": funnel.slug}


def set_target(db: Session, target_type: str, target_id: str) -> dict:
    """Validate the funnel is published, persist it, evict cache. Returns admin setting."""
    if _published_funnel(db, target_id) is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Funnel not found or not published")
    _write_setting(db, target_type, target_id)
    return get_admin_setting(db)


def clear_target(db: Session) -> dict:
    _clear_setting(db)
    return get_admin_setting(db)


def list_options(db: Session) -> dict:
    """Published funnels selectable as homepage."""
    funnels = (
        db.query(Funnel)
        .filter(Funnel.status == "published")
        .order_by(Funnel.created_at.desc())
        .all()
    )
    funnel_opts = [{"type": "funnel", "id": f.id, "title": f.title, "slug": f.slug} for f in funnels]
    return {"funnels": funnel_opts}


# --- public resolution --------------------------------------------------------

def resolve_public(db: Session) -> dict:
    """Discriminated homepage payload for `/`. Re-validates published state."""
    setting = _read_setting(db)
    if setting is None:
        return {"type": "none", "funnel": None}

    funnel = _published_funnel(db, setting["target_id"])
    if funnel is None:
        return {"type": "none", "funnel": None}
    return {"type": "funnel", "funnel": get_public_landing(db, funnel)}
