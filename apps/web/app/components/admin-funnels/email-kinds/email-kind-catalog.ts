/**
 * Email kind catalog — 5 kinds x all funnel email types.
 *
 * Shell is TABLE-BASED + inline styles only (nh3 email allowlist).
 * No <style> block. No <script>. Allowed tags from email_render.py:
 *   a b blockquote br center div em font h1-h6 hr i img li ol p
 *   span strong sub sup table tbody td tfoot th thead tr u ul
 * Allowed attrs: style class align valign width height bgcolor dir title
 *   + a[href target] img[src alt] table[cellpadding cellspacing border]
 *   + td/th[colspan rowspan]
 *
 * Color is baked inline at apply time (never stored as a token) so the
 * nh3 pipeline has nothing extra to strip.
 */

import type { EmailKindTemplate } from './email-kind-types';
import {
  COACHING_BODIES,
  COURSE_BODIES,
  EBOOK_BODIES,
  WEBINAR_BODIES,
  WORKSHOP_BODIES,
} from './email-kind-bodies';

// ---------------------------------------------------------------------------
// Shared shell builder
// ---------------------------------------------------------------------------

/**
 * Build a full transactional email HTML document.
 * Table-based layout, all styles inline, no <style> block.
 * Design: clean Stripe/Linear-style receipt — header band in brand color,
 * white card body, muted footer. No emojis anywhere.
 * colorHex is already validated by resolveEmailColor before reaching here.
 */
function buildShell(
  bodyHtml: string,
  colorHex: string,
  brandName: string,
  tagline: string,
): string {
  return [
    '<!DOCTYPE html>',
    '<html lang="vi">',
    '<head>',
    '<meta charset="UTF-8">',
    '<meta name="viewport" content="width=device-width,initial-scale=1">',
    '</head>',
    '<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Arial,sans-serif">',

    // Outer wrapper
    '<table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f3f4f6">',
    '<tbody>',
    '<tr>',
    '<td align="center" style="padding:40px 16px">',

    // Card — max 600 px
    '<table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%">',
    '<tbody>',

    // --- Header band ---
    '<tr>',
    `<td align="left" bgcolor="${colorHex}" ` +
      `style="background:${colorHex};border-radius:8px 8px 0 0;padding:32px 40px">`,
    `<p style="margin:0;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;line-height:1.2">${brandName}</p>`,
    `<p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.75);letter-spacing:0.2px">${tagline}</p>`,
    '</td>',
    '</tr>',

    // --- White body ---
    '<tr>',
    '<td bgcolor="#ffffff" style="background:#ffffff;padding:36px 40px;' +
      'border-left:1px solid #e5e7eb;border-right:1px solid #e5e7eb">',
    '<div style="font-size:15px;line-height:1.75;color:#374151">',
    bodyHtml,
    '</div>',
    '</td>',
    '</tr>',

    // --- Footer ---
    '<tr>',
    '<td align="center" bgcolor="#f3f4f6" ' +
      'style="background:#f3f4f6;padding:24px 40px;border-radius:0 0 8px 8px;' +
      'border:1px solid #e5e7eb;border-top:none">',
    `<p style="margin:0 0 4px;font-size:12px;color:#9ca3af">© {{current_year}} ${brandName}</p>`,
    `<p style="margin:0;font-size:12px;color:#9ca3af">` +
      `Hỗ trợ: <a href="mailto:{{support_email}}" style="color:${colorHex};text-decoration:none">{{support_email}}</a>` +
      `</p>`,
    '</td>',
    '</tr>',

    '</tbody>',
    '</table>',
    // End card

    '</td>',
    '</tr>',
    '</tbody>',
    '</table>',
    // End outer wrapper

    '</body>',
    '</html>',
  ].join('\n');
}

/** Render a primary CTA button using the kind color. Stripe-style: full-width pill. */
function ctaButton(label: string, hrefToken: string, colorHex: string): string {
  return (
    '<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 0">' +
    '<tbody><tr>' +
    '<td align="center">' +
    `<a href="${hrefToken}" target="_blank" ` +
    `style="display:inline-block;padding:14px 32px;background:${colorHex};color:#ffffff;` +
    `font-size:14px;font-weight:600;text-decoration:none;border-radius:6px;` +
    `letter-spacing:0.1px">${label}</a>` +
    '</td>' +
    '</tr></tbody>' +
    '</table>'
  );
}

// ---------------------------------------------------------------------------
// 5 kind definitions
// ---------------------------------------------------------------------------

const WORKSHOP: EmailKindTemplate = {
  kind: 'workshop',
  label: 'Workshop / Event',
  description: 'Emails for live or online workshop products — schedule reminders, join links, Zalo group.',
  thumbnail: 'linear-gradient(135deg,#f59e0b,#ef4444)',
  shell: (bodyHtml, colorHex) =>
    buildShell(
      bodyHtml + ctaButton('Tham gia nhóm Zalo', '{{zalo_link}}', colorHex),
      colorHex,
      '{{brand_name}}',
      'Workshop & Sự kiện',
    ),
  emails: WORKSHOP_BODIES,
};

const EBOOK: EmailKindTemplate = {
  kind: 'ebook',
  label: 'Ebook / Document',
  description: 'Emails for ebook, PDF and digital document products — download reminders, support.',
  thumbnail: 'linear-gradient(135deg,#3b82f6,#06b6d4)',
  shell: (bodyHtml, colorHex) =>
    buildShell(
      bodyHtml,
      colorHex,
      '{{brand_name}}',
      'Ebook & Tài liệu số',
    ),
  emails: EBOOK_BODIES,
};

const COURSE: EmailKindTemplate = {
  kind: 'course',
  label: 'Online Course',
  description: 'Emails for courses — enrolment confirmation, account provisioning, getting-started guide.',
  thumbnail: 'linear-gradient(135deg,#8b5cf6,#6d5efc)',
  shell: (bodyHtml, colorHex) =>
    buildShell(
      bodyHtml + ctaButton('Bắt đầu học ngay', '{{login_url}}', colorHex),
      colorHex,
      '{{brand_name}}',
      'Khóa học Online',
    ),
  emails: COURSE_BODIES,
};

const COACHING: EmailKindTemplate = {
  kind: 'coaching',
  label: 'Coaching / Consulting',
  description: 'Emails for coaching and mentoring services — booking confirmation, session reminders, coach contact.',
  thumbnail: 'linear-gradient(135deg,#10b981,#059669)',
  shell: (bodyHtml, colorHex) =>
    buildShell(
      bodyHtml + ctaButton('Tham gia nhóm Zalo', '{{zalo_link}}', colorHex),
      colorHex,
      '{{brand_name}}',
      'Coaching & Tư vấn',
    ),
  emails: COACHING_BODIES,
};

const WEBINAR: EmailKindTemplate = {
  kind: 'webinar',
  label: 'Webinar / Livestream',
  description: 'Emails for webinars and live sessions — registration confirmation, join-link reminders.',
  thumbnail: 'linear-gradient(135deg,#ec4899,#8b5cf6)',
  shell: (bodyHtml, colorHex) =>
    buildShell(
      bodyHtml + ctaButton('Tham gia nhóm Zalo', '{{zalo_link}}', colorHex),
      colorHex,
      '{{brand_name}}',
      'Webinar & Livestream',
    ),
  emails: WEBINAR_BODIES,
};

// ---------------------------------------------------------------------------
// Exported catalog
// ---------------------------------------------------------------------------

export const EMAIL_KINDS: EmailKindTemplate[] = [
  WORKSHOP,
  EBOOK,
  COURSE,
  COACHING,
  WEBINAR,
];
