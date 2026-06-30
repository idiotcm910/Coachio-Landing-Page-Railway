"""Render + send a broadcast campaign batch via Resend. Never raises (worker-safe).

Render order (D13): sanitize_email_html FIRST (once per campaign body), then
render_funnel_tokens per recipient. Token context:
  origin=funnel -> resolve_variables(funnel) + funnel_discount_kwargs + {{name}}, {{email}}
  origin=admin  -> only {{name}}, {{email}}

Idempotency: Resend Batch.SendOptions only supports a single idempotency_key for
the whole batch (not per-email). Fallback used: per-email resend.Emails.send calls
each carrying its own idempotency_key = job.id via the `headers` field
(X-Idempotency-Key is not a standard Resend param; we pass idempotency_key as a
separate tracked field per item and use it in the per-email send path).

Since the Resend Python SDK Batch.send() does not support per-email idempotency_key
in SendParams (confirmed by inspecting SDK source), sending is implemented as a
per-email loop (_send_one) calling resend.Emails.send once per item with
idempotency_key passed as the options dict, ensuring safe retries. Each email is
sent inside its own try/except so an invalid recipient (e.g. a non-ASCII address)
only fails its own job — it never sinks the rest of the chunk.
"""
import logging
from datetime import datetime, timezone

import resend

from app.core.config import settings
from app.models.broadcast_campaign import BroadcastCampaign
from app.models.broadcast_send_job import BroadcastSendJob
from app.models.funnel import Funnel
from app.services.email_render import sanitize_email_html
from app.services.funnel_variable_resolver import (
    funnel_discount_kwargs,
    render_funnel_tokens,
    resolve_variables,
)

logger = logging.getLogger(__name__)

# Resend batch size limit
RESEND_BATCH_MAX = 100


def build_base_context(db, campaign: BroadcastCampaign) -> tuple[str, dict]:
    """Sanitize the body ONCE and resolve the campaign-level token context.

    Returns (sanitized_html_body, base_context).
    base_context has funnel vars for origin=funnel, empty dict for origin=admin.
    Per-recipient name/email are added in render_for_recipient.
    """
    sanitized_body = sanitize_email_html(campaign.html_body)
    base_ctx: dict[str, str] = {}
    if campaign.origin == "funnel" and campaign.funnel_id:
        funnel = db.query(Funnel).filter(Funnel.id == campaign.funnel_id).first()
        if funnel is not None:
            base_ctx = resolve_variables(funnel, **funnel_discount_kwargs(db, funnel))
    return sanitized_body, base_ctx


def render_for_recipient(
    sanitized_body: str,
    subject_tpl: str,
    base_ctx: dict,
    *,
    name: str | None,
    email: str,
) -> tuple[str, str]:
    """Return (subject, html) for one recipient via token substitution only.

    The body is already sanitized (D13 order). This step only substitutes tokens.
    """
    ctx = dict(base_ctx)
    ctx["name"] = name or ""
    ctx["email"] = email
    html = render_funnel_tokens(sanitized_body, ctx)
    subject = render_funnel_tokens(subject_tpl, ctx)
    return subject, html


def _send_one(item: dict) -> None:
    """Send a SINGLE email item via Resend, carrying its own idempotency_key.

    Per-email (not per-batch) so one bad recipient cannot fail the whole chunk:
    Resend rejects an invalid `to` (e.g. a non-ASCII address) per request, and
    the caller isolates that failure to the offending job only. idempotency_key
    = job.id makes retries (Resend "Resend failed") safe against duplicates.

    Raises on any transport/validation error — caller catches per email.
    """
    idempotency_key = item.pop("idempotency_key", None)
    options: dict = {}
    if idempotency_key:
        options["idempotency_key"] = idempotency_key
    resend.Emails.send(item, options if options else None)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def send_pending_batch(
    db,
    campaign: BroadcastCampaign,
    jobs: list[BroadcastSendJob],
) -> None:
    """Render + send jobs via Resend, one email at a time. Updates job/campaign state.

    Never raises — designed to run inside a worker loop without crashing it.
    Failures are isolated PER EMAIL: an invalid recipient (e.g. a non-ASCII
    address) only fails its own job — the rest of the chunk still send. The
    offending job becomes 'failed' (attempts incremented, job.error set); valid
    jobs become 'sent' with sent_at populated. campaign.last_error holds the most
    recent per-email error, if any. Commits once per chunk for throughput.
    """
    if not jobs:
        return

    sanitized_body, base_ctx = build_base_context(db, campaign)
    resend.api_key = settings.RESEND_API_KEY

    for start in range(0, len(jobs), RESEND_BATCH_MAX):
        chunk = jobs[start : start + RESEND_BATCH_MAX]
        for job in chunk:
            subject, html = render_for_recipient(
                sanitized_body,
                campaign.subject,
                base_ctx,
                name=job.name,
                email=job.email,
            )
            item = {
                "from": settings.RESEND_FROM_EMAIL,
                "to": [job.email],
                "subject": subject,
                "html": html,
                "idempotency_key": job.id,
            }
            job.attempts = (job.attempts or 0) + 1
            try:
                _send_one(item)
            except Exception as exc:  # noqa: BLE001 — one bad email must not stop the rest
                msg = str(exc)[:1000]
                logger.error(
                    "Broadcast email failed (campaign=%s job=%s email=%s): %s",
                    campaign.id,
                    job.id,
                    job.email,
                    msg,
                )
                job.status = "failed"
                job.error = msg
                campaign.last_error = msg
            else:
                job.status = "sent"
                job.sent_at = _now()
                job.error = None
        db.commit()
