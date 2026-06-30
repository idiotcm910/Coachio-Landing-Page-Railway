"""API v1 router — funnel-only (admin + public + webhooks + health)."""

from fastapi import APIRouter

from app.api.v1.endpoints import health as health_endpoint
from app.api.v1.endpoints.admin import auth as admin_auth
from app.api.v1.endpoints.admin import (
    discounts as admin_discounts,
    funnel_analytics as admin_funnel_analytics,
    funnel_email_templates as admin_funnel_email_templates,
    funnel_landings as admin_funnel_landings,
    funnel_orders as admin_funnel_orders,
    funnel_revenue_analytics as admin_funnel_revenue_analytics,
    funnels as admin_funnels,
    leads as admin_leads,
    products as admin_products,
    media_library as admin_media_library,
    funnel_broadcasts as admin_funnel_broadcasts,
    broadcasts as admin_broadcasts,
    gifts as admin_gifts,
    gift_automations as admin_gift_automations,
    gift_campaigns as admin_gift_campaigns,
    gift_grants as admin_gift_grants,
    lucky_events as admin_lucky_events,
    url_redirects as admin_url_redirects,
)
from app.api.v1.endpoints.public import (
    funnels as public_funnels,
    funnel_lead_capture as public_funnel_lead_capture,
    lucky_events as public_lucky_events,
    url_redirects as public_url_redirects,
)
from app.api.v1.endpoints import webhooks as sepay_webhook

api_router = APIRouter()

# --- Health (no auth, no prefix — resolves to /api/v1/health) ---
api_router.include_router(health_endpoint.router, prefix="/health", tags=["Health"])

# --- Admin (require_role admin JWT) ---
api_router.include_router(admin_auth.router, prefix="/admin/auth", tags=["Admin Auth"])
api_router.include_router(admin_products.router, prefix="/admin/products", tags=["Admin Products"])
api_router.include_router(admin_funnels.router, prefix="/admin/funnels", tags=["Admin Funnels"])
api_router.include_router(admin_funnel_landings.router, prefix="/admin/funnels", tags=["Admin Funnel Landings"])
api_router.include_router(admin_funnel_email_templates.router, prefix="/admin/funnels", tags=["Admin Funnel Email Templates"])
api_router.include_router(admin_funnel_analytics.router, prefix="/admin/funnels", tags=["Admin Funnel Analytics"])
api_router.include_router(admin_funnel_broadcasts.router, prefix="/admin/funnels", tags=["Admin Funnel Broadcasts"])
api_router.include_router(admin_funnel_revenue_analytics.router, prefix="/admin/funnel-analytics", tags=["Admin Funnel Revenue Analytics"])
api_router.include_router(admin_funnel_orders.router, prefix="/admin/funnel-orders", tags=["Admin Funnel Orders"])
api_router.include_router(admin_discounts.router, prefix="/admin/discounts", tags=["Admin Discounts"])
api_router.include_router(admin_leads.router, prefix="/admin/leads", tags=["Admin Leads"])
api_router.include_router(admin_media_library.router, prefix="/admin/media", tags=["Media Library"])
api_router.include_router(admin_broadcasts.router, prefix="/admin/broadcasts", tags=["Admin Broadcasts"])
api_router.include_router(admin_gifts.router, prefix="/admin/gifts", tags=["Admin Gifts"])
api_router.include_router(admin_gift_automations.router, prefix="/admin/gift-automations", tags=["Admin Gift Automations"])
api_router.include_router(admin_gift_campaigns.router, prefix="/admin/gift-campaigns", tags=["Admin Gift Campaigns"])
api_router.include_router(admin_gift_grants.router, prefix="/admin/gift-grants", tags=["Admin Gift Grants"])
api_router.include_router(admin_lucky_events.router, prefix="/admin/lucky-events", tags=["Admin Lucky Draw"])
api_router.include_router(admin_url_redirects.router, prefix="/admin/url-redirects", tags=["Admin URL Redirects"])

# --- Public (anonymous / token) ---
api_router.include_router(public_funnels.router, prefix="/public/funnels", tags=["Public Funnels"])
api_router.include_router(public_funnel_lead_capture.router, prefix="/public/funnels", tags=["Public Funnels"])
api_router.include_router(public_lucky_events.router, prefix="/public/lucky-events", tags=["Public Lucky Draw"])
api_router.include_router(public_url_redirects.router, prefix="/public/url-redirects", tags=["Public URL Redirects"])
api_router.include_router(sepay_webhook.router, prefix="/hooks", tags=["Webhooks"])
