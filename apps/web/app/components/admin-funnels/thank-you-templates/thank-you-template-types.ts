/**
 * Types, constants, and pure utility functions for the thank-you template catalog.
 * Frontend-only — no backend changes. Values stored as plain strings in funnels.variables.
 */

// ---------------------------------------------------------------------------
// Primitive types
// ---------------------------------------------------------------------------

/** Five product kinds supported by the catalog. */
export type ThankYouKind = 'workshop' | 'ebook' | 'course' | 'coaching' | 'webinar';

/**
 * Input widget type for a template variable.
 * Drives the form renderer in the picker (Phase 02); values are always stored as strings.
 */
export type ThankYouVarType = 'text' | 'date' | 'time' | 'datetime' | 'number' | 'color';

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

/** A single configurable variable declared by a template. */
export interface ThankYouTemplateVar {
  /** Token key, e.g. 'event_date' → used as {{event_date}} in HTML. */
  key: string;
  /** Human-readable label shown in the config form. Vietnamese. */
  name: string;
  /** Input widget type for the picker form. */
  type: ThankYouVarType;
  /** Optional input placeholder. */
  placeholder?: string;
  /** Sample value used for live preview rendering. Vietnamese. */
  sample: string;
}

/** A complete thank-you template entry in the catalog. */
export interface ThankYouTemplate {
  /** Unique identifier, e.g. 'workshop-standard'. */
  id: string;
  /** Product kind this template targets. */
  kind: ThankYouKind;
  /** Short display label. Vietnamese. */
  label: string;
  /** One-sentence description. Vietnamese. */
  description: string;
  /** Accent color pair for the gallery thumbnail mockup [from, to] (CSS color values). */
  thumbnailGradient: [string, string];
  /**
   * Self-contained HTML page (inline styles, no <script>, no external CSS).
   * Contains {{primary_color}} and kind-specific tokens plus system tokens:
   * {{product_name}}, {{funnel_title}}, {{discounted_price}}, {{zalo_link}}.
   */
  html: string;
  /** Kind-specific variables. primary_color is implicit and always included. */
  defaultVars: ThankYouTemplateVar[];
  /** Whether the template renders a Zalo group join block. */
  zaloLink?: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default primary color (indigo-ish) used when admin has not set one. */
export const DEFAULT_PRIMARY_COLOR = '#6d5efc';

// ---------------------------------------------------------------------------
// Utility: color validation
// ---------------------------------------------------------------------------

/**
 * Normalises a primary color string. Accepts 3- or 6-digit hex only (#RGB / #RRGGBB).
 * Returns DEFAULT_PRIMARY_COLOR when the input is absent or invalid.
 * Mirrors the resolveAccent pattern from checkout-template-types.ts.
 */
export function resolvePrimaryColor(c?: string | null): string {
  if (c && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(c.trim())) return c.trim();
  return DEFAULT_PRIMARY_COLOR;
}

// ---------------------------------------------------------------------------
// Utility: scaffold variable map
// ---------------------------------------------------------------------------

/**
 * Builds the variables map to merge into funnels.variables when scaffolding.
 * Always includes primary_color (resolved/validated).
 * All values are coerced to strings (backend stores variables as Record<string,string>).
 *
 * @param template  The selected catalog entry.
 * @param values    Admin-supplied values keyed by ThankYouTemplateVar.key.
 */
export function buildScaffoldVariables(
  template: ThankYouTemplate,
  values: Record<string, string>,
): Record<string, string> {
  const result: Record<string, string> = {
    primary_color: resolvePrimaryColor(values['primary_color']),
  };
  for (const v of template.defaultVars) {
    result[v.key] = String(values[v.key] ?? '');
  }
  return result;
}

// ---------------------------------------------------------------------------
// Utility: client-side preview renderer
// ---------------------------------------------------------------------------

/**
 * Replaces {{key}} tokens in an HTML string using the supplied variable map.
 * Unknown tokens resolve to '' (mirrors render_funnel_tokens backend semantics).
 * FOR CLIENT PREVIEW ONLY — not used for final stored HTML.
 *
 * @param html  Template HTML string containing {{token}} placeholders.
 * @param vars  Map of token key → replacement string.
 */
export function renderCatalogPreview(html: string, vars: Record<string, string>): string {
  return html.replace(/\{\{([^}]+)\}\}/g, (_match, key: string) => vars[key.trim()] ?? '');
}
