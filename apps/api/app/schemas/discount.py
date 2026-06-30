"""Pydantic schemas for global stackable Discount admin CRUD."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

DISCOUNT_TYPES = {"percent", "fixed"}


class DiscountBase(BaseModel):
    code: str = Field(..., min_length=1, max_length=80)
    discount_type: str = Field(..., max_length=20)
    discount_value: int = Field(..., gt=0)
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None
    max_redemptions: Optional[int] = Field(None, gt=0)
    is_active: bool = True

    @field_validator("discount_type")
    @classmethod
    def validate_type(cls, v: str) -> str:
        if v not in DISCOUNT_TYPES:
            raise ValueError(f"discount_type must be one of {sorted(DISCOUNT_TYPES)}")
        return v

    @field_validator("code")
    @classmethod
    def normalize_code(cls, v: str) -> str:
        return v.strip().upper()

    @model_validator(mode="after")
    def validate_value_and_window(self):
        if self.discount_type == "percent" and self.discount_value > 100:
            raise ValueError("percent discount_value must be <= 100")
        if self.starts_at and self.ends_at and self.ends_at <= self.starts_at:
            raise ValueError("ends_at must be after starts_at")
        return self


class DiscountDefaultActivationInput(BaseModel):
    """Body for POST/DELETE /admin/discounts/{id}/default."""
    owner_type: str = Field(..., pattern="^(funnel|course)$")
    owner_id: str = Field(..., min_length=1)


class DiscountScopeInput(BaseModel):
    """One owner entry of a discount's applicability scope (allow-list)."""
    owner_type: str = Field(..., pattern="^(funnel|course)$")
    owner_id: str = Field(..., min_length=1)


class DiscountCreate(DiscountBase):
    """Create a discount.

    `defaults` lets the admin assign the new code as a default for one or more
    funnels/courses in the SAME request, so it's a one-step flow (create + assign).
    `scopes` restricts where the code can be used (EMPTY = global / usable anywhere).
    """
    defaults: list[DiscountDefaultActivationInput] = Field(default_factory=list)
    scopes: list[DiscountScopeInput] = Field(default_factory=list)


class DiscountUpdate(BaseModel):
    code: Optional[str] = Field(None, min_length=1, max_length=80)
    discount_type: Optional[str] = Field(None, max_length=20)
    discount_value: Optional[int] = Field(None, gt=0)
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None
    max_redemptions: Optional[int] = Field(None, gt=0)
    is_active: Optional[bool] = None
    # When provided, REPLACES the discount's applicability scope wholesale.
    # None = leave scope unchanged; [] = clear scope (make global).
    scopes: Optional[list[DiscountScopeInput]] = None

    @field_validator("discount_type")
    @classmethod
    def validate_type(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in DISCOUNT_TYPES:
            raise ValueError(f"discount_type must be one of {sorted(DISCOUNT_TYPES)}")
        return v

    @field_validator("code")
    @classmethod
    def normalize_code(cls, v: Optional[str]) -> Optional[str]:
        return v.strip().upper() if v is not None else None


class DiscountRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    code: str
    discount_type: str
    discount_value: int
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None
    max_redemptions: Optional[int] = None
    redeemed_count: int
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime] = None
    # Optional: whether this discount is a default for the queried owner (annotated at query time)
    is_default_for_owner: Optional[bool] = None
    # Applicability scope (allow-list). Empty list = global (usable anywhere).
    scopes: list["DiscountScopeOwner"] = Field(default_factory=list)


class DiscountListResponse(BaseModel):
    items: list[DiscountRead]
    total: int


class DiscountDefaultOwner(BaseModel):
    """An owner (funnel/course) for which a discount is marked default."""
    owner_type: str
    owner_id: str
    owner_name: Optional[str] = None


class DiscountScopeOwner(BaseModel):
    """An owner (funnel/course) within a discount's applicability scope."""
    model_config = ConfigDict(from_attributes=True)

    owner_type: str
    owner_id: str
    owner_name: Optional[str] = None


# Resolve the forward reference used in DiscountRead.scopes
DiscountRead.model_rebuild()
