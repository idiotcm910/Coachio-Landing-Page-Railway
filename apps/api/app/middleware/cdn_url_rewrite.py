"""CDN URL rewrite middleware.

Rewrites legacy Bunny shared CDN host(s) (e.g. ``coachio-prod.b-cdn.net``) to a
custom CNAME host (e.g. ``cdn.coachio.ai``) in outgoing JSON API responses.

Why: some Vietnamese ISPs (FPT) DNS-sinkhole the shared ``*.b-cdn.net`` domain to
``127.0.0.1``, so users on those networks get ``ERR_CONNECTION_REFUSED`` for any
asset served from it. A custom CNAME pointing to the same Bunny pull zone serves
the exact same files but is not sinkholed.

Legacy URLs are stored as full URLs across many tables AND embedded inside JSONB
content (funnel pages, agent skills, etc.). Rewriting at the response layer covers
all of them in one place — no database migration, instantly reversible via config.
New uploads should set ``BUNNY_CDN_URL`` directly to the canonical host so they
never carry the legacy host in the first place.
"""

import logging

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

logger = logging.getLogger(__name__)

# Only rewrite textual JSON payloads; skip binary/streamed media.
_REWRITABLE_CONTENT_TYPES = ("application/json",)


class CDNUrlRewriteMiddleware(BaseHTTPMiddleware):
    """Replace legacy CDN host(s) with the canonical host in JSON response bodies."""

    def __init__(self, app, rewrite_pairs):
        super().__init__(app)
        # Precompute byte-level (from, to) pairs once at startup.
        self._byte_pairs = [
            (src.encode("utf-8"), dst.encode("utf-8")) for src, dst in rewrite_pairs
        ]

    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)

        content_type = response.headers.get("content-type", "")
        if not any(ct in content_type for ct in _REWRITABLE_CONTENT_TYPES):
            return response

        # Drain the (possibly streamed) body so we can rewrite it.
        body = b"".join([chunk async for chunk in response.body_iterator])

        rewritten = body
        for src, dst in self._byte_pairs:
            if src in rewritten:
                rewritten = rewritten.replace(src, dst)

        headers = dict(response.headers)
        if rewritten != body:
            headers["content-length"] = str(len(rewritten))

        return Response(
            content=rewritten,
            status_code=response.status_code,
            headers=headers,
            media_type=response.media_type,
        )
