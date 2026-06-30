"""Shared SePay/VietQR helpers for funnel orders.

Extracted so both the order service (builds the checkout QR) and the
notification service (embeds the QR in the "waiting for payment" email) can
reuse the same URL builder without importing each other (circular import).
"""
from urllib.parse import quote as url_quote

from app.core.config import settings

# A PENDING funnel order is valid for this many minutes before it expires.
ORDER_EXPIRY_MINUTES = 15


def build_sepay_qr_url(order_code: str, amount: int) -> str:
    """VietQR image URL for a SePay transfer (order_code as the transfer content)."""
    bank = settings.SEPAY_BANK_NAME
    account = settings.SEPAY_ACCOUNT_NUMBER
    content = url_quote(order_code, safe="")
    return f"https://qr.sepay.vn/img?acc={account}&bank={bank}&amount={amount}&des={content}"
