'use client';

import type { FunnelCheckoutConfig } from '@coachio/api-client';
import { CheckoutTemplateRenderer } from '../../funnels/checkout-templates/CheckoutTemplateRenderer';
import { resolveAccent } from '../../funnels/checkout-templates/checkout-template-types';
import { FUNNEL_PREVIEW_SAMPLE, formatPreviewVnd } from './funnel-preview-sample';

interface FunnelCheckoutPreviewProps {
  /** checkout_config.headline — tiêu đề trang thanh toán. */
  headline?: string;
  /** checkout_config.message — thông điệp phụ dưới tiêu đề. */
  message?: string;
  /** Template layout đã chọn. */
  template?: FunnelCheckoutConfig['template'];
  /** Màu nhấn (hex). */
  accentColor?: string;
  /** HTML tùy chỉnh thay tiêu đề/mô tả. */
  customHtml?: string | null;
  /** Split-hero: chiều rộng tổng section (px). */
  sectionMaxWidth?: number;
  /** Split-hero: tỉ lệ cột trái (fr). */
  splitLeftRatio?: number;
  /** Split-hero: tỉ lệ cột phải (fr). */
  splitRightRatio?: number;
  productName?: string;
  price?: number;
}

const inputBase = 'w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-800 placeholder-slate-400';

/**
 * Preview trang checkout — render đúng template thật (CheckoutTemplateRenderer) với
 * dữ liệu mẫu tĩnh (read-only), phản ánh template + accent + custom HTML admin cấu hình.
 */
export function FunnelCheckoutPreview({
  headline, message, template, accentColor, customHtml,
  sectionMaxWidth, splitLeftRatio, splitRightRatio, productName, price,
}: FunnelCheckoutPreviewProps) {
  const s = FUNNEL_PREVIEW_SAMPLE;
  const finalPrice = price ?? s.price;
  const name = productName ?? s.productName;
  const accent = resolveAccent(accentColor);
  const config: FunnelCheckoutConfig = {
    template, headline, message, custom_html: customHtml, accent_color: accent,
    section_max_width: sectionMaxWidth,
    split_left_ratio: splitLeftRatio,
    split_right_ratio: splitRightRatio,
  };

  // Các khối tĩnh mô phỏng giao diện public (không tương tác).
  const buyerForm = (
    <div className="space-y-4">
      <h3 className="text-base font-extrabold text-slate-900">Thông tin đăng ký</h3>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-700">Họ &amp; tên <span style={{ color: accent }}>*</span></label>
        <input readOnly value={s.buyerName} className={inputBase} />
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-700">Email <span style={{ color: accent }}>*</span></label>
        <input readOnly value={s.buyerEmail} className={inputBase} />
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-700">Số điện thoại <span style={{ color: accent }}>*</span></label>
        <input readOnly value={s.buyerPhone} className={inputBase} />
      </div>
    </div>
  );

  const discountCodes = (
    <div className="space-y-3">
      <h3 className="text-sm font-bold uppercase tracking-wide text-slate-700">Mã giảm giá</h3>
      <div className="flex gap-2">
        <input readOnly placeholder="Nhập mã giảm giá" className={inputBase} />
        <span className="shrink-0 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white">Áp dụng</span>
      </div>
    </div>
  );

  const orderSummary = (
    <div className="space-y-2 text-sm text-slate-700">
      <div className="flex justify-between"><span>{name}</span><span>{formatPreviewVnd(finalPrice)}</span></div>
      <div className="flex items-center justify-between border-t border-slate-200 pt-2 text-base font-bold text-slate-900">
        <span>Tổng cộng</span><span>{formatPreviewVnd(finalPrice)}</span>
      </div>
    </div>
  );

  const submitButton = (
    <div style={{ backgroundColor: accent }} className="w-full rounded-xl py-4 text-center text-lg font-bold text-white shadow-lg">
      Tiến hành thanh toán
    </div>
  );

  return (
    <div className="pointer-events-none min-h-full select-none">
      <CheckoutTemplateRenderer
        slug="#"
        config={config}
        accent={accent}
        quote={null}
        buyerForm={buyerForm}
        discountCodes={discountCodes}
        orderSummary={orderSummary}
        submitButton={submitButton}
      />
    </div>
  );
}
