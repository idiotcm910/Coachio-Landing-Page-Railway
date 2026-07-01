"""Funnel checkout & order flow (D3, D4, D7 — tasks 4.1-4.5).

Quote → checkout (lead capture + PENDING order + SePay QR) → webhook/free-path
completion. The free path (final == 0) and the SePay webhook share ONE
idempotent `complete_order` routine keyed on the PENDING→SUCCESS transition so
success side-effects (redemptions, lead conversion, email) run exactly once.
"""
import logging
import random
import re
from datetime import datetime, timedelta, timezone

from fastapi import BackgroundTasks, HTTPException
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models import Discount, Funnel, FunnelOrder, Lead, OrderDiscount
from app.schemas.funnel_checkout import (
    AppliedDiscountInfo,
    FunnelCheckoutRequest,
    FunnelCheckoutResponse,
    FunnelOrderStatusResponse,
    FunnelQuoteResponse,
)
from app.services.funnel_discount_engine import QuoteResult, compute_quote, redeem_discounts_atomically
from app.services.funnel_notification_service import (
    send_funnel_receipt_email,
    send_funnel_waiting_payment_email,
    success_payload,
)
from app.services.funnel_variable_resolver import (
    funnel_discount_kwargs,
    render_funnel_tokens,
    resolve_variables,
)
from app.services.meta_capi_service import fire_capi_event, fire_capi_event_bg
from app.services.sepay_qr import ORDER_EXPIRY_MINUTES, build_sepay_qr_url

logger = logging.getLogger(__name__)

_ORDER_CODE_RE = re.compile(r"SEP\d{10}")


class FunnelOrderService:
    @staticmethod
    def generate_unique_order_code(db: Session, max_retries: int = 10) -> str:
        """SEP+10 digits — funnel-only scope; clash check against FunnelOrder only."""
        for _ in range(max_retries):
            code = "SEP" + "".join(str(random.randint(0, 9)) for _ in range(10))
            clash = db.query(FunnelOrder).filter(FunnelOrder.order_code == code).first()
            if not clash:
                return code
        raise HTTPException(status_code=500, detail="Failed to generate unique funnel order code")

    @staticmethod
    def _subtotal(funnel: Funnel) -> int:
        # Price is sourced exclusively from the linked product.
        return funnel.product.base_price if funnel.product else 0

    @staticmethod
    def _render_checkout_config(db: Session, funnel: Funnel) -> dict | None:
        """Resolve funnel `{{tokens}}` inside the checkout custom HTML.

        Mirrors the success-page flow: `checkout_config.custom_html` is admin-authored
        raw HTML; funnel variables (incl. admin custom variables) are substituted here
        so the public checkout page reuses the same tokens as the landing/email editors.
        """
        config = funnel.checkout_config
        if not config:
            return None
        config = dict(config)
        html = config.get("custom_html")
        if isinstance(html, str) and html:
            variables = resolve_variables(funnel, **funnel_discount_kwargs(db, funnel))
            config["custom_html"] = render_funnel_tokens(html, variables)
        return config

    @staticmethod
    def _quote_response(db: Session, funnel: Funnel, quote: QuoteResult) -> FunnelQuoteResponse:
        return FunnelQuoteResponse(
            funnel_id=funnel.id,
            funnel_title=funnel.title,
            currency=funnel.currency or "VND",
            subtotal_amount=quote.subtotal,
            discount_amount=quote.discount_amount,
            total_percent=quote.total_percent,
            final_amount=quote.final_amount,
            is_free=quote.is_free,
            discounts=[
                AppliedDiscountInfo(
                    code=e.code,
                    applied=e.applied,
                    discount_type=e.discount.discount_type if e.discount else None,
                    discount_value=e.discount.discount_value if e.discount else None,
                    applied_percent=e.applied_percent,
                    applied_amount=e.applied_amount,
                    reason=e.reason,
                )
                for e in quote.evaluations
            ],
            checkout_config=FunnelOrderService._render_checkout_config(db, funnel),
        )

    @staticmethod
    def quote(db: Session, funnel: Funnel, codes: list[str]) -> FunnelQuoteResponse:
        """Task 4.1 — server-computed amounts; client only renders them (D11)."""
        quote = compute_quote(db, "funnel", funnel.id, FunnelOrderService._subtotal(funnel), codes)
        return FunnelOrderService._quote_response(db, funnel, quote)

    @staticmethod
    def _upsert_lead(db: Session, funnel: Funnel, request: FunnelCheckoutRequest) -> Lead:
        """Lead is captured/updated at checkout — unique (email, funnel) (D5).

        Status lifecycle (D3): subscribed → lead when the buyer enters checkout.
        Existing 'lead' or higher status is never downgraded.
        """
        email = request.buyer_email.lower().strip()
        lead = (
            db.query(Lead)
            .filter(Lead.email == email, Lead.source_funnel_id == funnel.id)
            .first()
        )
        if lead is None:
            lead = Lead(email=email, source_funnel_id=funnel.id, status="lead")
            db.add(lead)
        else:
            # Upgrade subscribed → lead; 'lead' stays 'lead'
            if lead.status == "subscribed":
                lead.status = "lead"
        lead.name = request.buyer_name
        lead.phone = request.buyer_phone
        db.flush()
        return lead

    @staticmethod
    def checkout(
        db: Session,
        funnel: Funnel,
        request: FunnelCheckoutRequest,
        background_tasks: BackgroundTasks | None = None,
        request_meta: dict | None = None,
    ) -> FunnelCheckoutResponse:
        """Tasks 4.2 + 4.3 — create lead + order; free orders complete inline.

        `request_meta` carries browser signals (client_ip_address, client_user_agent,
        fbp, fbc) for CAPI Advanced Matching on the free-checkout path.
        """
        quote = compute_quote(db, "funnel", funnel.id, FunnelOrderService._subtotal(funnel), request.discount_codes)

        # Reject checkout when an explicitly-requested code is invalid — the UI
        # shows per-code status from the quote endpoint before this point.
        invalid = [e for e in quote.evaluations if not e.applied and e.code in set(request.discount_codes)]
        if invalid:
            reasons = ", ".join(f"{e.code}: {e.reason}" for e in invalid)
            raise HTTPException(status_code=400, detail=f"Invalid discount codes — {reasons}")

        lead = FunnelOrderService._upsert_lead(db, funnel, request)
        meta = request_meta or {}
        order = FunnelOrder(
            funnel_id=funnel.id,
            lead_id=lead.id,
            order_code=FunnelOrderService.generate_unique_order_code(db),
            subtotal_amount=quote.subtotal,
            discount_amount=quote.discount_amount,
            final_amount=quote.final_amount,
            status="PENDING",
            funnel_title=funnel.title,
            funnel_slug=funnel.slug,
            product_name=funnel.product.name if funnel.product else funnel.title,
            buyer_email=request.buyer_email.lower().strip(),
            buyer_full_name=request.buyer_name,
            buyer_phone=request.buyer_phone,
            # Persist browser signals so the webhook-path CAPI event retains attribution (E1)
            fbp=meta.get("fbp") or None,
            fbc=meta.get("fbc") or None,
            client_ip_address=meta.get("client_ip_address") or None,
            client_user_agent=meta.get("client_user_agent") or None,
        )
        db.add(order)
        db.flush()
        for evaluation in quote.applied_discounts:
            db.add(
                OrderDiscount(
                    order_type="funnel",
                    order_id=order.id,
                    discount_id=evaluation.discount.id,
                    applied_percent=evaluation.applied_percent,
                    applied_amount=evaluation.applied_amount,
                )
            )

        if quote.is_free:
            # Free path (D3): straight to SUCCESS, no SePay
            FunnelOrderService.complete_order(db, order, background_tasks=background_tasks, request_meta=request_meta)
            db.commit()
            return FunnelCheckoutResponse(
                order_id=order.id,
                order_code=order.order_code,
                status=order.status,
                final_amount=0,
                is_free=True,
            )

        db.commit()

        # "Waiting for payment" email — keeps the QR/bank details in the buyer's
        # inbox after they leave the payment page. Never block checkout on mail.
        if background_tasks is not None:
            background_tasks.add_task(send_funnel_waiting_payment_email, funnel.id, order.id)
        else:
            send_funnel_waiting_payment_email(funnel.id, order.id)

        expires_at = datetime.now(timezone.utc) + timedelta(minutes=ORDER_EXPIRY_MINUTES)
        return FunnelCheckoutResponse(
            order_id=order.id,
            order_code=order.order_code,
            status=order.status,
            final_amount=order.final_amount,
            is_free=False,
            qr_url=build_sepay_qr_url(order.order_code, order.final_amount),
            bank_name=settings.SEPAY_BANK_NAME,
            account_number=settings.SEPAY_ACCOUNT_NUMBER,
            expires_at=expires_at,
        )

    @staticmethod
    def complete_order(
        db: Session,
        order: FunnelOrder,
        background_tasks: BackgroundTasks | None = None,
        request_meta: dict | None = None,
    ) -> bool:
        """Task 4.4 — idempotent complete-order routine, shared by webhook + free path.

        The conditional UPDATE on status is the idempotency guard: only ONE
        caller wins the PENDING→SUCCESS transition; retries and double webhooks
        match 0 rows and skip side-effects entirely.

        `request_meta` carries optional browser signals (client_ip_address,
        client_user_agent, fbp, fbc) for Meta CAPI Advanced Matching. Absent on
        the webhook path (no browser context) — fine, em/ph still provide good match.
        """
        updated = (
            db.query(FunnelOrder)
            .filter(FunnelOrder.id == order.id, FunnelOrder.status == "PENDING")
            .update(
                {FunnelOrder.status: "SUCCESS", FunnelOrder.paid_at: datetime.now(timezone.utc)},
                synchronize_session=False,
            )
        )
        if updated == 0:
            return False  # already processed

        # Query directly instead of relying on viewonly relationship — ensures newly
        # flushed rows are included even before a commit on the free-checkout path.
        discount_ids = [
            od.discount_id
            for od in db.query(OrderDiscount).filter(
                OrderDiscount.order_type == "funnel", OrderDiscount.order_id == order.id
            ).all()
        ]
        if discount_ids and not redeem_discounts_atomically(db, discount_ids):
            # Limit oversold between quote and completion: keep the order
            # successful (buyer already paid) but log loudly for follow-up.
            logger.error("Discount over-redemption on order %s (ids=%s)", order.order_code, discount_ids)

        if order.lead_id:
            db.query(Lead).filter(Lead.id == order.lead_id, Lead.converted_at.is_(None)).update(
                {Lead.converted_at: datetime.now(timezone.utc)}, synchronize_session=False
            )

        if background_tasks is not None:
            background_tasks.add_task(send_funnel_receipt_email, order.funnel_id, order.id)
        else:
            send_funnel_receipt_email(order.funnel_id, order.id)

        # Meta CAPI: fire conversion event exactly once (inside idempotent guard).
        # E5 — dispatch as a background task (geo lookup adds latency); inline fallback
        # when no background_tasks context (e.g. called from a job/script).
        # paid_at was just set by the UPDATE above; refresh so build_event uses the
        # correct timestamp, and persisted browser-signal columns are visible.
        db.refresh(order)
        if background_tasks is not None:
            # Background path: fire_capi_event_bg opens its own session so the
            # request-scoped `db` can be safely closed before the task runs.
            background_tasks.add_task(fire_capi_event_bg, order.id, request_meta)
        else:
            # Inline fallback (webhook or free-path without BackgroundTasks).
            fire_capi_event(db, order, request_meta=request_meta)

        return True

    @staticmethod
    async def process_webhook(payload: dict, db: Session, background_tasks: BackgroundTasks) -> dict:
        """Task 4.5 — resolve FunnelOrder from SePay payload (code + amount match)."""
        match = _ORDER_CODE_RE.search(payload.get("content") or "")
        if not match:
            return {"status": "ignored", "reason": "no_order_code"}
        order_code = match.group(0)
        order = db.query(FunnelOrder).filter(FunnelOrder.order_code == order_code).first()
        if order is None:
            return {"status": "ignored", "reason": "order_not_found", "order_code": order_code}
        if order.status != "PENDING":
            return {"status": "already_processed", "order_code": order_code}
        amount = int(payload.get("transferAmount") or 0)
        if amount < order.final_amount:
            logger.warning("Funnel webhook underpaid: %s got %s want %s", order_code, amount, order.final_amount)
            return {"status": "amount_mismatch", "order_code": order_code}

        FunnelOrderService.complete_order(db, order, background_tasks=background_tasks)
        db.commit()
        return {"status": "success", "order_code": order_code, "funnel_id": order.funnel_id}

    @staticmethod
    def order_status(db: Session, order: FunnelOrder) -> FunnelOrderStatusResponse:
        """Task 4.6 — public polling endpoint; success payload only on SUCCESS."""
        extra: dict = {}
        if order.status == "SUCCESS":
            funnel = db.query(Funnel).filter(Funnel.id == order.funnel_id).first()
            if funnel:
                extra = success_payload(funnel, db=db)
        return FunnelOrderStatusResponse(order_id=order.id, status=order.status, **extra)
