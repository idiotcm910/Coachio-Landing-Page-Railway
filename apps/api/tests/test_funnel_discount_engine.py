"""Unit tests for the stackable global discount engine.

Branches covered: sum<100, sum=100→free, sum>100 capped, over-limit,
expired/inactive, fixed-after-percent, atomic redemption guard, default activations.

Updated for global discount pool (20260618_0000): Discount no longer has funnel_id
or is_default. Per-owner defaults are managed via DiscountDefaultActivation.

Ported to coachio-landing-page: User removed; admin represented as a fixed string id.
"""
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.models.discount import Discount, DiscountDefaultActivation, DiscountScope, OrderDiscount
from app.models.funnel import Funnel, FunnelLandingPage, FunnelSection
from app.models.funnel_order import FunnelOrder
from app.models.lead import Lead
from app.models.product import Product
from app.services.funnel_discount_engine import (
    compute_quote,
    discount_is_applicable,
    redeem_discounts_atomically,
    validate_discount,
)

SQLALCHEMY_DATABASE_URL = "sqlite:///./test_funnel_discount_engine.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

TABLES = [
    Product.__table__,
    Funnel.__table__,
    FunnelLandingPage.__table__,
    FunnelSection.__table__,
    Discount.__table__,
    DiscountDefaultActivation.__table__,
    DiscountScope.__table__,
    Lead.__table__,
    FunnelOrder.__table__,
    OrderDiscount.__table__,
]


def create_tables():
    for table in TABLES:
        table.create(bind=engine, checkfirst=True)


def drop_tables():
    for table in reversed(TABLES):
        table.drop(bind=engine, checkfirst=True)


@pytest.fixture()
def db():
    drop_tables()
    create_tables()
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        drop_tables()


def create_funnel(db, sale_price=1_000_000):
    # Use fixed string as admin id — no User model needed (SQLite no-FK)
    admin_id = "admin-test"
    product = Product(name="Prod", slug="prod", base_price=sale_price, type="course", created_by=admin_id)
    db.add(product)
    db.flush()
    funnel = Funnel(product_id=product.id, title="Funnel", slug="funnel", created_by=admin_id)
    db.add(funnel)
    db.commit()
    db.refresh(funnel)
    return funnel, admin_id


def add_discount(db, admin_id, code, value, dtype="percent", **kwargs):
    """Create a global discount (no funnel_id)."""
    discount = Discount(
        code=code,
        discount_type=dtype,
        discount_value=value,
        created_by=admin_id,
        **kwargs,
    )
    db.add(discount)
    db.commit()
    db.refresh(discount)
    return discount


def test_sum_under_100_percent(db):
    funnel, admin_id = create_funnel(db)
    add_discount(db, admin_id, "A20", 20)
    add_discount(db, admin_id, "B30", 30)

    quote = compute_quote(db, "funnel", funnel.id, 1_000_000, ["A20", "B30"])

    assert quote.total_percent == 50
    assert quote.final_amount == 500_000
    assert not quote.is_free


def test_sum_exactly_100_is_free(db):
    funnel, admin_id = create_funnel(db)
    add_discount(db, admin_id, "A60", 60)
    add_discount(db, admin_id, "B40", 40)

    quote = compute_quote(db, "funnel", funnel.id, 1_000_000, ["A60", "B40"])

    assert quote.total_percent == 100
    assert quote.final_amount == 0
    assert quote.is_free


def test_sum_over_100_capped(db):
    funnel, admin_id = create_funnel(db)
    add_discount(db, admin_id, "A80", 80)
    add_discount(db, admin_id, "B50", 50)

    quote = compute_quote(db, "funnel", funnel.id, 1_000_000, ["A80", "B50"])

    assert quote.total_percent == 100
    assert quote.final_amount == 0


def test_over_limit_rejected(db):
    funnel, admin_id = create_funnel(db)
    add_discount(db, admin_id, "FULL", 50, max_redemptions=1, redeemed_count=1)

    quote = compute_quote(db, "funnel", funnel.id, 1_000_000, ["FULL"])

    assert quote.final_amount == 1_000_000
    rejection = quote.evaluations[0]
    assert not rejection.applied
    assert rejection.reason == "usage_limit_reached"


def test_expired_and_inactive_rejected(db):
    funnel, admin_id = create_funnel(db)
    past = datetime.now(timezone.utc) - timedelta(days=1)
    add_discount(db, admin_id, "EXPIRED", 50, ends_at=past)
    add_discount(db, admin_id, "OFF", 50, is_active=False)

    quote = compute_quote(db, "funnel", funnel.id, 1_000_000, ["EXPIRED", "OFF", "GHOST"])

    assert quote.final_amount == 1_000_000
    reasons = {e.code: e.reason for e in quote.evaluations}
    assert reasons["EXPIRED"] == "expired"
    assert reasons["OFF"] == "inactive"
    assert reasons["GHOST"] == "not_found"


def test_fixed_subtracts_after_percent_and_clamps_at_zero(db):
    funnel, admin_id = create_funnel(db)
    add_discount(db, admin_id, "P50", 50)
    add_discount(db, admin_id, "F600", 600_000, dtype="fixed")

    quote = compute_quote(db, "funnel", funnel.id, 1_000_000, ["P50", "F600"])

    # 50% → 500k, then fixed 600k clamps at 0
    assert quote.final_amount == 0
    assert quote.is_free


def test_default_activation_auto_applies_without_double_count(db):
    """Discount activated as default for a funnel auto-applies; requesting it again doesn't stack."""
    funnel, admin_id = create_funnel(db)
    default_disc = add_discount(db, admin_id, "DEFAULT10", 10)
    # Set as default for this funnel via DiscountDefaultActivation
    db.add(DiscountDefaultActivation(discount_id=default_disc.id, owner_type="funnel", owner_id=funnel.id))
    db.commit()

    add_discount(db, admin_id, "USER20", 20)

    # Default applies even when not requested; requesting it again doesn't stack twice
    quote = compute_quote(db, "funnel", funnel.id, 1_000_000, ["USER20", "DEFAULT10"])

    assert quote.total_percent == 30
    assert quote.final_amount == 700_000


def test_default_discounted_helper_and_kwargs(db):
    """`default_discounted` + `funnel_discount_kwargs` apply ONLY the default discount."""
    from app.services.funnel_discount_engine import default_discounted
    from app.services.funnel_variable_resolver import funnel_discount_kwargs, resolve_variables

    funnel, admin_id = create_funnel(db)  # product.base_price = 1_000_000
    disc = add_discount(db, admin_id, "DEF30", 30)
    db.add(DiscountDefaultActivation(discount_id=disc.id, owner_type="funnel", owner_id=funnel.id))
    db.commit()
    db.refresh(funnel)

    final_amount, total_percent = default_discounted(db, "funnel", funnel.id, 1_000_000)
    assert (final_amount, total_percent) == (700_000, 30)

    kwargs = funnel_discount_kwargs(db, funnel)
    assert kwargs == {"discounted_price": 700_000, "discount_percent": 30}

    resolved = resolve_variables(funnel, **kwargs)
    assert resolved["discounted_price"] == "700.000"
    assert resolved["discount_percent"] == "30"
    assert resolved["price"] == "1.000.000"


def test_landing_payload_bakes_discounted_price(db):
    """Public landing payload variables include discounted_price after default discount."""
    from app.services.funnel_landing_service import build_public_landing_payload

    funnel, admin_id = create_funnel(db)  # base_price 1_000_000
    disc = add_discount(db, admin_id, "DEF30", 30)
    db.add(DiscountDefaultActivation(discount_id=disc.id, owner_type="funnel", owner_id=funnel.id))
    db.commit()
    db.refresh(funnel)

    payload = build_public_landing_payload(db, funnel)
    assert payload["final_price"] == 700_000
    assert payload["variables"]["discounted_price"] == "700.000"
    assert payload["variables"]["discount_percent"] == "30"


def test_funnel_discount_kwargs_resilient_without_db(db):
    """No db → empty kwargs so the resolver falls back to base price / 0 (never errors)."""
    from app.services.funnel_variable_resolver import funnel_discount_kwargs

    funnel, _ = create_funnel(db)
    assert funnel_discount_kwargs(None, funnel) == {}


def test_default_activation_different_owner_not_applied(db):
    """Default activation for one funnel must NOT auto-apply on a different funnel."""
    funnel_a, admin_id = create_funnel(db)

    # Create a second funnel
    product_b = Product(name="Prod B", slug="prod-b", base_price=1_000_000, type="course", created_by=admin_id)
    db.add(product_b)
    db.flush()
    funnel_b = Funnel(product_id=product_b.id, title="Funnel B", slug="funnel-b", created_by=admin_id)
    db.add(funnel_b)
    db.commit()
    db.refresh(funnel_b)

    discount = add_discount(db, admin_id, "FUNNEL_A_DEFAULT", 25)
    db.add(DiscountDefaultActivation(discount_id=discount.id, owner_type="funnel", owner_id=funnel_a.id))
    db.commit()

    # Should NOT auto-apply on funnel_b
    quote = compute_quote(db, "funnel", funnel_b.id, 1_000_000, [])
    assert quote.total_percent == 0
    assert quote.final_amount == 1_000_000


def test_redeem_atomically_increments_and_guards_limit(db):
    funnel, admin_id = create_funnel(db)
    discount = add_discount(db, admin_id, "ONCE", 10, max_redemptions=1)

    assert redeem_discounts_atomically(db, [discount.id]) is True
    db.commit()
    db.refresh(discount)
    assert discount.redeemed_count == 1

    # second redemption hits the limit → conditional update matches 0 rows
    assert redeem_discounts_atomically(db, [discount.id]) is False
    db.rollback()
    db.refresh(discount)
    assert discount.redeemed_count == 1


def test_validate_discount_not_started(db):
    funnel, admin_id = create_funnel(db)
    future = datetime.now(timezone.utc) + timedelta(days=1)
    discount = add_discount(db, admin_id, "SOON", 10, starts_at=future)

    evaluation = validate_discount(discount, "SOON")

    assert not evaluation.applied
    assert evaluation.reason == "not_started"


def test_global_code_applies_cross_funnel(db):
    """The same global code can be used by any funnel checkout."""
    funnel_a, admin_id = create_funnel(db)
    product_b = Product(name="Prod B", slug="prod-b", base_price=1_000_000, type="course", created_by=admin_id)
    db.add(product_b)
    db.flush()
    funnel_b = Funnel(product_id=product_b.id, title="Funnel B", slug="funnel-b", created_by=admin_id)
    db.add(funnel_b)
    db.commit()
    db.refresh(funnel_b)

    add_discount(db, admin_id, "GLOBAL50", 50)

    quote_a = compute_quote(db, "funnel", funnel_a.id, 1_000_000, ["GLOBAL50"])
    quote_b = compute_quote(db, "funnel", funnel_b.id, 2_000_000, ["GLOBAL50"])

    assert quote_a.final_amount == 500_000
    assert quote_b.final_amount == 1_000_000


# ─── Applicability scope (whitelist) ────────────────────────────────────────
# Empty scope = global; non-empty scope restricts the code to listed owners.

def _add_scope(db, discount, owner_type, owner_id):
    db.add(DiscountScope(discount_id=discount.id, owner_type=owner_type, owner_id=owner_id))
    db.commit()


def _eval_for(quote, code):
    return next(e for e in quote.evaluations if e.code == code.upper())


def test_empty_scope_is_global(db):
    funnel, admin_id = create_funnel(db)
    add_discount(db, admin_id, "GLOBAL20", 20)  # no scope rows
    quote = compute_quote(db, "funnel", funnel.id, 1_000_000, ["GLOBAL20"])
    assert _eval_for(quote, "GLOBAL20").applied
    assert quote.final_amount == 800_000


def test_scoped_code_accepted_on_listed_owner(db):
    funnel, admin_id = create_funnel(db)
    d = add_discount(db, admin_id, "SCOPED20", 20)
    _add_scope(db, d, "funnel", funnel.id)
    quote = compute_quote(db, "funnel", funnel.id, 1_000_000, ["SCOPED20"])
    assert _eval_for(quote, "SCOPED20").applied
    assert quote.final_amount == 800_000


def test_scoped_code_rejected_on_non_listed_owner(db):
    funnel, admin_id = create_funnel(db)
    d = add_discount(db, admin_id, "ONLYOTHER", 20)
    _add_scope(db, d, "funnel", "some-other-funnel-id")  # not this funnel
    quote = compute_quote(db, "funnel", funnel.id, 1_000_000, ["ONLYOTHER"])
    ev = _eval_for(quote, "ONLYOTHER")
    assert not ev.applied
    assert ev.reason == "not_applicable_here"
    assert quote.final_amount == 1_000_000  # no discount applied


def test_scope_enforced_on_course_owner_via_same_engine(db):
    # compute_quote is the shared chokepoint; verify the course owner path enforces scope.
    funnel, admin_id = create_funnel(db)
    d = add_discount(db, admin_id, "COURSEONLY", 30)
    _add_scope(db, d, "course", "course-123")

    ok = compute_quote(db, "course", "course-123", 1_000_000, ["COURSEONLY"])
    assert _eval_for(ok, "COURSEONLY").applied
    assert ok.final_amount == 700_000

    rejected = compute_quote(db, "course", "course-999", 1_000_000, ["COURSEONLY"])
    assert not _eval_for(rejected, "COURSEONLY").applied
    assert _eval_for(rejected, "COURSEONLY").reason == "not_applicable_here"


def test_discount_is_applicable_helper(db):
    funnel, admin_id = create_funnel(db)
    d = add_discount(db, admin_id, "HELPER", 10)
    assert discount_is_applicable(d, "funnel", funnel.id) is True  # empty = global
    _add_scope(db, d, "funnel", funnel.id)
    db.refresh(d)
    assert discount_is_applicable(d, "funnel", funnel.id) is True
    assert discount_is_applicable(d, "funnel", "other") is False
