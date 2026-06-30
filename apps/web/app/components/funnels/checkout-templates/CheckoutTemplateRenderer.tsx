'use client';

import type { FunnelCheckoutTemplate } from '@coachio/api-client';
import { CheckoutSplitHero } from './CheckoutSplitHero';
import { CheckoutHeaderBand } from './CheckoutHeaderBand';
import { CheckoutOrderSidebar } from './CheckoutOrderSidebar';
import { DEFAULT_TEMPLATE, type CheckoutTemplateProps } from './checkout-template-types';

const TEMPLATES: Record<FunnelCheckoutTemplate, (p: CheckoutTemplateProps) => JSX.Element> = {
  'split-hero': CheckoutSplitHero,
  'header-band': CheckoutHeaderBand,
  'order-sidebar': CheckoutOrderSidebar,
};

/** Chọn template theo `config.template`, fallback về mặc định nếu không hợp lệ. */
export function CheckoutTemplateRenderer(props: CheckoutTemplateProps) {
  const id = (props.config.template ?? DEFAULT_TEMPLATE) as FunnelCheckoutTemplate;
  const Template = TEMPLATES[id] ?? TEMPLATES[DEFAULT_TEMPLATE];
  return <Template {...props} />;
}
