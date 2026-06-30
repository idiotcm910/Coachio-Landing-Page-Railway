"""SePay payment webhook — funnel orders only.

Route: POST /sepay-payment  (router included with prefix="/hooks" → /api/v1/hooks/sepay-payment)

Routing:
  1. Extract SEP<10-digit> order_code from payload.content.
  2. Lookup FunnelOrder by order_code → call FunnelOrderService.process_webhook.
  3. Any non-matching payload returns success (no-op) to prevent SePay retries.

Credit-package and course-order routing intentionally excluded — not part of this service.
"""
import logging
import re

from fastapi import APIRouter, BackgroundTasks, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.base import get_db
from app.models.funnel_order import FunnelOrder
from app.services.funnel_order_service import FunnelOrderService

logger = logging.getLogger(__name__)

router = APIRouter()

# SEP + exactly 10 digits — canonical funnel order_code format
_ORDER_CODE_RE = re.compile(r"SEP\d{10}")


class SepayWebhookPayload(BaseModel):
    gateway: str
    transactionDate: str
    accountNumber: str
    subAccount: str | None = None
    code: str | None = None
    content: str
    transferType: str
    description: str
    transferAmount: float
    referenceCode: str
    accumulated: float | None = None
    id: int


@router.post("/sepay-payment")
async def sepay_payment_webhook(
    payload: SepayWebhookPayload,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """Process SePay payment notification for funnel orders.

    Returns success regardless of match so SePay does not retry on non-funnel payments.
    """
    logger.info("SePay webhook received: transferAmount=%s referenceCode=%s", payload.transferAmount, payload.referenceCode)
    match = _ORDER_CODE_RE.search(payload.content or "")
    if match:
        order_code = match.group(0)
        funnel_order = db.query(FunnelOrder).filter(FunnelOrder.order_code == order_code).first()
        if funnel_order:
            return await FunnelOrderService.process_webhook(
                payload=payload.model_dump(),
                db=db,
                background_tasks=background_tasks,
            )
        logger.warning("SePay webhook: order_code=%s not found as FunnelOrder", order_code)

    return {"success": True}
