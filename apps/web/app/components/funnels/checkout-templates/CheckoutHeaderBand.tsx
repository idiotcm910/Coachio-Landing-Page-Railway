'use client';

import { ShieldCheck } from 'lucide-react';
import { CheckoutTitleBlock } from './CheckoutTitleBlock';
import type { CheckoutTemplateProps } from './checkout-template-types';

/**
 * Template B — Header band: 1 cột, dải header gradient (accent) chứa tiêu đề/mô tả,
 * thân chứa form + mã giảm, đáy là tóm tắt + CTA. Tối ưu mobile/conversion.
 */
export function CheckoutHeaderBand({
  config, accent, buyerForm, discountCodes, orderSummary, submitButton,
}: CheckoutTemplateProps) {
  // When the admin provides custom HTML it owns the band visuals; otherwise the
  // header band background follows the accent color (gradient toward a darker tint).
  const hasCustomHtml = Boolean(config.custom_html?.trim());
  const accentGradient = `linear-gradient(135deg, ${accent} 0%, color-mix(in srgb, ${accent} 60%, #1e1b4b) 100%)`;
  return (
    <main className="min-h-screen bg-slate-100 py-0 sm:py-10">
      <div className="mx-auto max-w-xl sm:px-4">
        <div className="overflow-hidden bg-white shadow-xl shadow-slate-200/60 sm:rounded-3xl">
          {/* Header band — background follows accent unless custom HTML is set */}
          <div
            className={`relative overflow-hidden px-7 py-8 ${hasCustomHtml ? 'bg-white text-slate-900' : 'text-white'}`}
            style={hasCustomHtml ? undefined : { backgroundImage: accentGradient }}
          >
            <div className="relative">
              <CheckoutTitleBlock
                config={config}
                headlineClassName="text-2xl font-extrabold leading-tight"
                messageClassName="mt-2 text-sm leading-relaxed text-white/85"
              />
            </div>
          </div>

          {/* Body */}
          <div className="space-y-7 p-7">
            {buyerForm}
            {discountCodes}
          </div>

          {/* Footer: summary + CTA */}
          <div className="space-y-4 border-t border-slate-100 bg-slate-50/70 p-7">
            {orderSummary}
            {submitButton}
            <p className="flex items-center justify-center gap-1.5 text-xs text-slate-500">
              <ShieldCheck className="h-4 w-4 text-emerald-500" /> Bảo mật thông tin · Thanh toán an toàn
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
