"""Stackable discount engine (D2, D4) — GLOBAL pool.

Math: total_percent = min(100, sum(percent values)); final = round(base * (100 -
total_percent) / 100); fixed-amount discounts subtract AFTER percentages; final
is clamped at 0. No ordering/priority between codes. total_percent == 100 (or
final == 0) → free order.

Redemption counting lives in `redeem_discounts_atomically` and MUST only be
called from the idempotent complete-order routine (never quote/pending).
"""

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional, Sequence

from sqlalchemy import exists, or_
from sqlalchemy.orm import Session

from app.models.discount import Discount, DiscountDefaultActivation


def discount_is_applicable(discount: Discount, owner_type: str, owner_id: str) -> bool:
    """Whether `discount` may be used on the given owner (funnel/course).

    EMPTY scope (no rows) = global → usable anywhere. With one or more scope rows
    the discount is an allow-list: usable ONLY on a listed owner. Shared by funnel
    and course checkout so both enforce identically (D5).
    """
    scopes = list(discount.scopes or [])
    if not scopes:
        return True
    return any(s.owner_type == owner_type and s.owner_id == owner_id for s in scopes)


@dataclass
class DiscountEvaluation:
    """Validation outcome for a single code."""

    code: str
    discount: Optional[Discount] = None
    applied: bool = False
    reason: Optional[str] = None
    applied_percent: int = 0
    applied_amount: int = 0


@dataclass
class QuoteResult:
    subtotal: int
    total_percent: int
    discount_amount: int
    final_amount: int
    evaluations: list[DiscountEvaluation] = field(default_factory=list)

    @property
    def is_free(self) -> bool:
        return self.final_amount == 0

    @property
    def applied_discounts(self) -> list[DiscountEvaluation]:
        return [e for e in self.evaluations if e.applied]


def _as_utc(value: Optional[datetime]) -> Optional[datetime]:
    """Normalize DB datetimes: SQLite returns naive values — treat them as UTC."""
    if value is not None and value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value


def validate_discount(
    discount: Optional[Discount],
    code: str,
    now: Optional[datetime] = None,
    owner_type: Optional[str] = None,
    owner_id: Optional[str] = None,
) -> DiscountEvaluation:
    """Validate one discount; reject with a clear reason (task 3.2).

    When `owner_type`/`owner_id` are provided, also enforce the applicability
    scope (allow-list): a scoped code used on a non-listed owner is rejected with
    reason `not_applicable_here`.
    """
    now = now or datetime.now(timezone.utc)
    if discount is None:
        return DiscountEvaluation(code=code, reason="not_found")
    starts_at, ends_at = _as_utc(discount.starts_at), _as_utc(discount.ends_at)
    evaluation = DiscountEvaluation(code=discount.code, discount=discount)
    if not discount.is_active:
        evaluation.reason = "inactive"
    elif starts_at and now < starts_at:
        evaluation.reason = "not_started"
    elif ends_at and now > ends_at:
        evaluation.reason = "expired"
    elif (
        discount.max_redemptions is not None
        and discount.redeemed_count >= discount.max_redemptions
    ):
        evaluation.reason = "usage_limit_reached"
    elif (
        owner_type is not None
        and owner_id is not None
        and not discount_is_applicable(discount, owner_type, owner_id)
    ):
        evaluation.reason = "not_applicable_here"
    else:
        evaluation.applied = True
    return evaluation


def compute_quote(
    db: Session,
    owner_type: str,
    owner_id: str,
    subtotal: int,
    codes: Sequence[str],
    include_default: bool = True,
) -> QuoteResult:
    """Stacking calc: sum percents (cap 100), then subtract fixed amounts.

    Discounts are resolved GLOBALLY (no funnel/course filter on code lookup).
    Default discounts for the given owner are auto-applied via DiscountDefaultActivation.

    Args:
        owner_type: 'funnel' | 'course'
        owner_id: funnel.id or course.id
        subtotal: base amount in the smallest currency unit
        codes: discount codes requested by the user
        include_default: whether to auto-apply default discounts for this owner
    """
    requested = {c.strip().upper() for c in codes if c.strip()}
    discounts_by_code: dict[str, Discount] = {}
    if requested:
        from sqlalchemy import func as sqlfunc

        rows = (
            db.query(Discount).filter(sqlfunc.upper(Discount.code).in_(requested)).all()
        )
        discounts_by_code = {row.code.upper(): row for row in rows}

    evaluations: list[DiscountEvaluation] = []
    seen_ids: set[str] = set()

    if include_default:
        # Fetch discounts that have an active activation row for this owner
        defaults = (
            db.query(Discount)
            .join(
                DiscountDefaultActivation,
                DiscountDefaultActivation.discount_id == Discount.id,
            )
            .filter(
                DiscountDefaultActivation.owner_type == owner_type,
                DiscountDefaultActivation.owner_id == owner_id,
                Discount.is_active.is_(True),
            )
            .all()
        )
        for discount in defaults:
            evaluation = validate_discount(discount, discount.code)
            if evaluation.applied:
                evaluations.append(evaluation)
                seen_ids.add(discount.id)

    for code in requested:
        discount = discounts_by_code.get(code)
        if discount is not None and discount.id in seen_ids:
            continue  # default already applied; don't double-apply the same code
        # Enforce applicability scope for user-entered codes (allow-list)
        evaluations.append(
            validate_discount(discount, code, owner_type=owner_type, owner_id=owner_id)
        )
        if discount is not None:
            seen_ids.add(discount.id)

    # Percentages sum first, capped at 100 (D2)
    total_percent = min(
        100,
        sum(
            e.discount.discount_value
            for e in evaluations
            if e.applied and e.discount.discount_type == "percent"
        ),
    )
    after_percent = round(subtotal * (100 - total_percent) / 100)

    # Fixed amounts subtract after percentage; final clamped at 0
    fixed_total = sum(
        e.discount.discount_value
        for e in evaluations
        if e.applied and e.discount.discount_type == "fixed"
    )
    final_amount = max(0, after_percent - fixed_total)

    # Per-code applied snapshot for OrderDiscount audit rows
    for evaluation in evaluations:
        if not evaluation.applied:
            continue
        if evaluation.discount.discount_type == "percent":
            evaluation.applied_percent = evaluation.discount.discount_value
            evaluation.applied_amount = round(
                subtotal * evaluation.discount.discount_value / 100
            )
        else:
            evaluation.applied_amount = evaluation.discount.discount_value

    return QuoteResult(
        subtotal=subtotal,
        total_percent=total_percent,
        discount_amount=subtotal - final_amount,
        final_amount=final_amount,
        evaluations=evaluations,
    )


def default_discounted(
    db: Session, owner_type: str, owner_id: str, subtotal: int
) -> tuple[int, int]:
    """(final_amount, total_percent) applying ONLY the owner's default discounts.

    Helper for the `{{discounted_price}}`/`{{discount_percent}}` template variables
    (no user codes). Owner-level + buyer-less → safe for landing/email/success.
    """
    quote = compute_quote(
        db, owner_type, owner_id, subtotal, codes=[], include_default=True
    )
    return quote.final_amount, quote.total_percent


def redeem_discounts_atomically(db: Session, discount_ids: Sequence[str]) -> bool:
    """Atomic limit re-check + redeemed_count increment (task 3.3).

    Conditional UPDATE guards the usage limit under concurrency: each row only
    increments while still under max_redemptions. Returns False (and rolls back
    increments via the caller's transaction) if any discount went over limit
    between quote and completion.
    """
    for discount_id in discount_ids:
        updated = (
            db.query(Discount)
            .filter(
                Discount.id == discount_id,
                or_(
                    Discount.max_redemptions.is_(None),
                    Discount.redeemed_count < Discount.max_redemptions,
                ),
            )
            .update(
                {Discount.redeemed_count: Discount.redeemed_count + 1},
                synchronize_session=False,
            )
        )
        if updated == 0:
            return False
    return True
