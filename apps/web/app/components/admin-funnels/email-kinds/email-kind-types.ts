/**
 * Email kind catalog types for funnel email templates.
 *
 * 5 kinds mirror the thank-you template taxonomy:
 * workshop | ebook | course | coaching | webinar
 *
 * Each kind provides a transactional email shell + per-type body copy
 * for every funnel email type (receipt, waiting_payment, course_credentials, course_access).
 *
 * Shell is TABLE-BASED + inline styles only — must survive nh3 sanitization.
 * No <style> block. No <script>. Tags/attributes limited to nh3 email allowlist.
 */

/** 5 product kinds, shared with the thank-you template taxonomy. */
export type EmailKind = 'workshop' | 'ebook' | 'course' | 'coaching' | 'webinar';

/** One funnel email type entry: localized subject + raw HTML body fragment. */
export interface EmailKindEntry {
  subject: string;
  /** Raw HTML body fragment injected into shell(). MUST preserve whitelisted {{vars}}. */
  body: string;
}

/**
 * A complete email kind template definition.
 *
 * `shell(bodyHtml, colorHex)` wraps a body fragment in a table-based transactional
 * email frame (header band, footer, CTA button colors). Color is baked inline.
 *
 * `emails` maps funnel template_key → subject + body. All 6 funnel email types
 * must be present (neutral fallback accepted for product-specific types).
 */
export interface EmailKindTemplate {
  kind: EmailKind;
  label: string;
  description: string;
  /** Gradient string or emoji/icon character — used by picker thumbnail. */
  thumbnail: string;
  /**
   * Wrap a body fragment in the kind's transactional email frame.
   * colorHex is validated before this is called (see resolveEmailColor).
   */
  shell: (bodyHtml: string, colorHex: string) => string;
  /**
   * Per-funnel-email-type content. Keys are funnel template_key strings:
   * 'receipt' | 'waiting_payment' | 'course_credentials' | 'course_access'
   */
  emails: Record<string, EmailKindEntry>;
}

/** Default brand color — matches Coachio violet. */
export const DEFAULT_EMAIL_COLOR = '#6d5efc';

const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/**
 * Validate a hex color string; return DEFAULT_EMAIL_COLOR on invalid/missing input.
 */
export function resolveEmailColor(c?: string | null): string {
  if (c && HEX_RE.test(c.trim())) return c.trim();
  return DEFAULT_EMAIL_COLOR;
}

/**
 * Build a final { subject, html } from a kind + email type + color.
 *
 * If `emailType` is missing from `kind.emails`, a neutral fallback body is used
 * so the shell is always complete (never returns empty html).
 */
export function buildEmail(
  kind: EmailKindTemplate,
  emailType: string,
  color: string,
): { subject: string; html: string } {
  const safeColor = resolveEmailColor(color);
  const entry = kind.emails[emailType] ?? {
    subject: 'Thông báo từ {{funnel_title}}',
    body: '<p>Xin chào {{buyer_name}},</p><p>Cảm ơn bạn đã tin tưởng <strong>{{product_name}}</strong>.</p>',
  };
  return {
    subject: entry.subject,
    html: kind.shell(entry.body, safeColor),
  };
}
