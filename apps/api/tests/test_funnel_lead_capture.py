"""Backend tests for funnel-landing-lead-capture feature (tasks 5.1, 5.2).

Covers:
  5.1 — capture creates subscribed lead; dedup updates; bad token 401;
        bad email 422; archived funnel 410; form-data + JSON accepted.
  5.2 — checkout upgrades subscribed→lead; _serialize/_filtered_leads for
        all 3 statuses; rotate invalidates old token.

Ported to coachio-landing-page: User/Course/Order/CourseOrder/ProductCourse removed;
`user` fixture replaced by a fixed string admin_id (SQLite no-FK).
"""
import pytest
from fastapi import BackgroundTasks
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db.base import get_db
from app.models.discount import Discount, DiscountDefaultActivation, DiscountScope, OrderDiscount
from app.models.funnel import Funnel, FunnelLandingPage, FunnelSection
from app.models.funnel_order import FunnelOrder
from app.models.lead import Lead
from app.models.product import Product
from app.schemas.funnel_checkout import FunnelCheckoutRequest
from app.services.funnel_order_service import FunnelOrderService
from app.services.funnel_capture_token_service import (
    generate_capture_token,
    get_or_create_capture_token,
    rotate_capture_token,
    resolve_funnel_by_token,
)
from app.api.v1.endpoints.admin.leads import _filtered_leads, _serialize, _paid_amount_subquery

# ---------------------------------------------------------------------------
# DB setup — SQLite, mirrors test_funnel_checkout_flow.py pattern
# ---------------------------------------------------------------------------

SQLALCHEMY_DATABASE_URL = "sqlite:///./test_funnel_lead_capture.db"
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


# ---------------------------------------------------------------------------
# Fixtures — admin_id is a plain string; SQLite doesn't enforce FK constraints
# ---------------------------------------------------------------------------

ADMIN_ID = "admin-test"


@pytest.fixture()
def product(db):
    p = Product(
        id="prod-1",
        name="Test Product",
        slug="test-product",
        base_price=100000,
        type="digital",
        created_by=ADMIN_ID,
    )
    db.add(p)
    db.flush()
    return p


@pytest.fixture()
def published_funnel(db, product):
    f = Funnel(
        id="funnel-1",
        product_id=product.id,
        title="Test Funnel",
        slug="test-funnel",
        status="published",
        created_by=ADMIN_ID,
    )
    db.add(f)
    db.flush()
    return f


@pytest.fixture()
def archived_funnel(db, product):
    f = Funnel(
        id="funnel-archived",
        product_id=product.id,
        title="Archived Funnel",
        slug="archived-funnel",
        status="archived",
        created_by=ADMIN_ID,
    )
    db.add(f)
    db.flush()
    return f


# ---------------------------------------------------------------------------
# FastAPI test client wired to the test DB
# ---------------------------------------------------------------------------

@pytest.fixture()
def client(db):
    """TestClient with get_db overridden to use the test SQLite session."""
    from main import app

    def override_get_db():
        yield db

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app, raise_server_exceptions=True) as c:
        yield c
    app.dependency_overrides.clear()


# ===========================================================================
# 5.1 — Capture endpoint tests
# ===========================================================================

class TestCaptureEndpoint:
    def test_capture_creates_subscribed_lead(self, client, db, published_funnel):
        """Valid token + email → lead created with status='subscribed'."""
        token = get_or_create_capture_token(db, published_funnel)
        db.commit()

        resp = client.post(
            "/api/v1/public/funnels/leads/capture",
            data={"token": token, "email": "newlead@example.com", "name": "Alice"},
        )
        assert resp.status_code == 200
        assert resp.json()["ok"] is True

        lead = db.query(Lead).filter(Lead.email == "newlead@example.com").first()
        assert lead is not None
        assert lead.status == "subscribed"
        assert lead.name == "Alice"
        assert lead.source_funnel_id == published_funnel.id

    def test_capture_dedup_updates_not_duplicates(self, client, db, published_funnel):
        """Same email submitted twice → one lead, name/phone updated, status not downgraded."""
        token = get_or_create_capture_token(db, published_funnel)
        db.commit()

        client.post(
            "/api/v1/public/funnels/leads/capture",
            data={"token": token, "email": "dup@example.com", "name": "Bob"},
        )
        client.post(
            "/api/v1/public/funnels/leads/capture",
            data={"token": token, "email": "dup@example.com", "name": "Bobby", "phone": "0909"},
        )

        leads = db.query(Lead).filter(Lead.email == "dup@example.com").all()
        assert len(leads) == 1
        assert leads[0].name == "Bobby"
        assert leads[0].phone == "0909"
        assert leads[0].status == "subscribed"

    def test_bad_token_returns_401(self, client, db, published_funnel):
        """Unknown token → 401, no lead recorded."""
        resp = client.post(
            "/api/v1/public/funnels/leads/capture",
            data={"token": "fct_thisiswrong", "email": "x@example.com"},
        )
        assert resp.status_code == 401
        assert db.query(Lead).count() == 0

    def test_missing_token_returns_401(self, client, db):
        resp = client.post(
            "/api/v1/public/funnels/leads/capture",
            data={"email": "x@example.com"},
        )
        assert resp.status_code == 401

    def test_bad_email_returns_422(self, client, db, published_funnel):
        """Valid token but malformed email → 422, no lead recorded."""
        token = get_or_create_capture_token(db, published_funnel)
        db.commit()

        resp = client.post(
            "/api/v1/public/funnels/leads/capture",
            data={"token": token, "email": "not-an-email"},
        )
        assert resp.status_code == 422
        assert db.query(Lead).count() == 0

    def test_archived_funnel_returns_410(self, client, db, archived_funnel):
        """Token belonging to archived funnel → 410, no lead recorded."""
        token = get_or_create_capture_token(db, archived_funnel)
        db.commit()

        resp = client.post(
            "/api/v1/public/funnels/leads/capture",
            data={"token": token, "email": "x@example.com"},
        )
        assert resp.status_code == 410
        assert db.query(Lead).count() == 0

    def test_json_payload_accepted(self, client, db, published_funnel):
        """application/json payload also works (CORS non-simple request path)."""
        token = get_or_create_capture_token(db, published_funnel)
        db.commit()

        resp = client.post(
            "/api/v1/public/funnels/leads/capture",
            json={"token": token, "email": "jsonlead@example.com"},
        )
        assert resp.status_code == 200
        assert resp.json()["ok"] is True

    def test_cors_header_present(self, client, db, published_funnel):
        """Response always includes ACAO: * header."""
        token = get_or_create_capture_token(db, published_funnel)
        db.commit()

        resp = client.post(
            "/api/v1/public/funnels/leads/capture",
            data={"token": token, "email": "cors@example.com"},
        )
        assert resp.headers.get("access-control-allow-origin") == "*"

    def test_meta_fields_stored(self, client, db, published_funnel):
        """Extra fields (utm_source etc.) are stored in lead.meta."""
        token = get_or_create_capture_token(db, published_funnel)
        db.commit()

        resp = client.post(
            "/api/v1/public/funnels/leads/capture",
            data={
                "token": token,
                "email": "meta@example.com",
                "utm_source": "facebook",
                "utm_campaign": "summer",
            },
        )
        assert resp.status_code == 200
        lead = db.query(Lead).filter(Lead.email == "meta@example.com").first()
        assert lead.meta is not None
        assert lead.meta.get("utm_source") == "facebook"


# ===========================================================================
# 5.2 — Checkout upgrade + filter/serialize + rotate tests
# ===========================================================================

class TestCheckoutUpgrade:
    def test_subscribed_upgraded_to_lead_at_checkout(self, db, published_funnel):
        """A subscribed lead entering checkout is upgraded to 'lead'."""
        lead = Lead(
            email="upgrade@example.com",
            source_funnel_id=published_funnel.id,
            status="subscribed",
        )
        db.add(lead)
        db.commit()

        request = FunnelCheckoutRequest(
            buyer_email="upgrade@example.com",
            buyer_name="Test",
            buyer_phone="0901234567",
            discount_codes=[],
        )
        FunnelOrderService._upsert_lead(db, published_funnel, request)
        db.commit()

        db.refresh(lead)
        assert lead.status == "lead"

    def test_lead_status_not_changed_at_checkout(self, db, published_funnel):
        """A lead already at 'lead' status stays 'lead' after checkout upsert."""
        lead = Lead(
            email="leadstatus@example.com",
            source_funnel_id=published_funnel.id,
            status="lead",
        )
        db.add(lead)
        db.commit()

        request = FunnelCheckoutRequest(
            buyer_email="leadstatus@example.com",
            buyer_name="Test",
            buyer_phone="0901234567",
            discount_codes=[],
        )
        FunnelOrderService._upsert_lead(db, published_funnel, request)
        db.commit()

        db.refresh(lead)
        assert lead.status == "lead"


class TestSerializeAndFilter:
    def _make_leads(self, db, funnel):
        subscribed = Lead(email="sub@test.com", source_funnel_id=funnel.id, status="subscribed")
        lead_ = Lead(email="lead@test.com", source_funnel_id=funnel.id, status="lead")
        purchased = Lead(email="bought@test.com", source_funnel_id=funnel.id, status="lead")
        db.add_all([subscribed, lead_, purchased])
        db.flush()
        # Give 'purchased' a successful order above threshold
        order = FunnelOrder(
            id="order-1",
            funnel_id=funnel.id,
            lead_id=purchased.id,
            order_code="SEP0000000001",
            subtotal_amount=500000,
            discount_amount=0,
            final_amount=500000,
            status="SUCCESS",
            funnel_title=funnel.title,
            funnel_slug=funnel.slug,
            product_name="Test",
            buyer_email="bought@test.com",
            buyer_full_name="Buyer",
            buyer_phone="",
        )
        db.add(order)
        db.commit()
        return subscribed, lead_, purchased

    def test_serialize_subscribed(self, db, published_funnel):
        sub, _, _ = self._make_leads(db, published_funnel)
        result = _serialize(sub, 0)
        assert result.status == "subscribed"

    def test_serialize_lead(self, db, published_funnel):
        _, lead_, _ = self._make_leads(db, published_funnel)
        result = _serialize(lead_, 0)
        assert result.status == "lead"

    def test_serialize_purchased(self, db, published_funnel):
        _, _, purch = self._make_leads(db, published_funnel)
        result = _serialize(purch, 500000)
        assert result.status == "purchased"

    def test_filter_subscribed(self, db, published_funnel):
        self._make_leads(db, published_funnel)
        results = _filtered_leads(db, None, None, None, None, status="subscribed").all()
        emails = {r.email for r in results}
        assert "sub@test.com" in emails
        assert "lead@test.com" not in emails
        assert "bought@test.com" not in emails

    def test_filter_lead(self, db, published_funnel):
        self._make_leads(db, published_funnel)
        results = _filtered_leads(db, None, None, None, None, status="lead").all()
        emails = {r.email for r in results}
        assert "lead@test.com" in emails
        assert "sub@test.com" not in emails
        assert "bought@test.com" not in emails

    def test_filter_purchased(self, db, published_funnel):
        self._make_leads(db, published_funnel)
        results = _filtered_leads(db, None, None, None, None, status="purchased").all()
        emails = {r.email for r in results}
        assert "bought@test.com" in emails
        assert "lead@test.com" not in emails
        assert "sub@test.com" not in emails


class TestCaptureTokenRotate:
    def test_rotate_invalidates_old_token(self, db, published_funnel):
        """After rotate, old token no longer resolves to the funnel."""
        old_token = get_or_create_capture_token(db, published_funnel)
        db.commit()

        new_token = rotate_capture_token(db, published_funnel)
        db.commit()

        assert new_token != old_token
        assert resolve_funnel_by_token(db, old_token) is None
        assert resolve_funnel_by_token(db, new_token) is not None

    def test_generate_token_format(self):
        """Token starts with 'fct_' prefix and is within VARCHAR(48)."""
        token = generate_capture_token()
        assert token.startswith("fct_")
        assert len(token) <= 48
