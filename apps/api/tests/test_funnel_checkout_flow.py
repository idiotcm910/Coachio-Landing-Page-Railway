"""Integration tests for the funnel checkout/order flow (tasks 8.1, 8.2, 8.3, 8.5).

Paid flow: quote → checkout (PENDING + QR) → SePay webhook → SUCCESS.
Free flow: 100% discount → SUCCESS immediately, no SePay fields.
Lead: captured at checkout, deduped, converted on success.
Webhook idempotency: retry doesn't double-increment redemptions.

Updated for global discount pool (20260618_0000): Discount no longer has funnel_id.
Ported to coachio-landing-page: User/Course/Order/CourseOrder/ProductCourse removed;
admin represented as a fixed string id (SQLite no-FK).
"""
import asyncio

import pytest
from fastapi import BackgroundTasks
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.models.discount import Discount, DiscountDefaultActivation, DiscountScope, OrderDiscount
from app.models.funnel import Funnel, FunnelLandingPage, FunnelSection
from app.models.funnel_order import FunnelOrder
from app.models.lead import Lead
from app.models.product import Product
from app.schemas.funnel_checkout import FunnelCheckoutRequest
from app.services.funnel_order_service import FunnelOrderService

SQLALCHEMY_DATABASE_URL = "sqlite:///./test_funnel_checkout_flow.db"
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


@pytest.fixture()
def bg():
    # Collects tasks without executing them → no real email sends in tests
    return BackgroundTasks()


def create_funnel(db, sale_price=1_000_000, status="published"):
    # Use a fixed string as admin id — no User model needed (SQLite no-FK)
    admin_id = "admin-test"
    product = Product(name="Workshop AI", slug="workshop-ai", base_price=sale_price, type="course", created_by=admin_id)
    db.add(product)
    db.flush()
    funnel = Funnel(
        product_id=product.id, title="Workshop AI Funnel", slug="workshop-ai-funnel",
        status=status, created_by=admin_id, zalo_link="https://zalo.me/g/abc",
    )
    db.add(funnel)
    db.commit()
    db.refresh(funnel)
    return funnel, admin_id


def add_global_discount(db, created_by, code, value, dtype="percent", **kwargs):
    """Create a global (non-funnel-scoped) discount."""
    discount = Discount(code=code, discount_type=dtype, discount_value=value, created_by=created_by, **kwargs)
    db.add(discount)
    db.commit()
    db.refresh(discount)
    return discount


def checkout_request(codes=None):
    return FunnelCheckoutRequest(
        buyer_name="Nguyễn Văn An",
        buyer_email="an@example.com",
        buyer_phone="0901234567",
        discount_codes=codes or [],
    )


def sepay_payload(order_code, amount):
    return {"content": f"Thanh toan {order_code} ngan hang", "transferAmount": amount}


def test_paid_flow_quote_checkout_webhook_success(db, bg):
    funnel, admin_id = create_funnel(db)
    add_global_discount(db, admin_id, "SAVE20", 20)

    quote = FunnelOrderService.quote(db, funnel, ["SAVE20"])
    assert quote.final_amount == 800_000 and not quote.is_free

    response = FunnelOrderService.checkout(db, funnel, checkout_request(["SAVE20"]), background_tasks=bg)
    assert response.status == "PENDING"
    assert response.qr_url and "qr.sepay.vn" in response.qr_url
    assert response.final_amount == 800_000

    result = asyncio.run(
        FunnelOrderService.process_webhook(sepay_payload(response.order_code, 800_000), db, bg)
    )
    assert result["status"] == "success"

    order = db.query(FunnelOrder).filter(FunnelOrder.order_code == response.order_code).first()
    assert order.status == "SUCCESS" and order.paid_at is not None
    discount = db.query(Discount).filter(Discount.code == "SAVE20").first()
    assert discount.redeemed_count == 1
    status = FunnelOrderService.order_status(db, order)
    assert status.zalo_link == "https://zalo.me/g/abc"


def test_free_flow_skips_sepay(db, bg):
    funnel, admin_id = create_funnel(db)
    add_global_discount(db, admin_id, "FREE100", 100)

    response = FunnelOrderService.checkout(db, funnel, checkout_request(["FREE100"]), background_tasks=bg)

    assert response.is_free and response.status == "SUCCESS"
    assert response.qr_url is None and response.final_amount == 0
    order = db.query(FunnelOrder).filter(FunnelOrder.id == response.order_id).first()
    assert order.status == "SUCCESS"
    lead = db.query(Lead).filter(Lead.email == "an@example.com").first()
    assert lead is not None and lead.converted_at is not None


def test_lead_capture_dedupe_and_conversion(db, bg):
    funnel, _ = create_funnel(db)

    first = FunnelOrderService.checkout(db, funnel, checkout_request(), background_tasks=bg)
    second = FunnelOrderService.checkout(db, funnel, checkout_request(), background_tasks=bg)

    leads = db.query(Lead).filter(Lead.source_funnel_id == funnel.id).all()
    assert len(leads) == 1  # deduped on (email, funnel)
    assert leads[0].converted_at is None  # PENDING orders don't convert

    asyncio.run(FunnelOrderService.process_webhook(
        sepay_payload(second.order_code, 1_000_000), db, bg))
    db.expire_all()
    assert leads[0].converted_at is not None


def test_webhook_idempotency_no_double_side_effects(db, bg):
    funnel, admin_id = create_funnel(db)
    add_global_discount(db, admin_id, "HALF", 50)

    response = FunnelOrderService.checkout(db, funnel, checkout_request(["HALF"]), background_tasks=bg)
    payload = sepay_payload(response.order_code, 500_000)

    first = asyncio.run(FunnelOrderService.process_webhook(payload, db, bg))
    retry = asyncio.run(FunnelOrderService.process_webhook(payload, db, bg))

    assert first["status"] == "success"
    assert retry["status"] == "already_processed"
    discount = db.query(Discount).filter(Discount.code == "HALF").first()
    assert discount.redeemed_count == 1  # not double-incremented


def test_webhook_amount_mismatch_keeps_pending(db, bg):
    funnel, _ = create_funnel(db)
    response = FunnelOrderService.checkout(db, funnel, checkout_request(), background_tasks=bg)

    result = asyncio.run(FunnelOrderService.process_webhook(
        sepay_payload(response.order_code, 999), db, bg))

    assert result["status"] == "amount_mismatch"
    order = db.query(FunnelOrder).filter(FunnelOrder.order_code == response.order_code).first()
    assert order.status == "PENDING"


def test_default_activation_auto_applies_on_funnel_checkout(db, bg):
    """Discount set as default for a funnel auto-applies without explicit code."""
    funnel, admin_id = create_funnel(db)
    discount = add_global_discount(db, admin_id, "DEFAULT10", 10)
    db.add(DiscountDefaultActivation(discount_id=discount.id, owner_type="funnel", owner_id=funnel.id))
    db.commit()

    quote = FunnelOrderService.quote(db, funnel, [])  # no explicit codes
    assert quote.total_percent == 10
    assert quote.final_amount == 900_000
