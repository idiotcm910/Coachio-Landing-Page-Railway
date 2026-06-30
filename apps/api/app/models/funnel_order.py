"""Generic funnel order — Landing → Checkout → Payment-Success flow (D3, D7).

Reuses the SePay order-code convention from `CourseOrder` so the existing
webhook routing can resolve funnel orders by code + amount. `final_amount == 0`
orders are created directly in SUCCESS and skip SePay (free path, D3).
"""
import uuid

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from sqlalchemy import and_, literal

from app.db.base import Base


class FunnelOrder(Base):
    __tablename__ = "funnel_orders"

    id = Column(String(36), primary_key=True, index=True, default=lambda: str(uuid.uuid4()))
    funnel_id = Column(String(36), ForeignKey("funnels.id", ondelete="CASCADE"), nullable=False, index=True)
    lead_id = Column(String(36), ForeignKey("leads.id", ondelete="SET NULL"), nullable=True, index=True)
    order_code = Column(String(13), unique=True, index=True, nullable=False)
    # Amounts are integer VND; server is the single source of truth (D11)
    subtotal_amount = Column(Integer, nullable=False, default=0, server_default="0")
    discount_amount = Column(Integer, nullable=False, default=0, server_default="0")
    final_amount = Column(Integer, nullable=False, default=0, server_default="0")
    status = Column(String(20), nullable=False, default="PENDING", server_default="PENDING", index=True)
    payment_provider = Column(String(30), nullable=False, default="sepay", server_default="sepay")
    # Snapshot of what was sold (funnel/product may change later)
    funnel_title = Column(String(255), nullable=False)
    funnel_slug = Column(String(255), nullable=False)
    product_name = Column(String(255), nullable=False)
    buyer_email = Column(String(255), nullable=False)
    buyer_full_name = Column(String(255), nullable=True)
    buyer_phone = Column(String(50), nullable=True)
    paid_at = Column(DateTime(timezone=True), nullable=True)
    # Browser signals persisted at checkout so webhook-path CAPI retains attribution (E1)
    fbp = Column(String(255), nullable=True)
    fbc = Column(String(512), nullable=True)
    client_ip_address = Column(String(64), nullable=True)
    client_user_agent = Column(String(1024), nullable=True)
    # Manual activation audit — set when an admin marks a PENDING order as paid
    # from the System Admin Orders UI (buyer paid but altered the transfer memo so
    # the SePay webhook could not auto-match by order_code/amount).
    manual_activated_by = Column(String(36), ForeignKey("admin_users.id", ondelete="SET NULL"), nullable=True)
    manual_activated_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    funnel = relationship("Funnel")
    lead = relationship("Lead", back_populates="orders")
    # viewonly — OrderDiscount is now polymorphic (no FK from order_discounts.order_id to here)
    order_discounts = relationship(
        "OrderDiscount",
        primaryjoin="and_(foreign(OrderDiscount.order_id) == FunnelOrder.id, OrderDiscount.order_type == 'funnel')",
        viewonly=True,
        uselist=True,
    )
