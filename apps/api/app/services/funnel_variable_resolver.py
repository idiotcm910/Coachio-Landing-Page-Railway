"""Funnel template-variable resolver (D13 — fixed v1 default set, Option A).

Resolved context = fixed default variables (same for ALL product types in v1)
merged with the funnel's admin-defined custom variables. Default keys are
reserved — custom variables can never override them (`checkout_url` etc. stay
trustworthy). `{{key}}` substitution is whitelist-only; unknown tokens render
EMPTY (per sales-funnel spec — differs from course email_render which keeps
unknown tokens verbatim).

v2 can append product-type-specific keys inside `get_default_variables`
without changing the substitution engine.
"""

import logging
import re

from app.core.config import settings
from app.models import Funnel

# Fixed v1 default-variable whitelist (D13) — keep in sync with
# app/schemas/funnel.py DEFAULT_VARIABLE_KEYS.
DEFAULT_VARIABLE_KEYS = (
    "product_name",
    "funnel_title",
    "price",
    "discounted_price",
    "discount_percent",
    "checkout_url",
    "success_url",
    "zalo_link",
)

_TOKEN_RE = re.compile(r"{{\s*(\w+)\s*}}")


def _format_vnd(amount: int | None) -> str:
    """1000000 → '1.000.000' (VND grouping, no unit suffix)."""
    return f"{amount or 0:,}".replace(",", ".")


def _frontend_base() -> str:
    return (settings.FRONTEND_URL or "").rstrip("/")


def get_default_variables(
    funnel: Funnel,
    *,
    discounted_price: int | None = None,
    discount_percent: int | None = None,
) -> dict[str, str]:
    """Resolve the FIXED v1 default set for a funnel (same for all product types).

    Price comes exclusively from the linked product (`product.base_price`);
    funnels no longer carry their own price. `final_price`/`original_price`/
    `currency` are no longer template variables.

    `discounted_price`/`discount_percent` are computed at call sites that hold a
    DB session (via the funnel discount engine, default discounts only). When not
    provided they fall back to the base price / `0` (no discount context) so the
    resolver never needs DB access of its own.
    """
    price = funnel.product.base_price if funnel.product else 0
    base = _frontend_base()
    return {
        "product_name": funnel.product.name if funnel.product else "",
        "funnel_title": funnel.title or "",
        "price": _format_vnd(price),
        "discounted_price": _format_vnd(
            discounted_price if discounted_price is not None else price
        ),
        "discount_percent": str(discount_percent or 0),
        "checkout_url": f"{base}/funnels/{funnel.slug}/checkout",
        "success_url": f"{base}/funnels/{funnel.slug}/success",
        "zalo_link": funnel.zalo_link or "",
    }


def resolve_variables(
    funnel: Funnel,
    *,
    discounted_price: int | None = None,
    discount_percent: int | None = None,
) -> dict[str, str]:
    """Defaults merged with funnel custom variables; reserved keys win."""
    resolved = {str(k): str(v) for k, v in (funnel.variables or {}).items()}
    resolved.update(
        get_default_variables(
            funnel, discounted_price=discounted_price, discount_percent=discount_percent
        )
    )
    return resolved


def funnel_discount_kwargs(db, funnel: Funnel) -> dict[str, int]:
    """{discounted_price, discount_percent} for a funnel's default stackable discount.

    Base = product.base_price. Returns {} when db is None or on any failure so
    email/success rendering is never blocked by a discount-calc error (best-effort).
    """
    if db is None:
        return {}
    try:
        from app.services.funnel_discount_engine import default_discounted

        base_price = funnel.product.base_price if funnel.product else 0
        final_amount, total_percent = default_discounted(
            db, "funnel", funnel.id, base_price
        )
        return {"discounted_price": final_amount, "discount_percent": total_percent}
    except Exception:  # noqa: BLE001 - discounted_price is best-effort, never fatal
        logging.getLogger(__name__).warning(
            "funnel discounted_price calc failed (funnel=%s)", funnel.id
        )
        return {}


def render_funnel_tokens(text: str | None, variables: dict[str, str]) -> str:
    """Substitute `{{key}}` from the resolved context; unknown token → empty.

    Apply AFTER sanitize (nh3 for email; landing HTML stays length-validated
    like the course builder) so substituted values can't smuggle markup past
    the sanitizer check order defined in D13.
    """
    if not text:
        return text or ""

    def _repl(match: "re.Match") -> str:
        return variables.get(match.group(1), "")

    return _TOKEN_RE.sub(_repl, text)
