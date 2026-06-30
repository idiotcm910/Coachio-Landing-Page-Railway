import type { VariableRow } from '../shared/variables/VariablesModal';

/**
 * System variable tokens available in funnel LANDING HTML sections.
 * Backend fills these via funnel_landing_service at render time.
 */
export const FUNNEL_LANDING_SYSTEM_VARIABLE_TOKENS: VariableRow[] = [
  { token: '{{product_name}}', label: 'Product name linked to the funnel.' },
  { token: '{{funnel_title}}', label: 'Funnel title.' },
  { token: '{{price}}', label: 'Product price (raw number, from the product).' },
  { token: '{{discounted_price}}', label: 'Price after the default discount is applied (VND-formatted).' },
  { token: '{{discount_percent}}', label: 'Total default discount percent (integer, no % sign — e.g. 30).' },
  { token: '{{checkout_url}}', label: 'URL of the funnel checkout page.' },
  { token: '{{success_url}}', label: 'URL of the thank-you page after payment.' },
  { token: '{{zalo_link}}', label: 'Zalo group link configured for the funnel.' },
];

/**
 * System variable tokens available in funnel SUCCESS (thank-you) page HTML.
 */
export const FUNNEL_SUCCESS_SYSTEM_VARIABLE_TOKENS: VariableRow[] = [
  { token: '{{product_name}}', label: 'Product name linked to the funnel.' },
  { token: '{{funnel_title}}', label: 'Funnel title.' },
  { token: '{{discounted_price}}', label: 'Price after the default discount is applied (VND-formatted).' },
  { token: '{{discount_percent}}', label: 'Total default discount percent (integer, no % sign — e.g. 30).' },
  { token: '{{zalo_link}}', label: 'Zalo group link configured for the funnel.' },
];

/**
 * CTA data-attribute tokens interpreted by the funnel landing iframe runtime
 * (LandingSectionFrame + FunnelLandingClient).
 */
export const FUNNEL_CTA_ATTRIBUTE_TOKENS: VariableRow[] = [
  {
    token: 'data-landing-cta="checkout"',
    label: 'When clicked, navigates to the funnel checkout page.',
    copyValue: 'data-landing-cta="checkout"',
  },
  {
    token: 'data-landing-action="scroll" data-landing-payload="<anchor>"',
    label: 'When clicked, smooth-scrolls to the section with the matching anchor. Set the anchor on each section via the "Anchor" field in the editor.',
    copyValue: 'data-landing-action="scroll" data-landing-payload=""',
  },
];
