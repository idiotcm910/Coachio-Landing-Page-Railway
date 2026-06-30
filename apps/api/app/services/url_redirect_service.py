"""URL redirect resolution + 404 fallback config service (admin-url-redirects D3).

`resolve_redirect` is pure (no DB) so it is unit-testable and mirrors the matching
the Next.js middleware performs. Exact rules win over wildcard rules. Wildcard
matches a prefix (source minus trailing '*') and appends the remaining suffix to
the target (target minus trailing '*').
"""

import json
from typing import Optional

from sqlalchemy.orm import Session

from app.models import SiteSetting, UrlRedirect

NOT_FOUND_KEY = "not_found_redirect"
_DEFAULT_NOT_FOUND = {"enabled": False, "target_url": "/"}


def resolve_redirect(path: str, rules: list[UrlRedirect]) -> Optional[tuple[str, int]]:
    """Return (target_url, status_code) if an active rule matches `path`, else None.

    Exact match takes precedence. Self-redirects are skipped (loop guard).
    """
    active = [r for r in rules if r.is_active]

    # Exact first.
    for rule in active:
        if rule.match_type == "exact" and rule.source_path == path:
            target = rule.target_url
            if target != path:
                return target, rule.status_code

    # Wildcard prefix.
    for rule in active:
        if rule.match_type != "wildcard":
            continue
        if not rule.source_path.endswith("/*"):
            continue
        prefix = rule.source_path[:-1]  # keep trailing '/', drop '*' -> '/blog/'
        if path == prefix.rstrip("/") or path.startswith(prefix):
            suffix = path[len(prefix):] if path.startswith(prefix) else ""
            target_prefix = rule.target_url[:-1] if rule.target_url.endswith("/*") else rule.target_url
            target = f"{target_prefix}{suffix}"
            if target != path:
                return target, rule.status_code

    return None


# --- CRUD helpers (rules) ------------------------------------------------------

def list_rules(db: Session) -> list[UrlRedirect]:
    return db.query(UrlRedirect).order_by(UrlRedirect.created_at.desc()).all()


def list_active_rules(db: Session) -> list[UrlRedirect]:
    return (
        db.query(UrlRedirect)
        .filter(UrlRedirect.is_active.is_(True))
        .order_by(UrlRedirect.created_at.desc())
        .all()
    )


def get_rule(db: Session, rule_id: str) -> Optional[UrlRedirect]:
    return db.query(UrlRedirect).filter(UrlRedirect.id == rule_id).first()


def source_exists(db: Session, source_path: str, exclude_id: Optional[str] = None) -> bool:
    query = db.query(UrlRedirect).filter(UrlRedirect.source_path == source_path)
    if exclude_id:
        query = query.filter(UrlRedirect.id != exclude_id)
    return db.query(query.exists()).scalar()


# --- 404 fallback config (site_settings) --------------------------------------

def get_not_found_config(db: Session) -> dict:
    row = db.query(SiteSetting).filter(SiteSetting.key == NOT_FOUND_KEY).first()
    if not row or not row.value:
        return dict(_DEFAULT_NOT_FOUND)
    try:
        data = json.loads(row.value)
    except (ValueError, TypeError):
        return dict(_DEFAULT_NOT_FOUND)
    return {**_DEFAULT_NOT_FOUND, **data}


def set_not_found_config(db: Session, enabled: bool, target_url: str) -> dict:
    payload = {"enabled": enabled, "target_url": target_url}
    row = db.query(SiteSetting).filter(SiteSetting.key == NOT_FOUND_KEY).first()
    if row is None:
        row = SiteSetting(key=NOT_FOUND_KEY, value=json.dumps(payload))
        db.add(row)
    else:
        row.value = json.dumps(payload)
    db.commit()
    return payload
