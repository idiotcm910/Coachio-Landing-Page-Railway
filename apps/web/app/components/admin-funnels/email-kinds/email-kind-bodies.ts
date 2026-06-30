/**
 * Per-kind body copy for each funnel email type.
 *
 * Funnel email types (template_key) found in funnel_notification_service.py:
 *   receipt              — Thanh toán thành công (all products)
 *   waiting_payment      — Chờ thanh toán / QR (all products)
 *   course_credentials   — Course product: cấp tài khoản mới
 *   course_access        — Course product: cấp quyền truy cập tài khoản có sẵn
 *
 * Whitelisted variables per type (from funnel_email_templates.py + funnel_notification_service.py):
 *
 * ALL types (funnel resolver + order context):
 *   {{product_name}} {{funnel_title}} {{price}} {{checkout_url}} {{success_url}} {{zalo_link}}
 *   {{buyer_name}} {{buyer_email}} {{order_code}} {{amount}} {{final_price}} {{currency}} {{paid_at}}
 *
 * waiting_payment extras:
 *   {{qr_url}} {{bank_name}} {{account_number}} {{expires_at}}
 *
 * course_credentials extras:
 *   {{login_email}} {{login_password}} {{login_url}}
 *
 * course_access extras:
 *   {{login_email}} {{login_url}}
 *
 * Bodies are raw HTML fragments — injected into shell() which provides outer table frame.
 * MUST NOT use <style> blocks or tags outside the nh3 email allowlist.
 */

import type { EmailKindEntry } from './email-kind-types';

// ---------------------------------------------------------------------------
// Shared layout helpers (inline styles only, nh3-safe tags)
// ---------------------------------------------------------------------------

/** Thin horizontal divider row. */
const divider =
  '<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0">' +
  '<tbody><tr><td style="border-top:1px solid #e5e7eb;font-size:0;line-height:0">&nbsp;</td></tr></tbody>' +
  '</table>';

/** Two-column info row: label on left, value on right. */
function infoRow(label: string, value: string): string {
  return (
    '<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0">' +
    '<tbody><tr>' +
    `<td style="font-size:13px;color:#6b7280;padding:6px 0;width:40%">${label}</td>` +
    `<td style="font-size:14px;color:#111827;font-weight:600;padding:6px 0;text-align:right">${value}</td>` +
    '</tr></tbody>' +
    '</table>'
  );
}

/** Section heading (small caps style). */
function sectionLabel(text: string): string {
  return `<p style="margin:0 0 8px;font-size:11px;font-weight:700;color:#9ca3af;letter-spacing:0.8px;text-transform:uppercase">${text}</p>`;
}

/** Credential row: monospace-styled value. */
function credRow(label: string, value: string): string {
  return (
    '<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0">' +
    '<tbody><tr>' +
    `<td style="font-size:13px;color:#6b7280;padding:6px 0;width:40%">${label}</td>` +
    `<td style="font-size:14px;color:#111827;font-family:Courier New,Courier,monospace;font-weight:600;padding:6px 0;text-align:right">${value}</td>` +
    '</tr></tbody>' +
    '</table>'
  );
}

// ---------------------------------------------------------------------------
// Shared neutral bodies (product-agnostic fallbacks for cross-kind types)
// ---------------------------------------------------------------------------

/** Neutral waiting-payment body — same vars available regardless of kind. */
const NEUTRAL_WAITING: EmailKindEntry = {
  subject: 'Xác nhận chờ thanh toán — {{funnel_title}}',
  body: [
    '<p style="margin:0 0 20px;font-size:15px;color:#374151">',
    'Xin chào <strong>{{buyer_name}}</strong>,',
    '</p>',
    '<p style="margin:0 0 20px;font-size:15px;color:#374151">',
    'Chúng tôi đã nhận được yêu cầu mua <strong>{{product_name}}</strong>. ',
    'Vui lòng hoàn tất thanh toán để kích hoạt đơn hàng.',
    '</p>',
    divider,
    sectionLabel('Thông tin đơn hàng'),
    infoRow('Mã đơn', '{{order_code}}'),
    infoRow('Số tiền', '{{amount}} {{currency}}'),
    infoRow('Hết hạn lúc', '{{expires_at}}'),
    divider,
    sectionLabel('Quét mã QR để thanh toán'),
    '<p style="margin:16px 0;text-align:center">',
    '<img src="{{qr_url}}" alt="VietQR thanh toán" width="200" height="200" ',
    'style="display:inline-block;border:1px solid #e5e7eb;border-radius:8px">',
    '</p>',
    divider,
    sectionLabel('Hoặc chuyển khoản thủ công'),
    infoRow('Ngân hàng', '{{bank_name}}'),
    infoRow('Số tài khoản', '{{account_number}}'),
    infoRow('Nội dung chuyển khoản', '{{order_code}}'),
  ].join(''),
};

/** Neutral course_credentials body. */
const NEUTRAL_COURSE_CREDENTIALS: EmailKindEntry = {
  subject: 'Tài khoản học — {{product_name}}',
  body: [
    '<p style="margin:0 0 20px;font-size:15px;color:#374151">',
    'Xin chào <strong>{{buyer_name}}</strong>,',
    '</p>',
    '<p style="margin:0 0 20px;font-size:15px;color:#374151">',
    'Tài khoản học cho <strong>{{product_name}}</strong> đã được tạo và sẵn sàng.',
    '</p>',
    divider,
    sectionLabel('Thông tin đăng nhập'),
    credRow('Email', '{{login_email}}'),
    credRow('Mật khẩu tạm', '{{login_password}}'),
    '<p style="margin:12px 0 0;font-size:13px;color:#6b7280">',
    'Trang đăng nhập: ',
    '<a href="{{login_url}}" style="color:#2563eb">{{login_url}}</a>',
    '<br>Vui lòng thay đổi mật khẩu sau lần đăng nhập đầu tiên.',
    '</p>',
  ].join(''),
};

/** Neutral course_access body. */
const NEUTRAL_COURSE_ACCESS: EmailKindEntry = {
  subject: 'Quyền truy cập đã được cấp — {{product_name}}',
  body: [
    '<p style="margin:0 0 20px;font-size:15px;color:#374151">',
    'Xin chào <strong>{{buyer_name}}</strong>,',
    '</p>',
    '<p style="margin:0 0 20px;font-size:15px;color:#374151">',
    'Tài khoản của bạn đã được cấp quyền truy cập <strong>{{product_name}}</strong>.',
    '</p>',
    divider,
    sectionLabel('Thông tin tài khoản'),
    infoRow('Email đăng nhập', '{{login_email}}'),
    '<p style="margin:12px 0 0;font-size:13px;color:#6b7280">',
    'Bắt đầu học ngay tại: ',
    '<a href="{{login_url}}" style="color:#2563eb">{{login_url}}</a>',
    '</p>',
  ].join(''),
};

// ---------------------------------------------------------------------------
// Workshop kind bodies
// ---------------------------------------------------------------------------

export const WORKSHOP_BODIES: Record<string, EmailKindEntry> = {
  receipt: {
    subject: 'Xác nhận đăng ký Workshop — {{product_name}}',
    body: [
      '<p style="margin:0 0 20px;font-size:15px;color:#374151">',
      'Xin chào <strong>{{buyer_name}}</strong>,',
      '</p>',
      '<p style="margin:0 0 20px;font-size:15px;color:#374151">',
      'Đăng ký Workshop <strong>{{product_name}}</strong> đã được xác nhận. ',
      'Cảm ơn bạn đã tin tưởng và lựa chọn chúng tôi.',
      '</p>',
      divider,
      sectionLabel('Chi tiết đơn hàng'),
      infoRow('Mã đơn', '{{order_code}}'),
      infoRow('Số tiền', '{{amount}} {{currency}}'),
      infoRow('Thanh toán lúc', '{{paid_at}}'),
      divider,
      '<p style="margin:0;font-size:13px;color:#6b7280">',
      'Chi tiết sự kiện và link tham gia sẽ được gửi trước ngày khai mạc. ',
      'Tham gia nhóm Zalo để nhận thông báo sớm nhất: ',
      '<a href="{{zalo_link}}" style="color:#2563eb">{{zalo_link}}</a>',
      '</p>',
    ].join(''),
  },
  waiting_payment: NEUTRAL_WAITING,
  course_credentials: NEUTRAL_COURSE_CREDENTIALS,
  course_access: NEUTRAL_COURSE_ACCESS,
};

// ---------------------------------------------------------------------------
// Ebook kind bodies
// ---------------------------------------------------------------------------

export const EBOOK_BODIES: Record<string, EmailKindEntry> = {
  receipt: {
    subject: 'Xác nhận mua Ebook — {{product_name}}',
    body: [
      '<p style="margin:0 0 20px;font-size:15px;color:#374151">',
      'Xin chào <strong>{{buyer_name}}</strong>,',
      '</p>',
      '<p style="margin:0 0 20px;font-size:15px;color:#374151">',
      'Đơn hàng <strong>{{product_name}}</strong> đã được thanh toán thành công. ',
      'Ebook đã sẵn sàng để tải về.',
      '</p>',
      divider,
      sectionLabel('Chi tiết đơn hàng'),
      infoRow('Mã đơn', '{{order_code}}'),
      infoRow('Số tiền', '{{amount}} {{currency}}'),
      divider,
      '<p style="margin:0;font-size:13px;color:#6b7280">',
      'Nếu cần hỗ trợ, tham gia nhóm Zalo: ',
      '<a href="{{zalo_link}}" style="color:#2563eb">{{zalo_link}}</a>',
      '</p>',
    ].join(''),
  },
  waiting_payment: NEUTRAL_WAITING,
  course_credentials: NEUTRAL_COURSE_CREDENTIALS,
  course_access: NEUTRAL_COURSE_ACCESS,
};

// ---------------------------------------------------------------------------
// Course kind bodies
// ---------------------------------------------------------------------------

export const COURSE_BODIES: Record<string, EmailKindEntry> = {
  receipt: {
    subject: 'Xác nhận đăng ký khoá học — {{product_name}}',
    body: [
      '<p style="margin:0 0 20px;font-size:15px;color:#374151">',
      'Xin chào <strong>{{buyer_name}}</strong>,',
      '</p>',
      '<p style="margin:0 0 20px;font-size:15px;color:#374151">',
      'Đăng ký khoá học <strong>{{product_name}}</strong> đã được xác nhận. ',
      'Thông tin đăng nhập sẽ được gửi trong email tiếp theo.',
      '</p>',
      divider,
      sectionLabel('Chi tiết đơn hàng'),
      infoRow('Mã đơn', '{{order_code}}'),
      infoRow('Số tiền', '{{amount}} {{currency}}'),
      divider,
      '<p style="margin:0;font-size:13px;color:#6b7280">',
      'Tham gia nhóm Zalo để được hỗ trợ: ',
      '<a href="{{zalo_link}}" style="color:#2563eb">{{zalo_link}}</a>',
      '</p>',
    ].join(''),
  },
  waiting_payment: NEUTRAL_WAITING,
  course_credentials: {
    subject: 'Tài khoản khoá học — {{product_name}}',
    body: [
      '<p style="margin:0 0 20px;font-size:15px;color:#374151">',
      'Xin chào <strong>{{buyer_name}}</strong>,',
      '</p>',
      '<p style="margin:0 0 20px;font-size:15px;color:#374151">',
      'Tài khoản học cho khoá <strong>{{product_name}}</strong> đã được tạo thành công.',
      '</p>',
      divider,
      sectionLabel('Thông tin đăng nhập'),
      credRow('Email', '{{login_email}}'),
      credRow('Mật khẩu tạm', '{{login_password}}'),
      '<p style="margin:12px 0 0;font-size:13px;color:#6b7280">',
      'Trang đăng nhập: ',
      '<a href="{{login_url}}" style="color:#2563eb">{{login_url}}</a>',
      '<br>Vui lòng thay đổi mật khẩu sau lần đăng nhập đầu tiên.',
      '</p>',
    ].join(''),
  },
  course_access: {
    subject: 'Quyền truy cập khoá học đã cập nhật — {{product_name}}',
    body: [
      '<p style="margin:0 0 20px;font-size:15px;color:#374151">',
      'Xin chào <strong>{{buyer_name}}</strong>,',
      '</p>',
      '<p style="margin:0 0 20px;font-size:15px;color:#374151">',
      'Tài khoản của bạn đã được cấp quyền truy cập khoá học <strong>{{product_name}}</strong>.',
      '</p>',
      divider,
      sectionLabel('Thông tin tài khoản'),
      infoRow('Email đăng nhập', '{{login_email}}'),
      '<p style="margin:12px 0 0;font-size:13px;color:#6b7280">',
      'Bắt đầu học ngay tại: ',
      '<a href="{{login_url}}" style="color:#2563eb">{{login_url}}</a>',
      '</p>',
    ].join(''),
  },
};

// ---------------------------------------------------------------------------
// Coaching kind bodies
// ---------------------------------------------------------------------------

export const COACHING_BODIES: Record<string, EmailKindEntry> = {
  receipt: {
    subject: 'Xác nhận đặt lịch Coaching — {{product_name}}',
    body: [
      '<p style="margin:0 0 20px;font-size:15px;color:#374151">',
      'Xin chào <strong>{{buyer_name}}</strong>,',
      '</p>',
      '<p style="margin:0 0 20px;font-size:15px;color:#374151">',
      'Đơn hàng dịch vụ coaching <strong>{{product_name}}</strong> đã được xác nhận. ',
      'Coach sẽ liên hệ để sắp xếp lịch hẹn phù hợp.',
      '</p>',
      divider,
      sectionLabel('Chi tiết đơn hàng'),
      infoRow('Mã đơn', '{{order_code}}'),
      infoRow('Số tiền', '{{amount}} {{currency}}'),
      divider,
      '<p style="margin:0;font-size:13px;color:#6b7280">',
      'Tham gia nhóm Zalo để trao đổi trực tiếp với coach: ',
      '<a href="{{zalo_link}}" style="color:#2563eb">{{zalo_link}}</a>',
      '</p>',
    ].join(''),
  },
  waiting_payment: NEUTRAL_WAITING,
  course_credentials: NEUTRAL_COURSE_CREDENTIALS,
  course_access: NEUTRAL_COURSE_ACCESS,
};

// ---------------------------------------------------------------------------
// Webinar kind bodies
// ---------------------------------------------------------------------------

export const WEBINAR_BODIES: Record<string, EmailKindEntry> = {
  receipt: {
    subject: 'Xác nhận đăng ký Webinar — {{product_name}}',
    body: [
      '<p style="margin:0 0 20px;font-size:15px;color:#374151">',
      'Xin chào <strong>{{buyer_name}}</strong>,',
      '</p>',
      '<p style="margin:0 0 20px;font-size:15px;color:#374151">',
      'Đăng ký Webinar <strong>{{product_name}}</strong> đã được xác nhận. ',
      'Link tham gia sẽ được gửi trước buổi học.',
      '</p>',
      divider,
      sectionLabel('Chi tiết đơn hàng'),
      infoRow('Mã đơn', '{{order_code}}'),
      infoRow('Số tiền', '{{amount}} {{currency}}'),
      infoRow('Thanh toán lúc', '{{paid_at}}'),
      divider,
      '<p style="margin:0;font-size:13px;color:#6b7280">',
      'Tham gia nhóm Zalo để không bỏ lỡ thông tin: ',
      '<a href="{{zalo_link}}" style="color:#2563eb">{{zalo_link}}</a>',
      '</p>',
    ].join(''),
  },
  waiting_payment: NEUTRAL_WAITING,
  course_credentials: NEUTRAL_COURSE_CREDENTIALS,
  course_access: NEUTRAL_COURSE_ACCESS,
};
