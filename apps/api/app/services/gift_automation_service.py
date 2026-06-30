"""Auto-trigger gift delivery (mechanism 1).

When a lead reaches a status in a funnel, deliver every matching active
automation's gift(s) through the shared `deliver_gifts` core (N gifts → one
email configured on the automation). `max_total_grants` caps delivered
RECIPIENTS via an atomic reserve (conditional UPDATE) so concurrent qualifying
events never exceed the cap; the slot is RELEASED when nothing new was granted
(recipient already had every gift), keeping the cap = real new recipients.

Never raises — a gift failure must not break the order/lead flow.
"""
import logging

from sqlalchemy import or_

from app.models.gift import Gift
from app.models.gift_automation import GiftAutomation
from app.services.gift_fulfilment_service import deliver_gifts

logger = logging.getLogger(__name__)


# --- CRUD ---------------------------------------------------------------------
def create_automation(db, *, payload, created_by: str | None) -> GiftAutomation:
    auto = GiftAutomation(
        gift_ids=payload.gift_ids,
        funnel_id=payload.funnel_id,
        trigger_status=payload.trigger_status,
        is_active=payload.is_active,
        max_total_grants=payload.max_total_grants,
        email_subject=payload.email_subject,
        email_html=payload.email_html,
        created_by=created_by,
    )
    db.add(auto)
    db.commit()
    db.refresh(auto)
    return auto


def list_automations(db) -> list[GiftAutomation]:
    return db.query(GiftAutomation).order_by(GiftAutomation.created_at.desc()).all()


def get_automation(db, automation_id: str) -> GiftAutomation | None:
    return db.query(GiftAutomation).filter(GiftAutomation.id == automation_id).first()


def update_automation(db, auto: GiftAutomation, payload) -> GiftAutomation:
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(auto, k, v)
    db.commit()
    db.refresh(auto)
    return auto


def delete_automation(db, auto: GiftAutomation) -> None:
    db.delete(auto)
    db.commit()


def _active_automations(db, funnel_id: str | None, trigger_status: str) -> list[GiftAutomation]:
    return (
        db.query(GiftAutomation)
        .filter(
            GiftAutomation.trigger_status == trigger_status,
            GiftAutomation.is_active.is_(True),
            or_(GiftAutomation.funnel_id == funnel_id, GiftAutomation.funnel_id.is_(None)),
        )
        .all()
    )


def _reserve_slot(db, automation_id: str) -> bool:
    """Atomically reserve one grant slot; False when the cap is already reached."""
    updated = (
        db.query(GiftAutomation)
        .filter(
            GiftAutomation.id == automation_id,
            GiftAutomation.is_active.is_(True),
            or_(
                GiftAutomation.max_total_grants.is_(None),
                GiftAutomation.grants_count < GiftAutomation.max_total_grants,
            ),
        )
        .update(
            {GiftAutomation.grants_count: GiftAutomation.grants_count + 1},
            synchronize_session=False,
        )
    )
    return updated > 0


def _release_slot(db, automation_id: str) -> None:
    db.query(GiftAutomation).filter(GiftAutomation.id == automation_id).update(
        {GiftAutomation.grants_count: GiftAutomation.grants_count - 1}, synchronize_session=False
    )


def trigger(
    db,
    *,
    funnel_id: str | None,
    trigger_status: str,
    email: str,
    full_name: str | None = None,
    phone: str | None = None,
    source: str | None = None,
    background_tasks=None,
) -> None:
    """Deliver all matching active automations' gifts to one recipient. Never raises."""
    try:
        automations = _active_automations(db, funnel_id, trigger_status)
    except Exception as exc:  # noqa: BLE001
        logger.error("gift automation lookup failed (funnel=%s): %s", funnel_id, exc)
        return

    for auto in automations:
        gift_ids = auto.gift_ids or []
        gifts = (
            db.query(Gift).filter(Gift.id.in_(gift_ids), Gift.is_archived.is_(False)).all()
            if gift_ids
            else []
        )
        if not gifts:
            continue
        if not _reserve_slot(db, auto.id):
            continue  # cap reached
        try:
            res = deliver_gifts(
                db,
                gifts=gifts,
                email=email,
                full_name=full_name,
                phone=phone,
                source=source,
                granted_by="system",
                email_subject=auto.email_subject or "",
                email_html=auto.email_html or "",
                background_tasks=background_tasks,
            )
        except Exception as exc:  # noqa: BLE001
            _release_slot(db, auto.id)
            logger.error("gift automation delivery failed (auto=%s): %s", auto.id, exc)
            continue

        if not res.get("granted_any"):
            _release_slot(db, auto.id)  # recipient already had every gift → return the slot
