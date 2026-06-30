/** Types for the product sales funnel feature (public + admin). */

// ─── Entities ────────────────────────────────────────────────────────────────

export type ProductStatus = 'draft' | 'active' | 'archived';
export type FunnelStatus = 'draft' | 'published' | 'archived';
export type DiscountType = 'percent' | 'fixed';

export interface Product {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  base_price: number;
  type: string;
  status: ProductStatus;
  thumbnail_url?: string | null;
  source_id?: string | null;
  created_at: string;
  updated_at?: string | null;
}

/**
 * Per-funnel Meta tracking config (Pixel + Conversions API).
 * Stored in `funnel.tracking_config`. The CAPI token is a secret: it is only
 * returned on admin reads (masked/write-only where feasible) and NEVER in any
 * public endpoint.
 */
export interface FunnelTrackingConfig {
  /** Meta Pixel / Dataset ID (used by the browser Pixel + CAPI endpoint). */
  meta_pixel_id?: string | null;
  /** Conversions API access token (secret — server-side only). */
  meta_capi_token?: string | null;
  /** Optional Meta Test Events code; routes events to the Test Events tool. */
  meta_test_event_code?: string | null;
  /** Master on/off switch for this funnel's tracking. */
  enabled?: boolean;
}

/**
 * Non-secret view of the global Meta tracking defaults (from server env).
 * Used by the admin tracking workspace to indicate whether a funnel reports to
 * the global default dataset or a custom override. Never carries the token value.
 */
export interface FunnelTrackingDefaults {
  /** True when both a default Pixel ID and CAPI token are configured on the server. */
  configured: boolean;
  /** The default Pixel/Dataset ID (non-secret), if any. */
  meta_pixel_id?: string | null;
  /** Whether a default CAPI token is configured (the value is never exposed). */
  has_capi_token: boolean;
  /** Whether a default test event code is configured. */
  has_test_event_code: boolean;
}

/** Supported custom-variable types. */
export type VariableType = 'text' | 'number' | 'date' | 'time' | 'datetime';

/** Per-variable metadata (name label, description, type). */
export interface VariableMeta {
  name?: string;
  description?: string;
  type: VariableType;
}

export interface Funnel {
  id: string;
  product_id: string;
  title: string;
  slug: string;
  status: FunnelStatus;
  currency: string;
  checkout_config?: Record<string, unknown> | null;
  success_config?: Record<string, unknown> | null;
  zalo_link?: string | null;
  variables?: Record<string, string> | null;
  variables_meta?: Record<string, VariableMeta> | null;
  tracking_config?: FunnelTrackingConfig | null;
  published_at?: string | null;
  created_at: string;
  updated_at?: string | null;
}

export interface FunnelSeo {
  seo_title?: string | null;
  seo_description?: string | null;
  seo_keywords?: string | null;
  canonical_url?: string | null;
  robots_index: boolean;
  robots_follow: boolean;
  og_title?: string | null;
  og_description?: string | null;
  og_image_url?: string | null;
  og_type?: string | null;
  twitter_card?: string | null;
  twitter_title?: string | null;
  twitter_description?: string | null;
  twitter_image_url?: string | null;
  favicon_url?: string | null;
}

export interface FunnelLanding extends FunnelSeo {
  id: string;
  funnel_id: string;
  theme_config?: Record<string, unknown> | null;
  settings?: Record<string, unknown> | null;
}

export interface FunnelSection {
  id: string;
  landing_page_id: string;
  name: string;
  html: string;
  theme_mode: string;
  section_type: string;
  responsive_config?: Record<string, unknown> | null;
  sort_order: number;
  is_visible: boolean;
  /** Optional in-page anchor used by `data-landing-action="scroll"` CTAs. */
  anchor?: string | null;
}

/** A scope entry restricting a discount to a specific funnel or course. */
export interface DiscountScopeOwner {
  owner_type: 'funnel' | 'course';
  owner_id: string;
  /** Resolved name; may be null if the owner was deleted. */
  owner_name?: string | null;
}

export interface Discount {
  id: string;
  code: string;
  discount_type: DiscountType;
  discount_value: number;
  /** Present only when listing discounts scoped to an owner (owner_type + owner_id query). */
  is_default_for_owner?: boolean;
  /**
   * Funnels/courses this discount is restricted to. Empty array = global (usable anywhere).
   * Returned on every GET list/read response from the backend.
   */
  scopes?: DiscountScopeOwner[];
  starts_at?: string | null;
  ends_at?: string | null;
  max_redemptions?: number | null;
  redeemed_count: number;
  is_active: boolean;
  created_at: string;
  updated_at?: string | null;
}

export type LeadStatus = 'purchased' | 'lead' | 'subscribed';

export interface Lead {
  id: string;
  email: string;
  name?: string | null;
  phone?: string | null;
  source_funnel_id: string;
  /** Title of the source funnel — shown as a badge in the admin leads table. */
  funnel_title?: string | null;
  converted_at?: string | null;
  created_at: string;
  /** Highest paid order amount (VND); 0 when the lead has no paid order. */
  purchase_amount?: number;
  /** "purchased" when purchase_amount exceeds the threshold, else "lead". */
  status?: LeadStatus;
}

// ─── Public landing payload (cached, fully resolved) ───────────────────────

export interface PublicFunnelSection {
  id: string;
  name: string;
  html: string;
  theme_mode: string;
  section_type: string;
  responsive_config?: Record<string, unknown> | null;
  sort_order: number;
  /** Optional in-page anchor used by `data-landing-action="scroll"` CTAs. */
  anchor?: string | null;
}

export interface PublicFunnelLanding {
  funnel_id: string;
  slug: string;
  title: string;
  product_name: string;
  currency: string;
  price: number;
  final_price: number;
  zalo_link?: string | null;
  seo: FunnelSeo;
  sections: PublicFunnelSection[];
  variables: Record<string, string>;
  /** Meta Pixel/Dataset ID for browser-side Pixel init (no CAPI token here). */
  meta_pixel_id?: string | null;
  /** True when the funnel has tracking enabled with a pixel id configured. */
  tracking_enabled?: boolean;
}

// ─── Checkout flow ───────────────────────────────────────────────────────────

export interface AppliedDiscountInfo {
  code: string;
  applied: boolean;
  discount_type?: DiscountType | null;
  discount_value?: number | null;
  applied_percent: number;
  applied_amount: number;
  reason?: string | null;
}

/** Built-in checkout page layout templates (admin-selectable). */
export type FunnelCheckoutTemplate = 'split-hero' | 'header-band' | 'order-sidebar';

/**
 * Presentation config for the public checkout page, stored in `funnel.checkout_config`.
 * All fields optional — sensible defaults applied client-side (template=split-hero,
 * accent=#f97316). `custom_html` overrides the plain headline/message block when set.
 */
export interface FunnelCheckoutConfig {
  template?: FunnelCheckoutTemplate;
  headline?: string;
  message?: string;
  custom_html?: string | null;
  accent_color?: string;
  /** Overall checkout section max width in px (split-hero). Default 1024. */
  section_max_width?: number;
  /** Split-hero left column ratio in `fr` units. Default 1. */
  split_left_ratio?: number;
  /** Split-hero right column ratio in `fr` units. Default 1.1. */
  split_right_ratio?: number;
}

export interface FunnelQuote {
  funnel_id: string;
  funnel_title: string;
  currency: string;
  subtotal_amount: number;
  discount_amount: number;
  total_percent: number;
  final_amount: number;
  is_free: boolean;
  discounts: AppliedDiscountInfo[];
  checkout_config?: FunnelCheckoutConfig | null;
}

export interface FunnelCheckoutInput {
  buyer_name: string;
  buyer_email: string;
  buyer_phone: string;
  discount_codes: string[];
  /** Meta `_fbp` cookie value, forwarded for CAPI Advanced Matching. */
  fbp?: string | null;
  /** Meta `_fbc` cookie (or derived from `fbclid`), forwarded for CAPI. */
  fbc?: string | null;
  /** Shared dedup id between browser Pixel and server CAPI for this conversion. */
  event_id?: string | null;
}

export interface FunnelCheckoutResult {
  order_id: string;
  order_code: string;
  status: string;
  final_amount: number;
  is_free: boolean;
  qr_url?: string | null;
  bank_name?: string | null;
  account_number?: string | null;
  expires_at?: string | null;
}

export interface FunnelOrderStatus {
  order_id: string;
  status: string;
  zalo_link?: string | null;
  success_config?: Record<string, unknown> | null;
}

// ─── Admin inputs ────────────────────────────────────────────────────────────

export interface ProductInput {
  name: string;
  slug: string;
  description?: string | null;
  base_price: number;
  type: string;
  status?: ProductStatus;
  thumbnail_url?: string | null;
}

export interface FunnelCreateInput {
  product_id: string;
  title: string;
  slug: string;
  currency?: string;
  checkout_config?: Record<string, unknown> | null;
  success_config?: Record<string, unknown> | null;
  zalo_link?: string | null;
  variables?: Record<string, string> | null;
  variables_meta?: Record<string, VariableMeta> | null;
  tracking_config?: FunnelTrackingConfig | null;
}

export type FunnelUpdateInput = Partial<Omit<FunnelCreateInput, 'product_id'>> & {
  status?: FunnelStatus;
};

export interface FunnelCloneInput {
  slug: string;
  title?: string | null;
}

export type FunnelSeoInput = Partial<FunnelSeo>;

export interface FunnelSectionInput {
  name: string;
  html?: string;
  theme_mode?: string;
  section_type?: string;
  responsive_config?: Record<string, unknown> | null;
  sort_order?: number;
  is_visible?: boolean;
  /** Optional in-page anchor; cleared by passing null or empty string. */
  anchor?: string | null;
}

export type FunnelSectionUpdateInput = Partial<FunnelSectionInput>;

export interface DiscountInput {
  code: string;
  discount_type: DiscountType;
  discount_value: number;
  starts_at?: string | null;
  ends_at?: string | null;
  max_redemptions?: number | null;
  is_active?: boolean;
  /** Assign this new code as a default for these funnels/courses in the same request. */
  defaults?: DiscountDefaultActivationInput[];
  /**
   * Whitelist of funnels/courses where this code can be used.
   * Empty array or omitted = global (no restriction).
   * On update: provided value REPLACES existing scopes; null/omitted = leave unchanged; [] = clear (global).
   */
  scopes?: Array<{ owner_type: 'funnel' | 'course'; owner_id: string }>;
}

export type DiscountUpdateInput = Partial<DiscountInput>;

/** Body for POST/DELETE /admin/discounts/{id}/default — marks/unmarks a discount as default for an owner. */
export interface DiscountDefaultActivationInput {
  owner_type: 'funnel' | 'course';
  owner_id: string;
}

/** An owner (funnel/course) a discount is marked default for. */
export interface DiscountDefaultOwner {
  owner_type: 'funnel' | 'course';
  owner_id: string;
  owner_name?: string | null;
}

export interface FunnelEmailTemplate {
  template_key: string;
  label: string;
  enabled: boolean;
  is_custom: boolean;
  subject: string;
  html_body: string;
  default_subject: string;
  variables: { key: string; label: string; group: string; description?: string | null }[];
  updated_at?: string | null;
}

export interface FunnelEmailTemplateInput {
  subject: string;
  html_body: string;
  enabled: boolean;
}

export interface LeadListFilter {
  funnel_id?: string;
  converted?: boolean;
  /** Filter by lead status: 'purchased' | 'lead' | 'subscribed'. */
  status?: LeadStatus;
  created_from?: string;
  created_to?: string;
  /** Lọc theo email (khớp một phần, không phân biệt hoa/thường). */
  email?: string;
  page?: number;
  page_size?: number;
}

export interface LeadListPage {
  items: Lead[];
  total: number;
  page: number;
  page_size: number;
}

// ─── Lead capture token ──────────────────────────────────────────────────────

export interface FunnelCaptureToken {
  /** Funnel the token belongs to. */
  funnel_id?: string;
  /** The raw capture token value; null when no token has been generated yet. */
  capture_token: string | null;
  /** Server-derived public capture endpoint URL (convenience). */
  capture_endpoint?: string;
}

// ─── Analytics & tracking ────────────────────────────────────────────────────

export type FunnelPageType = 'landing' | 'checkout' | 'payment' | 'success';

export interface FunnelAnalyticsParams {
  /** ISO date (YYYY-MM-DD). Range is capped at 1 month (31 days) by the server. */
  startDate?: string;
  endDate?: string;
}

export interface FunnelAnalyticsWindow {
  start_date: string;
  end_date: string;
}

export interface FunnelRevenueSummary {
  total_revenue: number;
  paid_orders: number;
  average_order_value: number;
}

export interface FunnelTrafficBreakdown {
  landing_views: number;
  checkout_views: number;
  payment_views: number;
  success_views: number;
  landing_visitors: number;
  checkout_visitors: number;
  payment_visitors: number;
  success_visitors: number;
}

export interface FunnelConversionRates {
  landing_to_checkout: number;
  checkout_to_payment: number;
  payment_to_success: number;
  traffic_to_payment: number;
}

export interface FunnelDailyPoint {
  date: string;
  revenue: number;
  paid_orders: number;
  landing_views: number;
}

/** Lead counts by lifecycle status for leads captured inside the window. */
export interface FunnelLeadsSummary {
  subscribed: number;
  lead: number;
  purchased: number;
  total: number;
}

export interface FunnelAnalyticsOverview {
  window: FunnelAnalyticsWindow;
  revenue: FunnelRevenueSummary;
  traffic: FunnelTrafficBreakdown;
  conversion: FunnelConversionRates;
  leads: FunnelLeadsSummary;
  daily: FunnelDailyPoint[];
}
