"""Tests for the admin "activate funnel order" endpoint.

POST /api/v1/admin/funnel-orders/{id}/activate manually flips a PENDING order to
SUCCESS (buyer paid but altered the SePay memo so the webhook could not match) and
runs the shared complete_order side-effects. Email + Meta CAPI are monkeypatched so
the background tasks the endpoint schedules never hit the network.

Ported to coachio-landing-page: User replaced by AdminUser (no credits/role/username).
Course/Order/CourseOrder/ProductCourse tables removed.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db.base import get_db
from app.models.admin_user import AdminUser
from app.models.discount import Discount, DiscountDefaultActivation, DiscountScope, OrderDiscount
from app.models.funnel import Funnel, FunnelLandingPage, FunnelSection
from app.models.funnel_order import FunnelOrder
from app.models.lead import Lead
from app.models.product import Product

SQLALCHEMY_DATABASE_URL = "sqlite:///./test_admin_funnel_order_activate.db"
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


@pytest.fixture(autouse=True)
def _no_network(monkeypatch):
    """Neutralise the success-flow background tasks (email + CAPI) so the endpoint's
    BackgroundTasks — which DO run under TestClient — never open a real session or
    call out to Resend/Meta."""
    import app.services.funnel_order_service as fos

    monkeypatch.setattr(fos, "send_funnel_receipt_email", lambda *a, **k: None)
    monkeypatch.setattr(fos, "fire_capi_event_bg", lambda *a, **k: None, raising=False)
    monkeypatch.setattr(fos, "fire_capi_event", lambda *a, **k: None, raising=False)


@pytest.fixture()
def client(db):
    from main import app

    app.dependency_overrides[get_db] = lambda: db
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c
    app.dependency_overrides.clear()


def _make_admin(db) -> AdminUser:
    admin = AdminUser(
        email=f"admin_{uuid.uuid4().hex[:6]}@example.com",
        hashed_password="x",
    )
    db.add(admin)
    db.flush()
    return admin


def _admin_token(db) -> str:
    from app.core.security import create_access_token
    admin = _make_admin(db)
    return create_access_token(data={"sub": admin.id})


def _make_funnel(db, admin_id: str) -> Funnel:
    # Plain product (no linked courses) → fulfilment is a no-op.
    product = Product(name="Workshop", slug=f"ws-{uuid.uuid4().hex[:6]}", base_price=199000, type="course", created_by=admin_id)
    db.add(product)
    db.flush()
    funnel = Funnel(
        product_id=product.id, title="Test Funnel", slug=f"tf-{uuid.uuid4().hex[:6]}",
        status="published", created_by=admin_id, zalo_link="https://zalo.me/g/abc",
    )
    db.add(funnel)
    db.flush()
    return funnel


def _make_order(db, funnel, status="PENDING", final_amount=199000) -> FunnelOrder:
    order = FunnelOrder(
        id=str(uuid.uuid4()),
        funnel_id=funnel.id,
        order_code="SEP" + str(uuid.uuid4().int)[:10],
        funnel_title=funnel.title, funnel_slug=funnel.slug, product_name="Workshop",
        buyer_email="buyer@example.com", buyer_full_name="Buyer", buyer_phone="0901234567",
        subtotal_amount=final_amount, discount_amount=0, final_amount=final_amount,
        status=status, payment_provider="sepay",
        paid_at=datetime.now(timezone.utc) if status == "SUCCESS" else None,
    )
    db.add(order)
    db.commit()
    db.refresh(order)
    return order


def _url(order_id: str) -> str:
    return f"/api/v1/admin/funnel-orders/{order_id}/activate"


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

def test_activate_requires_auth(db, client):
    admin = _make_admin(db)
    order = _make_order(db, _make_funnel(db, admin.id))
    resp = client.post(_url(order.id))
    assert resp.status_code in (401, 403)


def test_activate_flips_pending_to_success_with_audit(db, client):
    admin = _make_admin(db)
    order = _make_order(db, _make_funnel(db, admin.id))
    token = _admin_token(db)

    resp = client.post(_url(order.id), headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "SUCCESS"
    assert body["paid_at"] is not None
    assert body["manual_activated_by"] is not None
    assert body["manual_activated_at"] is not None

    db.expire_all()
    refreshed = db.query(FunnelOrder).filter(FunnelOrder.id == order.id).first()
    assert refreshed.status == "SUCCESS"
    assert refreshed.manual_activated_by is not None


def test_activate_converts_linked_lead(db, client):
    admin = _make_admin(db)
    funnel = _make_funnel(db, admin.id)
    lead = Lead(id=str(uuid.uuid4()), source_funnel_id=funnel.id, email="buyer@example.com", name="Buyer")
    db.add(lead)
    db.flush()
    order = _make_order(db, funnel)
    order.lead_id = lead.id
    db.commit()

    token = _admin_token(db)
    resp = client.post(_url(order.id), headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200

    db.expire_all()
    assert db.query(Lead).filter(Lead.id == lead.id).first().converted_at is not None


def test_activate_already_success_returns_409(db, client):
    admin = _make_admin(db)
    order = _make_order(db, _make_funnel(db, admin.id), status="SUCCESS")
    token = _admin_token(db)

    resp = client.post(_url(order.id), headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 409


def test_activate_missing_order_returns_404(db, client):
    token = _admin_token(db)
    resp = client.post(_url(str(uuid.uuid4())), headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 404
