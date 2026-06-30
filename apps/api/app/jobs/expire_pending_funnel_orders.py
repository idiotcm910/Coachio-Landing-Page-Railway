"""Background job: expire PENDING funnel orders past the SePay payment window.

Registered in main.py via FastAPI lifespan using asyncio periodic task.
Interval is configurable via env var FUNNEL_ORDER_EXPIRY_JOB_INTERVAL_SECONDS (default 300s).
Safe to run concurrently across multiple workers — UPDATE is idempotent on
already-EXPIRED rows.

Usage (main.py lifespan):
    from app.jobs.expire_pending_funnel_orders import start_expiry_job
    asyncio.create_task(start_expiry_job())
"""

import asyncio
import logging
from datetime import datetime, timedelta, timezone

from app.core.config import settings
from app.db.base import SessionLocal
from app.models.funnel_order import FunnelOrder
from app.services.sepay_qr import ORDER_EXPIRY_MINUTES

logger = logging.getLogger(__name__)

_INTERVAL = settings.FUNNEL_ORDER_EXPIRY_JOB_INTERVAL_SECONDS


def expire_funnel_orders_once() -> int:
    """Mark PENDING funnel orders past the SePay window as EXPIRED.

    Uses a bulk UPDATE for efficiency. Returns the count of rows updated.
    """
    db = SessionLocal()
    try:
        cutoff = datetime.now(timezone.utc) - timedelta(minutes=ORDER_EXPIRY_MINUTES)
        updated = (
            db.query(FunnelOrder)
            .filter(FunnelOrder.status == "PENDING", FunnelOrder.created_at <= cutoff)
            .update({FunnelOrder.status: "EXPIRED"}, synchronize_session=False)
        )
        db.commit()
        if updated:
            logger.info("expire_funnel_orders_once: expired=%d", updated)
        return updated
    except Exception as exc:
        db.rollback()
        logger.error("expire_funnel_orders_once error: %s", exc)
        return 0
    finally:
        db.close()


async def start_expiry_job() -> None:
    """Async loop — call from FastAPI lifespan to run in background.

    Shutdown handled via asyncio.CancelledError raised when the task is
    cancelled in lifespan shutdown.
    """
    logger.info("Funnel order expiry job started (interval=%ds)", _INTERVAL)
    try:
        while True:
            try:
                expire_funnel_orders_once()
            except Exception as exc:
                logger.error("Funnel expiry iteration error: %s", exc)
            await asyncio.sleep(_INTERVAL)
    except asyncio.CancelledError:
        logger.info("Funnel order expiry job cancelled")
        raise
