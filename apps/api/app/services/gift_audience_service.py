"""Resolve a gift campaign's audience from leads (full filter set, dedupe, order, limit).

SQL handles the cheap/index-friendly filters (funnel, status, registration-date,
product). Per-email aggregation, purchase-date/amount/UTM/has-account filters,
ordering by aggregates, and the limit are done in Python so the logic is
identical on Postgres and the SQLite test harness. Audiences are operator-
targeted (usually a limit), so loading candidates into memory is acceptable.

Dedupe is by lowercased email. "Purchase time" for a person is their FIRST
successful order (min paid_at); amount uses their highest order. Ordering is
deterministic (secondary sort by email) so re-evaluation yields the same list.
"""
from app.core.config import settings
from app.models.funnel import Funnel
from app.models.funnel_order import FunnelOrder
from app.models.gift_grant import GiftGrant
from app.models.lead import Lead

_THRESHOLD = settings.META_PURCHASE_MIN_VND

_MAX_DT = "9999-12-31"  # sentinel so None paid-dates sort last on ascending keys


def _paid_exists(db):
    return db.query(FunnelOrder.id).filter(
        FunnelOrder.lead_id == Lead.id,
        FunnelOrder.status == "SUCCESS",
        FunnelOrder.final_amount > _THRESHOLD,
    )


def _candidate_leads(db, cfg) -> list[Lead]:
    q = db.query(Lead)
    if cfg.funnel_ids:
        q = q.filter(Lead.source_funnel_id.in_(cfg.funnel_ids))
    if cfg.product_id:
        q = q.join(Funnel, Funnel.id == Lead.source_funnel_id).filter(
            Funnel.product_id == cfg.product_id
        )
    paid = _paid_exists(db)
    if cfg.status == "purchased":
        q = q.filter(paid.exists())
    elif cfg.status == "subscribed":
        q = q.filter(~paid.exists(), Lead.status == "subscribed")
    elif cfg.status == "lead":
        q = q.filter(~paid.exists(), Lead.status == "lead")
    if cfg.date_field == "registration":
        if cfg.date_from:
            q = q.filter(Lead.created_at >= cfg.date_from)
        if cfg.date_to:
            q = q.filter(Lead.created_at <= cfg.date_to)
    return q.all()


def _order_aggregates(db, lead_ids: list[str]) -> dict:
    """lead_id -> {min_paid, max_paid, max_amount} over its successful orders."""
    agg: dict = {}
    if not lead_ids:
        return agg
    rows = (
        db.query(FunnelOrder.lead_id, FunnelOrder.paid_at, FunnelOrder.final_amount)
        .filter(FunnelOrder.lead_id.in_(lead_ids), FunnelOrder.status == "SUCCESS")
        .all()
    )
    for lid, paid_at, amount in rows:
        a = agg.setdefault(lid, {"min_paid": None, "max_paid": None, "max_amount": 0})
        if paid_at is not None:
            a["min_paid"] = paid_at if a["min_paid"] is None else min(a["min_paid"], paid_at)
            a["max_paid"] = paid_at if a["max_paid"] is None else max(a["max_paid"], paid_at)
        a["max_amount"] = max(a["max_amount"], amount or 0)
    return agg


def _utm_match(meta, cfg) -> bool:
    meta = meta or {}
    if cfg.utm_source and meta.get("utm_source") != cfg.utm_source:
        return False
    if cfg.utm_campaign and meta.get("utm_campaign") != cfg.utm_campaign:
        return False
    return True


def _build_recipients(db, cfg) -> list[dict]:
    """Filtered, deduped recipients (NOT yet ordered/limited, NOT ledger-filtered)."""
    leads = _candidate_leads(db, cfg)
    leads = [l for l in leads if _utm_match(l.meta, cfg)]
    if not leads:
        return _includes(db, cfg, existing=set())

    order_agg = _order_aggregates(db, [l.id for l in leads])
    emails = {(l.email or "").lower() for l in leads if l.email}
    # No user accounts in this product — has_account filter treats all as non-account-holders.
    accounts: set = set()

    by_email: dict[str, dict] = {}
    for l in leads:
        key = (l.email or "").lower()
        if not key:
            continue
        oa = order_agg.get(l.id, {})
        rec = by_email.get(key)
        if rec is None:
            by_email[key] = {
                "email": key,
                "name": l.name,
                "phone": l.phone,
                "lead_id": l.id,
                "min_reg": l.created_at,
                "max_reg": l.created_at,
                "min_paid": oa.get("min_paid"),
                "max_paid": oa.get("max_paid"),
                "max_amount": oa.get("max_amount", 0),
            }
        else:
            rec["name"] = rec["name"] or l.name
            rec["phone"] = rec["phone"] or l.phone
            if l.created_at:
                rec["min_reg"] = min(rec["min_reg"] or l.created_at, l.created_at)
                rec["max_reg"] = max(rec["max_reg"] or l.created_at, l.created_at)
            for k in ("min_paid", "max_paid"):
                v = oa.get(k)
                if v is not None:
                    cur = rec[k]
                    rec[k] = v if cur is None else (min(cur, v) if k == "min_paid" else max(cur, v))
            rec["max_amount"] = max(rec["max_amount"], oa.get("max_amount", 0))

    recipients = list(by_email.values())
    # Python-side filters that need aggregates / account existence
    if cfg.date_field == "purchase":
        recipients = [r for r in recipients if _in_window(r["min_paid"], cfg)]
    if cfg.amount_min is not None:
        recipients = [r for r in recipients if r["max_amount"] >= cfg.amount_min]
    if cfg.amount_max is not None:
        recipients = [r for r in recipients if r["max_amount"] <= cfg.amount_max]
    if cfg.has_account is True:
        recipients = [r for r in recipients if r["email"] in accounts]
    elif cfg.has_account is False:
        recipients = [r for r in recipients if r["email"] not in accounts]

    return _includes(db, cfg, existing={r["email"] for r in recipients}) + recipients


def _in_window(dt, cfg) -> bool:
    if dt is None:
        return False
    if cfg.date_from and dt < cfg.date_from:
        return False
    if cfg.date_to and dt > cfg.date_to:
        return False
    return True


def _includes(db, cfg, existing: set) -> list[dict]:
    """Manually included emails not already matched (forced in, exclusion applies later)."""
    extra = []
    for raw in cfg.include_emails or []:
        e = (raw or "").strip().lower()
        if e and e not in existing:
            extra.append({"email": e, "name": None, "phone": None, "lead_id": None,
                          "min_reg": None, "max_reg": None, "min_paid": None,
                          "max_paid": None, "max_amount": 0})
            existing.add(e)
    return extra


def _sort_key(r: dict, order_by: str | None):
    if order_by == "latest_reg":
        return (-(r["max_reg"].timestamp() if r["max_reg"] else 0), r["email"])
    if order_by == "earliest_purchase":
        return (r["min_paid"].isoformat() if r["min_paid"] else _MAX_DT, r["email"])
    if order_by == "latest_purchase":
        return (-(r["max_paid"].timestamp() if r["max_paid"] else 0), r["email"])
    if order_by == "amount_desc":
        return (-(r["max_amount"] or 0), r["email"])
    # default + earliest_reg
    return (r["min_reg"].isoformat() if r["min_reg"] else _MAX_DT, r["email"])


def _apply_exclusions(recipients: list[dict], cfg) -> list[dict]:
    excluded = {(e or "").strip().lower() for e in (cfg.exclude_emails or [])}
    return [r for r in recipients if r["email"] not in excluded]


def _fully_granted_emails(db, gift_ids: list[str]) -> set:
    """Emails that already received EVERY selected gift (nothing new to give)."""
    if not gift_ids:
        return set()
    per_gift = []
    for gid in gift_ids:
        per_gift.append(
            {e.lower() for (e,) in db.query(GiftGrant.email).filter(GiftGrant.gift_id == gid).all() if e}
        )
    return set.intersection(*per_gift) if per_gift else set()


def resolve_recipients(db, gift_ids: list[str], cfg) -> list[dict]:
    """Final ordered+limited recipient list to freeze into send jobs."""
    recipients = _apply_exclusions(_build_recipients(db, cfg), cfg)
    if cfg.exclude_already_granted:
        granted = _fully_granted_emails(db, gift_ids)
        recipients = [r for r in recipients if r["email"] not in granted]
    recipients.sort(key=lambda r: _sort_key(r, cfg.order_by))
    if cfg.limit and cfg.limit > 0:
        recipients = recipients[: cfg.limit]
    return recipients


def preview(db, gift_ids: list[str], cfg) -> dict:
    """Breakdown: matched / already_granted (has ALL gifts) / will_receive + a
    small sample of the actual recipients (ordered + limited) for the review UI."""
    candidates = _apply_exclusions(_build_recipients(db, cfg), cfg)
    matched = len(candidates)
    granted = _fully_granted_emails(db, gift_ids)
    already = sum(1 for r in candidates if r["email"] in granted)
    recips = resolve_recipients(db, gift_ids, cfg)
    sample = [{"email": r["email"], "name": r.get("name")} for r in recips[:5]]
    return {
        "matched": matched,
        "already_granted": already,
        "will_receive": len(recips),
        "sample": sample,
    }
