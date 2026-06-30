"""Post-purchase notifications for funnel orders (D7, D15 — BR-6, BR-7).

Email reuses the polymorphic `EmailTemplate` (scope='funnel', owner_id=funnel_id,
template_key='receipt') + nh3 sanitize + the funnel variable resolver. The Zalo
link is a stored funnel field surfaced on the success payload — no automation.

Opens its own DB session (safe inside BackgroundTasks — the request session is
already closed). Failures are logged, never raised (mail must not break the
payment flow).

Scope: receipt + waiting_payment emails only. Buyer identity is resolved from
FunnelOrder (buyer_email / buyer_full_name snapshot) — no User table lookup.
"""
import logging
from datetime import timedelta

import resend

from app.core.config import settings
from app.models import EmailTemplate, Funnel, FunnelOrder
from app.services.email_render import sanitize_email_html
from app.services.funnel_variable_resolver import (
    funnel_discount_kwargs,
    render_funnel_tokens,
    resolve_variables,
)
from app.services.sepay_qr import ORDER_EXPIRY_MINUTES, build_sepay_qr_url
from app.utils.timezone import format_vn

logger = logging.getLogger(__name__)

EMAIL_SCOPE = "funnel"
RECEIPT_TEMPLATE_KEY = "receipt"
WAITING_PAYMENT_TEMPLATE_KEY = "waiting_payment"

# Order-context keys appended to the funnel variable context for emails only
_DEFAULT_SUBJECT = "Thanh toán thành công — {{funnel_title}}"
_DEFAULT_BODY = (
    "<p>Xin chào {{buyer_name}},</p>"
    "<p>Cảm ơn bạn đã mua <strong>{{product_name}}</strong>.</p>"
    "<p>Mã đơn hàng: <strong>{{order_code}}</strong><br>"
    "Số tiền: <strong>{{amount}} {{currency}}</strong></p>"
    "<p>Tham gia nhóm Zalo: <a href=\"{{zalo_link}}\">{{zalo_link}}</a></p>"
)

# "Waiting for payment" email — sent at checkout for PENDING (paid) orders so the
# buyer keeps the VietQR/bank details after leaving the QR page.
_DEFAULT_WAITING_SUBJECT = "Đang chờ thanh toán — {{funnel_title}}"
_DEFAULT_WAITING_BODY = (
    "<p>Xin chào {{buyer_name}},</p>"
    "<p>Cảm ơn bạn đã đặt mua <strong>{{product_name}}</strong>. "
    "Đơn hàng đang chờ thanh toán.</p>"
    "<p>Mã đơn hàng: <strong>{{order_code}}</strong><br>"
    "Số tiền cần thanh toán: <strong>{{amount}} {{currency}}</strong></p>"
    "<p>Quét mã QR để thanh toán:</p>"
    "<p><img src=\"{{qr_url}}\" alt=\"VietQR\" width=\"220\" height=\"220\"></p>"
    "<p>Hoặc chuyển khoản thủ công — Ngân hàng: <strong>{{bank_name}}</strong>, "
    "Số tài khoản: <strong>{{account_number}}</strong>, "
    "Nội dung: <strong>{{order_code}}</strong></p>"
    "<p>Đơn hàng sẽ hết hạn lúc <strong>{{expires_at}}</strong>. "
    "Sau khi thanh toán thành công bạn sẽ nhận được email xác nhận.</p>"
)


def _email_context(db, funnel: Funnel, order: FunnelOrder) -> dict[str, str]:
    # Funnel-level default-discount price (no user codes) for the {{discounted_price}}
    # / {{discount_percent}} template variables; order-scoped paid amount stays below.
    ctx = resolve_variables(funnel, **funnel_discount_kwargs(db, funnel))
    # Order-scoped vars (not landing template variables). `currency`/`amount`/`final_price`
    # are added here so the receipt email body keeps working after they were dropped from
    # the landing default-variable whitelist.
    # Timestamps are stored in UTC — render in VN local time (giờ Việt Nam) for buyers.
    expires_at = (
        format_vn(order.created_at + timedelta(minutes=ORDER_EXPIRY_MINUTES))
        if order.created_at
        else ""
    )
    ctx.update(
        {
            "buyer_name": order.buyer_full_name or order.buyer_email,
            "buyer_email": order.buyer_email,
            "order_code": order.order_code,
            "amount": f"{order.final_amount:,}".replace(",", "."),
            "final_price": f"{order.final_amount:,}".replace(",", "."),
            "currency": funnel.currency or "VND",
            "paid_at": format_vn(order.paid_at) if order.paid_at else "",
            # Payment-context vars — used by the "waiting for payment" email (harmless
            # extra keys for the receipt email, which simply doesn't reference them).
            "qr_url": build_sepay_qr_url(order.order_code, order.final_amount),
            "bank_name": settings.SEPAY_BANK_NAME,
            "account_number": settings.SEPAY_ACCOUNT_NUMBER,
            "expires_at": expires_at,
        }
    )
    return ctx


def _send_funnel_email(
    funnel_id: str,
    order_id: str,
    template_key: str,
    default_subject: str,
    default_body: str,
    only_if_pending: bool = False,
    extra_ctx: dict[str, str] | None = None,
) -> None:
    """Shared render+send for funnel order emails (receipt + waiting-payment).

    Resolves the admin-customized `EmailTemplate` (or the built-in default),
    sanitizes (D13: sanitize FIRST, resolve variables AFTER), and sends via
    Resend. Failures are logged, never raised — mail must not break the payment
    flow. `only_if_pending` skips the send when the order is no longer PENDING
    (the waiting-payment email is pointless once the buyer has paid).
    `extra_ctx` adds non-persisted tokens to the context.
    """
    from app.db.base import SessionLocal

    db = SessionLocal()
    try:
        funnel = db.query(Funnel).filter(Funnel.id == funnel_id).first()
        order = db.query(FunnelOrder).filter(FunnelOrder.id == order_id).first()
        if not funnel or not order:
            return
        if only_if_pending and order.status != "PENDING":
            return

        template = (
            db.query(EmailTemplate)
            .filter(
                EmailTemplate.scope == EMAIL_SCOPE,
                EmailTemplate.owner_id == funnel_id,
                EmailTemplate.template_key == template_key,
            )
            .first()
        )
        if template is not None and not template.enabled:
            return  # admin explicitly disabled this email
        subject_tpl = template.subject if template else default_subject
        body_tpl = template.html_body if template else default_body

        ctx = _email_context(db, funnel, order)
        if extra_ctx:
            ctx.update(extra_ctx)
        # Sanitize FIRST, resolve variables AFTER (D13 ordering)
        html = render_funnel_tokens(sanitize_email_html(body_tpl), ctx)
        subject = render_funnel_tokens(subject_tpl, ctx)

        resend.Emails.send(
            {
                "from": settings.RESEND_FROM_EMAIL,
                "to": order.buyer_email,
                "subject": subject,
                "html": html,
            }
        )
    except Exception as exc:  # noqa: BLE001 - mail must never break the payment flow
        logger.error("Funnel email failed (key=%s order=%s): %s", template_key, order_id, exc)
    finally:
        db.close()


def send_funnel_receipt_email(funnel_id: str, order_id: str) -> None:
    """Render + send the success email for a completed funnel order (task 5.1)."""
    _send_funnel_email(funnel_id, order_id, RECEIPT_TEMPLATE_KEY, _DEFAULT_SUBJECT, _DEFAULT_BODY)


def send_funnel_waiting_payment_email(funnel_id: str, order_id: str) -> None:
    """Send the "waiting for payment" email for a freshly-created PENDING order."""
    _send_funnel_email(
        funnel_id,
        order_id,
        WAITING_PAYMENT_TEMPLATE_KEY,
        _DEFAULT_WAITING_SUBJECT,
        _DEFAULT_WAITING_BODY,
        only_if_pending=True,
    )


def success_payload(funnel: Funnel, extra_ctx: dict[str, str] | None = None, db=None) -> dict:
    """Success-page payload — Zalo connect link + admin custom thank-you HTML.

    `success_config.html` is admin-authored raw HTML that REPLACES the whole
    thank-you page (rendered inside an isolated iframe on the client, mirroring
    the landing builder). Funnel `{{tokens}}` are resolved here so the page can
    reuse the same variables as the landing editor. No nh3 sanitize — length is
    capped on save and the public page isolates it in a srcdoc iframe.

    `extra_ctx` carries order-scoped variables so the thank-you HTML can reference
    them; these are never part of the cached landing payload.
    """
    config = dict(funnel.success_config or {})
    html = config.get("html")
    if isinstance(html, str) and html:
        variables = resolve_variables(funnel, **funnel_discount_kwargs(db, funnel))
        if extra_ctx:
            variables.update(extra_ctx)
        config["html"] = render_funnel_tokens(html, variables)
    return {
        "zalo_link": funnel.zalo_link,
        "success_config": config or None,
    }
