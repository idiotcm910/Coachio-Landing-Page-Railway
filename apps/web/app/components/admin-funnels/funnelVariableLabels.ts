import type { VariableMeta } from '@coachio/api-client';
import type { InsertVariable } from '../shared/variables/insert-variable-modal';

/**
 * English labels for funnel merge variables, keyed by variable key. Shared by the
 * funnel email editor and the funnel checkout editor so both surface the same
 * human-readable names. Falls back to the API label, then the key itself.
 */
export const FUNNEL_VARIABLE_LABELS_EN: Record<string, string> = {
  // Funnel & product
  product_name: 'Product name',
  funnel_title: 'Funnel name',
  price: 'Product price',
  discounted_price: 'Default discounted price',
  discount_percent: 'Default discount %',
  checkout_url: 'Checkout link',
  success_url: 'Success page link',
  zalo_link: 'Zalo link',
  // Order & customer
  buyer_name: 'Buyer name',
  buyer_email: 'Buyer email',
  order_code: 'Order code',
  amount: 'Amount',
  final_price: 'Final price',
  currency: 'Currency',
  paid_at: 'Paid at',
  qr_url: 'Payment QR image link',
  bank_name: 'Bank name',
  account_number: 'Account number',
  expires_at: 'Order expires at',
  login_email: 'Login email',
  login_password: 'Temporary password',
  login_url: 'Login link',
};

/** English label for a funnel variable key, falling back to apiLabel then key. */
export function labelForFunnelVariable(key: string, apiLabel?: string): string {
  return FUNNEL_VARIABLE_LABELS_EN[key] ?? apiLabel ?? key;
}

/**
 * Funnel-level variable keys available inside the CHECKOUT custom HTML.
 * The checkout page is rendered BEFORE an order exists, so only funnel/product
 * variables resolve (no buyer/order/payment context). Mirrors the backend
 * `resolve_variables(funnel)` set used by funnel_order_service when rendering
 * `checkout_config.custom_html`.
 */
export const FUNNEL_CHECKOUT_VARIABLE_KEYS = [
  'product_name',
  'funnel_title',
  'price',
  'discounted_price',
  'discount_percent',
  'checkout_url',
  'success_url',
  'zalo_link',
] as const;

/**
 * Build the variable list shown in the checkout Insert-variable modal:
 * the funnel/product set + the admin's own custom funnel variables.
 *
 * Custom variables surface their admin-authored name/description (from
 * variables_meta) and fall back to the raw key when none is set.
 */
export function buildCheckoutVariables(
  customVariables?: Record<string, string> | null,
  variablesMeta?: Record<string, VariableMeta> | null,
): InsertVariable[] {
  const funnel: InsertVariable[] = FUNNEL_CHECKOUT_VARIABLE_KEYS.map((key) => ({
    key,
    label: FUNNEL_VARIABLE_LABELS_EN[key] ?? key,
    group: 'funnel',
  }));
  const custom: InsertVariable[] = Object.keys(customVariables ?? {}).map((key) => {
    const meta = variablesMeta?.[key];
    return {
      key,
      label: meta?.name?.trim() || key,
      group: 'custom',
      description: meta?.description?.trim() || null,
    };
  });
  return [...funnel, ...custom];
}
