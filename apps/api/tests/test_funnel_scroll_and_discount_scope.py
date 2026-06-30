"""Tests for landing section anchors + discount applicability scope.

Covers (calling endpoint helper functions directly — no TestClient/auth needed):
- Discount scope: default owner must be within a non-empty scope (create / set-default
  / update-replace), and scope rows persist.
- Landing section anchor: per-page uniqueness rejection; anchor present in the public
  landing payload; null anchor stays backward-compatible.

Ported to coachio-landing-page: User replaced by AdminUser (required by endpoint
signatures: create_discount/create_section take current_user: AdminUser).
"""
import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.models.admin_user import AdminUser
from app.models.discount import Discount, DiscountDefaultActivation, DiscountScope, OrderDiscount
from app.models.funnel import Funnel, FunnelLandingPage, FunnelSection
from app.models.product import Product

from app.api.v1.endpoints.admin.discounts import (
    create_discount,
    set_discount_default,
    update_discount,
)
from app.api.v1.endpoints.admin.funnel_landings import create_section, update_section
from app.schemas.discount import (
    DiscountCreate,
    DiscountDefaultActivationInput,
    DiscountScopeInput,
    DiscountUpdate,
)
from app.schemas.funnel import FunnelSectionCreate, FunnelSectionUpdate
from app.services.funnel_landing_service import build_public_landing_payload

SQLALCHEMY_DATABASE_URL = "sqlite:///./test_scroll_scope.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

TABLES = [
    AdminUser.__table__,
    Product.__table__,
    Funnel.__table__,
    FunnelLandingPage.__table__,
    FunnelSection.__table__,
    Discount.__table__,
    DiscountDefaultActivation.__table__,
    DiscountScope.__table__,
    OrderDiscount.__table__,
]


@pytest.fixture()
def db():
    for t in reversed(TABLES):
        t.drop(bind=engine, checkfirst=True)
    for t in TABLES:
        t.create(bind=engine, checkfirst=True)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        for t in reversed(TABLES):
            t.drop(bind=engine, checkfirst=True)


def _seed(db, slug="funnel"):
    # AdminUser required — endpoint functions take current_user: AdminUser
    admin = AdminUser(email=f"a-{slug}@x.com", hashed_password="x")
    db.add(admin)
    db.flush()
    product = Product(name="P", slug=f"p-{slug}", base_price=1_000_000, type="course", created_by=admin.id)
    db.add(product)
    db.flush()
    funnel = Funnel(product_id=product.id, title="F", slug=slug, created_by=admin.id)
    db.add(funnel)
    db.commit()
    db.refresh(funnel)
    db.refresh(admin)
    return funnel, admin


# ─── Discount scope: default must be within a non-empty scope ────────────────

def test_create_rejects_default_outside_scope(db):
    funnel, admin = _seed(db)
    payload = DiscountCreate(
        code="LAUNCH",
        discount_type="percent",
        discount_value=20,
        scopes=[DiscountScopeInput(owner_type="funnel", owner_id=funnel.id)],
        defaults=[DiscountDefaultActivationInput(owner_type="funnel", owner_id="other-funnel")],
    )
    with pytest.raises(HTTPException) as exc:
        create_discount(payload, db, admin)
    assert exc.value.status_code == 422


def test_create_with_in_scope_default_persists_scope(db):
    funnel, admin = _seed(db)
    payload = DiscountCreate(
        code="LAUNCH",
        discount_type="percent",
        discount_value=20,
        scopes=[DiscountScopeInput(owner_type="funnel", owner_id=funnel.id)],
        defaults=[DiscountDefaultActivationInput(owner_type="funnel", owner_id=funnel.id)],
    )
    result = create_discount(payload, db, admin)
    rows = db.query(DiscountScope).filter(DiscountScope.discount_id == result.id).all()
    assert len(rows) == 1 and rows[0].owner_id == funnel.id


def test_set_default_outside_scope_rejected(db):
    funnel, admin = _seed(db)
    created = create_discount(
        DiscountCreate(
            code="SC", discount_type="percent", discount_value=10,
            scopes=[DiscountScopeInput(owner_type="funnel", owner_id=funnel.id)],
        ),
        db, admin,
    )
    # in-scope owner is fine
    set_discount_default(
        created.id, DiscountDefaultActivationInput(owner_type="funnel", owner_id=funnel.id), db, admin
    )
    # out-of-scope owner rejected
    with pytest.raises(HTTPException) as exc:
        set_discount_default(
            created.id, DiscountDefaultActivationInput(owner_type="funnel", owner_id="nope"), db, admin
        )
    assert exc.value.status_code == 422


def test_update_scope_excluding_existing_default_rejected(db):
    funnel, admin = _seed(db)
    created = create_discount(
        DiscountCreate(
            code="UP", discount_type="percent", discount_value=10,
            defaults=[DiscountDefaultActivationInput(owner_type="funnel", owner_id=funnel.id)],
        ),
        db, admin,
    )  # global, default for funnel
    # Now restrict scope to a DIFFERENT funnel → would orphan the existing default
    with pytest.raises(HTTPException) as exc:
        update_discount(
            created.id,
            DiscountUpdate(scopes=[DiscountScopeInput(owner_type="funnel", owner_id="different")]),
            db, admin,
        )
    assert exc.value.status_code == 422


def test_update_clear_scope_makes_global(db):
    funnel, admin = _seed(db)
    created = create_discount(
        DiscountCreate(
            code="CLR", discount_type="percent", discount_value=10,
            scopes=[DiscountScopeInput(owner_type="funnel", owner_id=funnel.id)],
        ),
        db, admin,
    )
    update_discount(created.id, DiscountUpdate(scopes=[]), db, admin)
    assert db.query(DiscountScope).filter(DiscountScope.discount_id == created.id).count() == 0


# ─── Landing section anchor ──────────────────────────────────────────────────

def test_duplicate_anchor_rejected(db):
    funnel, admin = _seed(db)
    create_section(funnel.id, FunnelSectionCreate(name="A", anchor="pricing"), db, admin)
    with pytest.raises(HTTPException) as exc:
        create_section(funnel.id, FunnelSectionCreate(name="B", anchor="pricing"), db, admin)
    assert exc.value.status_code == 422


def test_anchor_slugified_and_in_public_payload(db):
    funnel, admin = _seed(db)
    create_section(funnel.id, FunnelSectionCreate(name="Pricing", anchor="Our Pricing!"), db, admin)
    payload = build_public_landing_payload(db, funnel)
    anchors = [s.get("anchor") for s in payload["sections"]]
    assert "our-pricing" in anchors  # slugified


def test_section_without_anchor_is_none(db):
    funnel, admin = _seed(db)
    create_section(funnel.id, FunnelSectionCreate(name="Hero"), db, admin)
    payload = build_public_landing_payload(db, funnel)
    assert payload["sections"][0]["anchor"] is None


def test_update_section_duplicate_anchor_rejected(db):
    funnel, admin = _seed(db)
    create_section(funnel.id, FunnelSectionCreate(name="A", anchor="alpha"), db, admin)
    s2 = create_section(funnel.id, FunnelSectionCreate(name="B", anchor="beta"), db, admin)
    with pytest.raises(HTTPException) as exc:
        update_section(funnel.id, s2.id, FunnelSectionUpdate(anchor="alpha"), db, admin)
    assert exc.value.status_code == 422
