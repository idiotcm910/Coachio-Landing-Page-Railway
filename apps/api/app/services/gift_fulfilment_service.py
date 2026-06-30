"""Gift fulfilment — external-gift delivery only (download links, coupon codes, URLs).

Granting is per-(gift, person): each gift claims its own ledger row inside ONE
savepoint so a DB error never poisons the caller's transaction.
A delivery may bundle N gifts → grant each (deduped independently), then send
ONE email. Email is decoupled and retryable; the template is snapshotted onto
each grant so a resend reproduces exactly what was sent even after the
campaign/automation is edited.

Internal perks (credits, agent skills, API access) are NOT supported in this build.
"""
import logging
from datetime import datetime, timezone

import resend
from sqlalchemy.exc import IntegrityError

from app.core.config import settings
from app.models.gift import Gift
from app.models.gift_grant import GiftGrant
from app.services.gift_email_render import render_gift_html, render_gift_text

logger = logging.getLogger(__name__)


def _grant_one(db, *, gift: Gift, email_lower: str, full_name, phone, source, granted_by) -> dict:
    """Claim the dedupe ledger row for ONE gift (no email, no perks). Savepoint-isolated.

    Returns {status: granted|already_granted|error, grant_id?}.
    On any DB error the savepoint rolls back so the Session stays usable.
    """
    grant = GiftGrant(
        gift_id=gift.id,
        email=email_lower,
        source=source,
        granted_by=granted_by,
        recipient_name=full_name,
        recipient_phone=phone,
        external_items_snapshot=gift.external_items,
        status="granted",
        email_status="pending",
    )
    sp = db.begin_nested()
    db.add(grant)
    try:
        db.flush()  # claim: unique (gift_id, email) conflict → already granted
    except IntegrityError:
        sp.rollback()
        return {"status": "already_granted"}
    sp.commit()
    return {"status": "granted", "grant_id": grant.id}


def deliver_gifts(
    db,
    *,
    gifts: list[Gift],
    email: str,
    full_name: str | None = None,
    phone: str | None = None,
    source: str | None = None,
    granted_by: str | None = None,
    email_subject: str = "",
    email_html: str = "",
    background_tasks=None,
) -> dict:
    """Grant every gift to `email`, then send ONE combined email. Does NOT commit.

    Returns {granted_any, granted_count, grant_ids, status}.
    """
    email_lower = (email or "").strip().lower()
    if not email_lower or "@" not in email_lower:
        return {"granted_any": False, "granted_count": 0, "grant_ids": [], "status": "skipped"}

    grant_ids: list[str] = []
    for gift in gifts:
        res = _grant_one(
            db, gift=gift, email_lower=email_lower, full_name=full_name, phone=phone,
            source=source, granted_by=granted_by,
        )
        if res.get("status") == "granted":
            grant_ids.append(res["grant_id"])
        elif res.get("status") == "error":
            logger.error("gift %s skipped in delivery to %s: %s", gift.id, email_lower, res.get("reason"))

    if not grant_ids:
        return {"granted_any": False, "granted_count": 0, "grant_ids": [], "status": "already_granted"}

    email_ok = None  # None = deferred to background; bool when sent inline
    if background_tasks is not None:
        background_tasks.add_task(
            send_delivery_email, grant_ids, email_subject=email_subject, email_html=email_html,
        )
    else:
        email_ok = send_delivery_email(
            grant_ids, email_subject=email_subject, email_html=email_html, db=db,
        )

    return {
        "granted_any": True,
        "granted_count": len(grant_ids),
        "grant_ids": grant_ids,
        "email_ok": email_ok,
        "status": "granted",
    }


def send_delivery_email(grant_ids: list[str], *, email_subject: str, email_html: str, db=None) -> bool:
    """Render + send the gift email covering `grant_ids`; snapshot template + status on each.

    Context tokens: {{recipient_name}}, {{login_email}}. Unknown tokens render empty. Never raises.
    """
    from app.db.base import SessionLocal

    own = db is None
    if own:
        db = SessionLocal()
    ok = False
    grants: list[GiftGrant] = []
    try:
        grants = db.query(GiftGrant).filter(GiftGrant.id.in_(grant_ids)).all()
        if not grants:
            return False
        first = grants[0]
        ctx = {
            "recipient_name": first.recipient_name or "",
            "login_email": first.email or "",
        }
        subject = render_gift_text(email_subject, ctx)
        html = render_gift_html(email_html, ctx)
        resend.Emails.send(
            {"from": settings.RESEND_FROM_EMAIL, "to": first.email, "subject": subject, "html": html}
        )
        ok = True
        now = datetime.now(timezone.utc)
        for g in grants:
            g.email_status = "sent"
            g.email_sent_at = now
            g.email_error = None
            g.email_subject_snapshot = email_subject
            g.email_html_snapshot = email_html
    except Exception as exc:  # noqa: BLE001 — email failure must not break fulfilment
        logger.error("Gift delivery email failed (grants=%s): %s", grant_ids, exc)
        for g in grants:
            g.email_status = "failed"
            g.email_error = str(exc)[:500]
            g.email_subject_snapshot = email_subject
            g.email_html_snapshot = email_html
    finally:
        if own:
            db.commit()
            db.close()
        else:
            db.flush()
    return ok
