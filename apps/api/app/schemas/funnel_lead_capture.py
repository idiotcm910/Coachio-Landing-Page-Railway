"""Pydantic schemas for the public funnel lead-capture endpoint (D1, D5).

Accepts both multipart/form-data and JSON.  Required fields: token + email.
All extra fields are collected into `meta` (utm_*, ip, user_agent, etc.).
"""

from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, model_validator


# Standard meta keys sent by the reference landing page snippet.
# Any key NOT in the known-field set is folded into meta as-is.
_STANDARD_FIELDS = {"token", "email", "name", "phone"}


class LeadCaptureRequest(BaseModel):
    """Payload for POST /public/funnels/leads/capture.

    Extra fields beyond the four standard ones are collected into `meta` via
    the model validator below — covers utm_source/medium/campaign, ip,
    user_agent, platform, screen, referrer, landing, etc.
    """
    model_config = ConfigDict(extra="allow")

    token: str
    email: EmailStr
    name: Optional[str] = None
    phone: Optional[str] = None
    # Populated by the validator from extra kwargs — not sent directly by clients.
    meta: Optional[dict[str, Any]] = None

    @model_validator(mode="before")
    @classmethod
    def collect_extra_meta(cls, values: Any) -> Any:
        if not isinstance(values, dict):
            return values
        extra: dict[str, Any] = {}
        for key, val in values.items():
            if key not in _STANDARD_FIELDS and key != "meta":
                extra[key] = val
        if extra:
            # Merge any explicitly-passed meta dict with the extra fields.
            existing = values.get("meta") or {}
            values["meta"] = {**extra, **existing}
        return values


class LeadCaptureResponse(BaseModel):
    """Simple success response — embedding page checks `ok` to unlock content."""
    ok: bool = True


class FunnelCaptureTokenRead(BaseModel):
    """Admin response: current capture token + the derived capture endpoint URL."""
    funnel_id: str
    capture_token: Optional[str] = None
    # Endpoint URL is derivable client-side; returned here for convenience.
    capture_endpoint: str
