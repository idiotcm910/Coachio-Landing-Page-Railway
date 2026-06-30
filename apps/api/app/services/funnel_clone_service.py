"""One-click funnel clone — server-side deep copy in a single transaction (D6, BR-8).

Copies: funnel config (prices, checkout/success config, Zalo link, custom
variables), landing page (full SEO), all sections, all discounts
(redeemed_count reset to 0), and the funnel's email templates
(scope='funnel'). New slug, status draft.
"""
import uuid

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models import DiscountDefaultActivation, EmailTemplate, Funnel, FunnelLandingPage, FunnelSection
from app.services.funnel_notification_service import EMAIL_SCOPE


def clone_funnel(db: Session, source: Funnel, new_slug: str, new_title: str | None, admin_id: str) -> Funnel:
    if db.query(Funnel).filter(Funnel.slug == new_slug).first() is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Slug already in use")

    clone = Funnel(
        id=str(uuid.uuid4()),
        product_id=source.product_id,
        title=new_title or f"{source.title} (copy)",
        slug=new_slug,
        status="draft",  # clone is never auto-published (and thus never cached, D16)
        currency=source.currency,
        checkout_config=source.checkout_config,
        success_config=source.success_config,
        zalo_link=source.zalo_link,
        variables=dict(source.variables) if source.variables else None,
        # tracking_config intentionally NOT copied: each funnel owns its own pixel/token (D-clone)
        tracking_config=None,
        created_by=admin_id,
    )
    db.add(clone)
    db.flush()

    source_landing = source.landing_page
    landing = FunnelLandingPage(
        id=str(uuid.uuid4()),
        funnel_id=clone.id,
        **{
            column: getattr(source_landing, column)
            for column in (
                "seo_title", "seo_description", "seo_keywords", "canonical_url",
                "robots_index", "robots_follow", "og_title", "og_description",
                "og_image_url", "og_type", "twitter_card", "twitter_title",
                "twitter_description", "twitter_image_url", "favicon_url",
                "theme_config", "settings",
            )
        } if source_landing else {},
    )
    db.add(landing)

    if source_landing:
        for section in source_landing.sections:
            db.add(
                FunnelSection(
                    id=str(uuid.uuid4()),
                    landing_page_id=landing.id,
                    name=section.name,
                    html=section.html,
                    theme_mode=section.theme_mode,
                    section_type=section.section_type,
                    anchor=section.anchor,
                    responsive_config=section.responsive_config,
                    sort_order=section.sort_order,
                    is_visible=section.is_visible,
                )
            )

    # Discounts are global now (not funnel-owned) — don't copy them. Instead copy
    # the source funnel's default-discount activations so the clone auto-applies
    # the same default discounts.
    for activation in db.query(DiscountDefaultActivation).filter(
        DiscountDefaultActivation.owner_type == "funnel",
        DiscountDefaultActivation.owner_id == source.id,
    ):
        db.add(
            DiscountDefaultActivation(
                id=str(uuid.uuid4()),
                discount_id=activation.discount_id,
                owner_type="funnel",
                owner_id=clone.id,
            )
        )

    for template in db.query(EmailTemplate).filter(
        EmailTemplate.scope == EMAIL_SCOPE, EmailTemplate.owner_id == source.id
    ):
        db.add(
            EmailTemplate(
                scope=EMAIL_SCOPE,
                owner_id=clone.id,
                template_key=template.template_key,
                enabled=template.enabled,
                subject=template.subject,
                html_body=template.html_body,
                updated_by=admin_id,
            )
        )

    db.commit()
    db.refresh(clone)
    return clone
