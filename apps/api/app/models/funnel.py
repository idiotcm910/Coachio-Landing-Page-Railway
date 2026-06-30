"""Sales Funnel models — per-product funnel with landing page + sections (D1, D13, D14).

Mirrors the course landing structure (`CourseLandingPage`/`CourseLandingSection`)
so the admin landing builder can be parameterized by owner instead of duplicated.
Funnel emails reuse the polymorphic `EmailTemplate` (scope='funnel') — no email
table here (D15).
"""
import uuid

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base import Base


def uuid_str() -> str:
    return str(uuid.uuid4())


class Funnel(Base):
    __tablename__ = "funnels"

    id = Column(String(36), primary_key=True, index=True, default=uuid_str)
    product_id = Column(String(36), ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    slug = Column(String(255), unique=True, nullable=False, index=True)
    status = Column(String(50), default="draft", server_default="draft", nullable=False, index=True)
    # Price is sourced exclusively from product.base_price — funnels have no own price.
    # currency stays for orders/QR (default VND); not exposed as a template variable or UI.
    currency = Column(String(10), default="VND", server_default="VND", nullable=False)
    # Checkout page config (form fields, copy) — JSON to stay admin-customizable
    checkout_config = Column(JSON().with_variant(JSONB, "postgresql"), nullable=True)
    # Success page config (headline, message, ...)
    success_config = Column(JSON().with_variant(JSONB, "postgresql"), nullable=True)
    zalo_link = Column(String(1024), nullable=True)
    # Admin custom template variables {key: value} (D13); default keys are reserved
    variables = Column(JSON().with_variant(JSONB, "postgresql"), nullable=True)
    # Side-car authoring metadata for custom variables: {key: {name, description, type}}.
    # type ∈ text|number|date|time|datetime — UI affordance only; substituted value
    # always stays the raw string in `variables`. Missing entry ⇒ treated as text.
    variables_meta = Column(JSON().with_variant(JSONB, "postgresql"), nullable=True)
    # Per-funnel Meta Pixel + CAPI config (D1, tracking spec); NULL = tracking disabled
    tracking_config = Column(JSON().with_variant(JSONB, "postgresql"), nullable=True)
    # Per-funnel capture token for public lead-capture API (D2, funnel-landing-lead-capture).
    # NULL = not yet generated; rotate by generating a new one (old token is immediately invalid).
    capture_token = Column(String(48), nullable=True, unique=True, index=True)
    created_by = Column(String(36), ForeignKey("admin_users.id"), nullable=False)
    updated_by = Column(String(36), ForeignKey("admin_users.id"), nullable=True)
    published_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    product = relationship("Product", back_populates="funnels")
    landing_page = relationship(
        "FunnelLandingPage",
        back_populates="funnel",
        cascade="all, delete-orphan",
        uselist=False,
    )


class FunnelLandingPage(Base):
    __tablename__ = "funnel_landing_pages"

    id = Column(String(36), primary_key=True, index=True, default=uuid_str)
    funnel_id = Column(String(36), ForeignKey("funnels.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    # Full SEO set (D14) — mirrors CourseLandingPage then extends it
    seo_title = Column(String(255), nullable=True)
    seo_description = Column(String(500), nullable=True)
    seo_keywords = Column(String(500), nullable=True)
    canonical_url = Column(String(1024), nullable=True)
    robots_index = Column(Boolean, default=True, server_default="true", nullable=False)
    robots_follow = Column(Boolean, default=True, server_default="true", nullable=False)
    og_title = Column(String(255), nullable=True)
    og_description = Column(String(500), nullable=True)
    og_image_url = Column(String(1024), nullable=True)
    og_type = Column(String(50), nullable=True)
    twitter_card = Column(String(50), nullable=True)
    twitter_title = Column(String(255), nullable=True)
    twitter_description = Column(String(500), nullable=True)
    twitter_image_url = Column(String(1024), nullable=True)
    favicon_url = Column(String(1024), nullable=True)
    theme_config = Column(JSON().with_variant(JSONB, "postgresql"), nullable=True)
    settings = Column(JSON().with_variant(JSONB, "postgresql"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    funnel = relationship("Funnel", back_populates="landing_page")
    sections = relationship(
        "FunnelSection",
        back_populates="landing_page",
        cascade="all, delete-orphan",
        order_by="FunnelSection.sort_order",
    )


class FunnelSection(Base):
    __tablename__ = "funnel_sections"

    id = Column(String(36), primary_key=True, index=True, default=uuid_str)
    landing_page_id = Column(String(36), ForeignKey("funnel_landing_pages.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(150), nullable=False)
    html = Column(Text, nullable=False, default="", server_default="")
    theme_mode = Column(String(20), default="light", server_default="light", nullable=False)
    section_type = Column(String(50), default="custom", server_default="custom", nullable=False, index=True)
    # Optional human-readable scroll anchor (slug), unique within the landing page.
    # Used by scroll CTAs to jump to this section; falls back to id when null.
    anchor = Column(String(80), nullable=True)
    responsive_config = Column(JSON().with_variant(JSONB, "postgresql"), nullable=True)
    sort_order = Column(Integer, default=0, server_default="0", nullable=False)
    is_visible = Column(Boolean, default=True, server_default="true", nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    landing_page = relationship("FunnelLandingPage", back_populates="sections")
