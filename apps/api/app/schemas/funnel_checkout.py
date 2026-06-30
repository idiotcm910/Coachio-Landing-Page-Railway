"""Pydantic schemas for the public funnel checkout flow (quote → checkout → status).

Server is the single source of truth for all amounts (D11) — the client only
renders what these responses return.
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field, field_validator


class AppliedDiscountInfo(BaseModel):
    """Per-code status echoed back so the checkout UI can show applied/rejected."""

    code: str
    applied: bool
    discount_type: Optional[str] = None
    discount_value: Optional[int] = None
    applied_percent: int = 0
    applied_amount: int = 0
    reason: Optional[str] = None  # rejection reason when applied=False


class FunnelQuoteRequest(BaseModel):
    discount_codes: list[str] = Field(default_factory=list, max_length=10)

    @field_validator("discount_codes")
    @classmethod
    def normalize_codes(cls, v: list[str]) -> list[str]:
        # dedupe, keep order
        seen: dict[str, None] = {}
        for code in v:
            normalized = code.strip().upper()
            if normalized:
                seen.setdefault(normalized)
        return list(seen)


class FunnelQuoteResponse(BaseModel):
    funnel_id: str
    funnel_title: str
    currency: str
    subtotal_amount: int
    discount_amount: int
    total_percent: int  # summed percent, capped at 100 (D2)
    final_amount: int
    is_free: bool  # final_amount == 0 → free path (D3)
    discounts: list[AppliedDiscountInfo]
    # Presentation config for the public checkout page (template/headline/message/
    # custom_html/accent_color). Surfaced here so the checkout client renders the
    # admin-selected layout without an extra request.
    checkout_config: Optional[dict] = None


class FunnelCheckoutRequest(BaseModel):
    buyer_name: str = Field(..., min_length=1, max_length=255)
    buyer_email: EmailStr
    buyer_phone: str = Field(..., min_length=7, max_length=20)
    discount_codes: list[str] = Field(default_factory=list, max_length=10)
    # Meta browser attribution signals forwarded from the browser (D7, D5)
    # fbp / fbc are unhashed Meta cookies; event_id is the shared dedup id
    fbp: Optional[str] = Field(None, max_length=128)
    fbc: Optional[str] = Field(None, max_length=256)
    event_id: Optional[str] = Field(None, max_length=128)

    @field_validator("buyer_phone")
    @classmethod
    def validate_vn_phone(cls, v: str) -> str:
        """Accept Vietnamese mobile numbers: 10 digits starting with 0, or +84 prefix."""
        import re

        stripped = v.strip()
        if not re.match(r"^(0[3-9]\d{8}|\+84[3-9]\d{8})$", stripped):
            raise ValueError("Số điện thoại không hợp lệ (phải là số di động Việt Nam)")
        return stripped

    @field_validator("discount_codes")
    @classmethod
    def normalize_codes(cls, v: list[str]) -> list[str]:
        seen: dict[str, None] = {}
        for code in v:
            normalized = code.strip().upper()
            if normalized:
                seen.setdefault(normalized)
        return list(seen)


class FunnelCheckoutResponse(BaseModel):
    order_id: str
    order_code: str
    status: str
    final_amount: int
    is_free: bool
    # Payment fields — present only when final_amount > 0 (paid path)
    qr_url: Optional[str] = None
    bank_name: Optional[str] = None
    account_number: Optional[str] = None
    expires_at: Optional[datetime] = None


class FunnelOrderStatusResponse(BaseModel):
    """Public polling endpoint — no PII beyond what the buyer submitted."""

    order_id: str
    status: str
    # Success payload (only set when status == SUCCESS)
    zalo_link: Optional[str] = None
    success_config: Optional[dict] = None
