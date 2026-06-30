"""Tests for funnel clone independence (task 8.4) and the variable resolver (task 8.7).

Ported to coachio-landing-page: User removed; admin represented as fixed string id.
"""
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.models.discount import Discount, DiscountDefaultActivation, DiscountScope, OrderDiscount
from app.models.email_template import EmailTemplate
from app.models.funnel import Funnel, FunnelLandingPage, FunnelSection
from app.models.funnel_order import FunnelOrder
from app.models.lead import Lead
from app.models.product import Product
from app.services.funnel_clone_service import clone_funnel
from app.services.funnel_variable_resolver import (
    get_default_variables,
    render_funnel_tokens,
    resolve_variables,
)

SQLALCHEMY_DATABASE_URL = "sqlite:///./test_funnel_clone_vars.db"
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
    EmailTemplate.__table__,
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


def create_full_funnel(db):
    admin_id = "admin-test"
    product = Product(name="Workshop AI", slug="workshop-ai", base_price=2_000_000, type="course", created_by=admin_id)
    db.add(product)
    db.flush()
    funnel = Funnel(
        product_id=product.id, title="Origin", slug="origin", status="published",
        zalo_link="https://zalo.me/g/x",
        variables={"bonus": "Ebook tặng kèm"}, created_by=admin_id,
    )
    db.add(funnel)
    db.flush()
    landing = FunnelLandingPage(funnel_id=funnel.id, seo_title="SEO Origin", og_type="website")
    db.add(landing)
    db.flush()
    db.add(FunnelSection(landing_page_id=landing.id, name="Hero", html="<h1>{{funnel_title}}</h1>", sort_order=0))
    discount = Discount(code="SALE50", discount_type="percent", discount_value=50,
                        redeemed_count=7, created_by=admin_id)
    db.add(discount)
    db.flush()
    db.add(DiscountDefaultActivation(discount_id=discount.id, owner_type="funnel", owner_id=funnel.id))
    db.add(EmailTemplate(scope="funnel", owner_id=funnel.id, template_key="receipt",
                         enabled=True, subject="Hi {{buyer_name}}", html_body="<p>{{order_code}}</p>"))
    db.commit()
    db.refresh(funnel)
    return funnel, admin_id


# ─── Clone (8.4) ─────────────────────────────────────────────────────────────


def test_clone_copies_everything_and_resets_counters(db):
    funnel, admin_id = create_full_funnel(db)

    clone = clone_funnel(db, funnel, "origin-copy", None, admin_id)

    assert clone.status == "draft" and clone.slug == "origin-copy"
    assert clone.variables == {"bonus": "Ebook tặng kèm"}
    assert clone.zalo_link == funnel.zalo_link
    assert clone.landing_page.seo_title == "SEO Origin"
    assert [s.name for s in clone.landing_page.sections] == ["Hero"]
    cloned_activation = db.query(DiscountDefaultActivation).filter(
        DiscountDefaultActivation.owner_type == "funnel",
        DiscountDefaultActivation.owner_id == clone.id
    ).one()
    assert cloned_activation.discount.code == "SALE50"
    assert db.query(Discount).filter(Discount.code == "SALE50").count() == 1
    cloned_email = db.query(EmailTemplate).filter(
        EmailTemplate.scope == "funnel", EmailTemplate.owner_id == clone.id).one()
    assert cloned_email.subject == "Hi {{buyer_name}}"


def test_clone_is_independent_of_source(db):
    funnel, admin_id = create_full_funnel(db)

    clone = clone_funnel(db, funnel, "origin-copy", None, admin_id)

    # Modify the clone's section without touching the source
    clone.landing_page.sections[0].html = "<h1>Clone only</h1>"
    db.commit()

    db.refresh(funnel)
    assert funnel.landing_page.sections[0].html == "<h1>{{funnel_title}}</h1>"


def test_clone_discount_global_update_visible_everywhere(db):
    """Updating the global discount value is visible in both source and clone activations."""
    funnel, admin_id = create_full_funnel(db)
    clone = clone_funnel(db, funnel, "origin-copy", None, admin_id)
    db.commit()

    discount = db.query(Discount).filter(Discount.code == "SALE50").first()
    discount.discount_value = 99
    db.commit()

    assert clone.title == "Copy" or clone.slug == "origin-copy"
    assert clone.landing_page.sections[0].html == "<h1>{{funnel_title}}</h1>"
    source_activation = db.query(DiscountDefaultActivation).filter(
        DiscountDefaultActivation.owner_type == "funnel",
        DiscountDefaultActivation.owner_id == funnel.id
    ).one()
    clone_activation = db.query(DiscountDefaultActivation).filter(
        DiscountDefaultActivation.owner_type == "funnel",
        DiscountDefaultActivation.owner_id == clone.id
    ).one()
    assert source_activation.discount.discount_value == 99
    assert clone_activation.discount.discount_value == 99  # Same global discount


def test_clone_rejects_duplicate_slug(db):
    from fastapi import HTTPException

    funnel, admin_id = create_full_funnel(db)
    with pytest.raises(HTTPException):
        clone_funnel(db, funnel, "origin", None, admin_id)


# ─── Variable resolver (8.7) ─────────────────────────────────────────────────


def test_default_variables_fixed_v1_set(db):
    funnel, _ = create_full_funnel(db)
    defaults = get_default_variables(funnel)

    assert set(defaults) == {
        "product_name", "funnel_title", "price",
        "discounted_price", "discount_percent",
        "checkout_url", "success_url", "zalo_link",
    }
    assert defaults["product_name"] == "Workshop AI"
    assert defaults["price"] == "2.000.000"
    assert defaults["discounted_price"] == "2.000.000"
    assert defaults["discount_percent"] == "0"
    assert defaults["checkout_url"].endswith("/funnels/origin/checkout")


def test_variables_meta_validation():
    """Typed metadata: valid types pass; bad type / orphan / reserved / value-mismatch reject."""
    import pytest

    from app.schemas.funnel import FunnelCreate

    FunnelCreate(
        product_id="p", title="t", slug="s",
        variables={"webinar_at": "2026-07-01T19:30"},
        variables_meta={"webinar_at": {"name": "Giờ webinar", "type": "datetime"}},
    )
    FunnelCreate(product_id="p", title="t", slug="s", variables={"legacy": "x"})

    for bad_meta, bad_vars in [
        ({"a": {"type": "bogus"}}, {"a": "x"}),
        ({"b": {"type": "text"}}, {"a": "x"}),
        ({"price": {"type": "text"}}, {"a": "x"}),
        ({"d": {"type": "date"}}, {"d": "not-a-date"}),
    ]:
        with pytest.raises(Exception):
            FunnelCreate(product_id="p", title="t", slug="s", variables=bad_vars, variables_meta=bad_meta)


def test_custom_variables_merge_but_cannot_override_reserved(db):
    funnel, _ = create_full_funnel(db)
    funnel.variables = {"bonus": "Ebook", "price": "0 đồng (hacked)"}

    resolved = resolve_variables(funnel)

    assert resolved["bonus"] == "Ebook"
    assert resolved["price"] == "2.000.000"  # reserved key wins (from product.base_price)


def test_render_tokens_substitutes_and_blanks_unknown(db):
    funnel, _ = create_full_funnel(db)
    resolved = resolve_variables(funnel)

    html = render_funnel_tokens(
        "<p>{{funnel_title}} — {{bonus}} — [{{unknown_token}}]</p>", resolved
    )

    assert html == "<p>Origin — Ebook tặng kèm — []</p>"


def test_render_applies_to_email_after_sanitize(db):
    from app.services.email_render import sanitize_email_html

    funnel, _ = create_full_funnel(db)
    resolved = resolve_variables(funnel)
    dirty = "<p>{{price}}</p><script>alert(1)</script>"

    html = render_funnel_tokens(sanitize_email_html(dirty), resolved)

    assert "2.000.000" in html and "<script>" not in html
