"""Generic sellable Product entity — funnels attach to a product (D1)."""
import uuid

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base import Base


def uuid_str() -> str:
    return str(uuid.uuid4())


class Product(Base):
    __tablename__ = "products"

    id = Column(String(36), primary_key=True, index=True, default=uuid_str)
    name = Column(String(255), nullable=False, index=True)
    slug = Column(String(255), unique=True, nullable=False, index=True)
    description = Column(Text, nullable=True)
    # Prices are integer VND
    base_price = Column(Integer, default=0, server_default="0", nullable=False)
    # 'digital' | 'service' — free-form string, validated at schema layer
    type = Column(String(50), nullable=False, index=True)
    status = Column(String(50), default="draft", server_default="draft", nullable=False, index=True)
    thumbnail_url = Column(String(1024), nullable=True)
    # Original row id when backfilled from an existing entity
    source_id = Column(String(36), nullable=True, index=True)
    created_by = Column(String(36), ForeignKey("admin_users.id"), nullable=False)
    updated_by = Column(String(36), ForeignKey("admin_users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    funnels = relationship(
        "Funnel",
        back_populates="product",
        cascade="all, delete-orphan",
        order_by="Funnel.created_at.desc()",
    )
