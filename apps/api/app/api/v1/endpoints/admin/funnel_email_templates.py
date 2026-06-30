"""Admin funnel email templates — /api/v1/admin/funnels/{id}/email-templates.

Reuses the polymorphic `EmailTemplate` (scope='funnel', owner_id=funnel_id)
and supports: list / upsert / preview / test-send / enable toggle.
Allowed template keys: receipt, waiting_payment.
"""

from datetime import datetime, timezone

import resend
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session

from app.api.v1.endpoints.admin.funnels import get_funnel_or_404
from app.core.config import settings
from app.db.base import get_db
from app.middleware.auth import require_role
from app.models import EmailTemplate
from app.models.admin_user import AdminUser
from app.services.email_render import sanitize_email_html
from app.services.funnel_notification_service import (
    EMAIL_SCOPE,
    RECEIPT_TEMPLATE_KEY,
    WAITING_PAYMENT_TEMPLATE_KEY,
    _DEFAULT_BODY,
    _DEFAULT_SUBJECT,
    _DEFAULT_WAITING_BODY,
    _DEFAULT_WAITING_SUBJECT,
)
from app.services.funnel_variable_resolver import DEFAULT_VARIABLE_KEYS, render_funnel_tokens, resolve_variables
from app.utils.timezone import format_vn

router = APIRouter()

TEMPLATE_KEYS = (RECEIPT_TEMPLATE_KEY, WAITING_PAYMENT_TEMPLATE_KEY)
TEMPLATE_LABELS = {
    RECEIPT_TEMPLATE_KEY: "Thanh toán thành công",
    WAITING_PAYMENT_TEMPLATE_KEY: "Chờ thanh toán (QR)",
}
_TEMPLATE_DEFAULTS = {
    RECEIPT_TEMPLATE_KEY: (_DEFAULT_SUBJECT, _DEFAULT_BODY),
    WAITING_PAYMENT_TEMPLATE_KEY: (_DEFAULT_WAITING_SUBJECT, _DEFAULT_WAITING_BODY),
}

# Order-context variables available in funnel emails on top of the resolver set.
_ORDER_VARS = {
    "buyer_name": "Tên người mua",
    "buyer_email": "Email người mua",
    "order_code": "Mã đơn hàng",
    "amount": "Số tiền",
    "final_price": "Giá sau giảm",
    "currency": "Đơn vị tiền",
    "paid_at": "Thời gian thanh toán",
    "qr_url": "Link ảnh QR thanh toán",
    "bank_name": "Tên ngân hàng",
    "account_number": "Số tài khoản",
    "expires_at": "Thời gian hết hạn đơn",
}
_DEFAULT_VAR_LABELS = {
    "product_name": "Tên sản phẩm",
    "funnel_title": "Tên phễu",
    "price": "Giá sản phẩm",
    "discounted_price": "Giá sau giảm mặc định",
    "discount_percent": "Phần trăm giảm mặc định",
    "checkout_url": "Link checkout",
    "success_url": "Link trang thành công",
    "zalo_link": "Link Zalo",
}

_SAMPLE_ORDER_CTX = {
    "buyer_name": "Nguyễn Văn An",
    "buyer_email": "an.nguyen@gmail.com",
    "order_code": "SEP1234567890",
    "amount": "1.990.000",
    "final_price": "1.990.000",
    "currency": "VND",
    "paid_at": format_vn(datetime.now(timezone.utc)),
    "qr_url": "https://qr.sepay.vn/img?acc=0000000000&bank=MBBank&amount=1990000&des=SEP1234567890",
    "bank_name": "MBBank",
    "account_number": "0000000000",
    "expires_at": format_vn(datetime.now(timezone.utc)),
}


class FunnelEmailTemplateUpsert(BaseModel):
    subject: str = Field(..., max_length=500)
    html_body: str = Field(..., max_length=400_000)
    enabled: bool = True


class FunnelEmailTestSend(FunnelEmailTemplateUpsert):
    to_email: EmailStr


def _variable_metadata(funnel) -> list[dict]:
    items = [{"key": k, "label": _DEFAULT_VAR_LABELS.get(k, k), "group": "funnel"} for k in DEFAULT_VARIABLE_KEYS]
    items += [{"key": k, "label": v, "group": "order"} for k, v in _ORDER_VARS.items()]
    meta = funnel.variables_meta or {}
    items += [
        {
            "key": k,
            "label": (meta.get(k) or {}).get("name") or k,
            "group": "custom",
            "description": (meta.get(k) or {}).get("description") or None,
        }
        for k in (funnel.variables or {})
    ]
    return items


def _get_template(db: Session, funnel_id: str, template_key: str) -> EmailTemplate | None:
    return (
        db.query(EmailTemplate)
        .filter(
            EmailTemplate.scope == EMAIL_SCOPE,
            EmailTemplate.owner_id == funnel_id,
            EmailTemplate.template_key == template_key,
        )
        .first()
    )


def _validate_key(template_key: str) -> None:
    if template_key not in TEMPLATE_KEYS:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Unknown template key")


def _render_sample(funnel, subject: str, html_body: str) -> tuple[str, str]:
    """Sanitize FIRST, resolve variables AFTER — same order as real sends."""
    ctx = resolve_variables(funnel)
    ctx.update(_SAMPLE_ORDER_CTX)
    return (
        render_funnel_tokens(subject, ctx),
        render_funnel_tokens(sanitize_email_html(html_body), ctx),
    )


@router.get("/{funnel_id}/email-templates")
def list_templates(
    funnel_id: str,
    db: Session = Depends(get_db),
    current_user: AdminUser = Depends(require_role("admin")),
):
    funnel = get_funnel_or_404(db, funnel_id)
    items = []
    for key in TEMPLATE_KEYS:
        template = _get_template(db, funnel_id, key)
        default_subject, default_body = _TEMPLATE_DEFAULTS[key]
        items.append(
            {
                "template_key": key,
                "label": TEMPLATE_LABELS[key],
                "enabled": template.enabled if template else True,
                "is_custom": template is not None,
                "subject": template.subject if template else default_subject,
                "html_body": template.html_body if template else default_body,
                "default_subject": default_subject,
                "variables": _variable_metadata(funnel),
                "updated_at": template.updated_at if template else None,
            }
        )
    return items


@router.put("/{funnel_id}/email-templates/{template_key}")
def upsert_template(
    funnel_id: str,
    template_key: str,
    payload: FunnelEmailTemplateUpsert,
    db: Session = Depends(get_db),
    current_user: AdminUser = Depends(require_role("admin")),
):
    _validate_key(template_key)
    get_funnel_or_404(db, funnel_id)
    template = _get_template(db, funnel_id, template_key)
    if template is None:
        template = EmailTemplate(scope=EMAIL_SCOPE, owner_id=funnel_id, template_key=template_key)
        db.add(template)
    template.subject = payload.subject
    template.html_body = payload.html_body
    template.enabled = payload.enabled
    template.updated_by = current_user.id
    db.commit()
    return {"status": "saved", "template_key": template_key}


@router.post("/{funnel_id}/email-templates/{template_key}/preview")
def preview_template(
    funnel_id: str,
    template_key: str,
    payload: FunnelEmailTemplateUpsert,
    db: Session = Depends(get_db),
    current_user: AdminUser = Depends(require_role("admin")),
):
    _validate_key(template_key)
    funnel = get_funnel_or_404(db, funnel_id)
    subject, html = _render_sample(funnel, payload.subject, payload.html_body)
    return {"subject": subject, "html": html}


@router.post("/{funnel_id}/email-templates/{template_key}/test-send")
def test_send_template(
    funnel_id: str,
    template_key: str,
    payload: FunnelEmailTestSend,
    db: Session = Depends(get_db),
    current_user: AdminUser = Depends(require_role("admin")),
):
    _validate_key(template_key)
    funnel = get_funnel_or_404(db, funnel_id)
    subject, html = _render_sample(funnel, payload.subject, payload.html_body)
    resend.Emails.send(
        {
            "from": settings.RESEND_FROM_EMAIL,
            "to": payload.to_email,
            "subject": subject,
            "html": html,
        }
    )
    return {"status": "sent", "to": payload.to_email}
