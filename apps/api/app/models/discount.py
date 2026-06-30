"""Stackable discounts + per-order applied-discount link (D2, D4) — GLOBAL pool.

Discounts are not owned by a funnel or course; any checkout can apply any code.
Per-owner default activation is tracked in `DiscountDefaultActivation`.
`redeemed_count` is incremented only inside the idempotent complete-order routine.

OrderDiscount is polymorphic: order_type='funnel'|'course', order_id references
the corresponding order by convention (no strict FK — app-enforced).
"""
import uuid

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base import Base


def uuid_str() -> str:
    return str(uuid.uuid4())


class Discount(Base):
    __tablename__ = "discounts"
    __table_args__ = (UniqueConstraint("code", name="uq_discounts_code"),)

    id = Column(String(36), primary_key=True, index=True, default=uuid_str)
    # code is globally unique and normalized to uppercase
    code = Column(String(80), nullable=False, index=True)
    # 'percent' | 'fixed' — stacking math sums percents first, fixed subtracts after (D2)
    discount_type = Column(String(20), nullable=False)
    discount_value = Column(Integer, nullable=False)
    starts_at = Column(DateTime(timezone=True), nullable=True)
    ends_at = Column(DateTime(timezone=True), nullable=True)
    max_redemptions = Column(Integer, nullable=True)
    redeemed_count = Column(Integer, default=0, server_default="0", nullable=False)
    is_active = Column(Boolean, default=True, server_default="true", nullable=False, index=True)
    created_by = Column(String(36), ForeignKey("admin_users.id"), nullable=False)
    updated_by = Column(String(36), ForeignKey("admin_users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Per-owner default activations (a discount can be auto-applied for specific funnels/courses)
    default_activations = relationship(
        "DiscountDefaultActivation",
        back_populates="discount",
        cascade="all, delete-orphan",
    )

    # Applicability scope (whitelist). EMPTY = global (usable anywhere);
    # one or more rows = usable ONLY on the listed funnels/courses.
    scopes = relationship(
        "DiscountScope",
        back_populates="discount",
        cascade="all, delete-orphan",
    )


class DiscountDefaultActivation(Base):
    """Records that a discount should auto-apply (as default) for a specific owner.

    owner_type: 'funnel' | 'course'
    owner_id: the funnel.id or course.id (no strict FK — polymorphic)
    """

    __tablename__ = "discount_default_activations"
    __table_args__ = (
        UniqueConstraint("discount_id", "owner_type", "owner_id", name="uq_dda_discount_owner"),
    )

    id = Column(String(36), primary_key=True, index=True, default=uuid_str)
    discount_id = Column(
        String(36),
        ForeignKey("discounts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # 'funnel' | 'course'
    owner_type = Column(String(20), nullable=False)
    owner_id = Column(String(36), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    discount = relationship("Discount", back_populates="default_activations")


class DiscountScope(Base):
    """Restricts a discount to specific owners (funnels/courses) — an allow-list.

    Distinct from DiscountDefaultActivation (auto-apply): scope controls WHERE a
    code may be used. EMPTY scope (no rows) = global; with rows = usable only on
    the listed owners.

    owner_type: 'funnel' | 'course'
    owner_id: the funnel.id or course.id (no strict FK — polymorphic)
    """

    __tablename__ = "discount_scopes"
    __table_args__ = (
        UniqueConstraint("discount_id", "owner_type", "owner_id", name="uq_discount_scope_owner"),
    )

    id = Column(String(36), primary_key=True, index=True, default=uuid_str)
    discount_id = Column(
        String(36),
        ForeignKey("discounts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # 'funnel' | 'course'
    owner_type = Column(String(20), nullable=False)
    owner_id = Column(String(36), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    discount = relationship("Discount", back_populates="scopes")


class OrderDiscount(Base):
    """Link table recording which discounts were applied to an order and at what value.

    Polymorphic: order_type='funnel'|'course', order_id references the order by
    app convention (no strict FK so the same table covers both order types).
    """

    __tablename__ = "order_discounts"
    __table_args__ = (
        UniqueConstraint(
            "order_type", "order_id", "discount_id",
            name="uq_order_discounts_type_order_discount",
        ),
    )

    id = Column(String(36), primary_key=True, index=True, default=uuid_str)
    order_type = Column(String(20), nullable=False, default="funnel", server_default="funnel")
    order_id = Column(String(36), nullable=False, index=True)
    discount_id = Column(String(36), ForeignKey("discounts.id", ondelete="CASCADE"), nullable=False, index=True)
    # Snapshot of what was applied (audit — discounts may change later)
    applied_percent = Column(Integer, default=0, server_default="0", nullable=False)
    applied_amount = Column(Integer, default=0, server_default="0", nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    discount = relationship("Discount")
