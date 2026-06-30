"""Render + sanitize gift emails.

Security mirrors the funnel email path: nh3 sanitize the admin HTML FIRST, then
substitute whitelisted ``{{key}}`` tokens. Per spec, unknown/unavailable tokens
render EMPTY (funnel-style), so a `{{password}}` on an external-only gift or an
existing account simply disappears.
"""
import html as _html
import re

from app.services.email_render import sanitize_email_html

_SAFE_URL_SCHEMES = ("http://", "https://", "mailto:")

# Tokens available in the gift (delivery) email. Account credentials are sent in
# a SEPARATE system account email, so the gift email only carries the recipient
# name and the AI-Skills auto-login button.
GIFT_VARS: dict[str, dict] = {
    "recipient_name": {
        "label": "Recipient name",
        "description": "The recipient's name (falls back to their email).",
    },
    "account_access": {
        "label": "AI Skills access button",
        "description": (
            "Auto-login button to the 500 AI Skills — includes a one-time access token so one "
            "click logs the recipient in. Renders only when a selected gift unlocks skills."
        ),
    },
}

_TOKEN_RE = re.compile(r"{{\s*(\w+)\s*}}")


def variable_metadata() -> list[dict]:
    """Variable palette (key + label + description) for the FE gift email editor."""
    return [
        {"key": k, "label": v["label"], "description": v["description"]} for k, v in GIFT_VARS.items()
    ]


def render_gift_text(text: str | None, ctx: dict) -> str:
    """Substitute ``{{key}}`` with ctx[key]; unknown/missing tokens render empty."""
    if not text:
        return text or ""

    def _repl(match: "re.Match") -> str:
        val = ctx.get(match.group(1))
        return "" if val is None else str(val)

    return _TOKEN_RE.sub(_repl, text)


def render_gift_html(html: str | None, ctx: dict) -> str:
    """Sanitize FIRST, then substitute tokens (D13 ordering)."""
    return render_gift_text(sanitize_email_html(html), ctx)


def render_external_items_html(items: list | None) -> str:
    """Render the external items as a simple, email-safe list block."""
    if not items:
        return ""
    rows = []
    for it in items:
        if not isinstance(it, dict):
            continue
        # Escape all text and restrict the href scheme — these values are injected
        # AFTER the template is sanitized, so they must be made email-safe here.
        raw_url = str(it.get("url") or "")
        safe_url = raw_url if raw_url.lower().startswith(_SAFE_URL_SCHEMES) else "#"
        url = _html.escape(safe_url, quote=True)
        label = _html.escape(str(it.get("label") or it.get("url") or ""))
        desc = _html.escape(str(it.get("description") or ""))
        desc_html = f'<br><span style="color:#666;font-size:13px">{desc}</span>' if desc else ""
        rows.append(
            f'<li style="margin:8px 0"><a href="{url}" '
            f'style="color:#6d28d9;font-weight:600">{label}</a>{desc_html}</li>'
        )
    return f'<ul style="padding-left:20px;margin:12px 0">{"".join(rows)}</ul>' if rows else ""
