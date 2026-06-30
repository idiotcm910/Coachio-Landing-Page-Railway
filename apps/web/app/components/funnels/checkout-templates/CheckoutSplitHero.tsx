'use client';

import type { CSSProperties } from 'react';
import { Lock } from 'lucide-react';
import { CheckoutTitleBlock } from './CheckoutTitleBlock';
import {
  type CheckoutTemplateProps,
  DEFAULT_SPLIT_LEFT_RATIO,
  DEFAULT_SPLIT_RIGHT_RATIO,
  resolveSectionMaxWidth,
  resolveSplitRatio,
} from './checkout-template-types';

/**
 * Template A — Split hero: cột trái panel "bán hàng" (navy + accent), cột phải form.
 * Desktop 2 cột, mobile xếp dọc (hero trên, form dưới).
 * Admin can customize the overall section width and the left/right column ratios.
 */
export function CheckoutSplitHero({
  config, accent, buyerForm, discountCodes, orderSummary, submitButton,
}: CheckoutTemplateProps) {
  // When the admin provides custom HTML it owns the panel visuals; otherwise the
  // left panel background follows the accent color (gradient toward a darker tint).
  const hasCustomHtml = Boolean(config.custom_html?.trim());
  const accentGradient = `linear-gradient(135deg, ${accent} 0%, color-mix(in srgb, ${accent} 60%, #1e1b4b) 100%)`;

  // Admin-configurable layout: overall section max width + left/right column ratios.
  // The grid stacks to 1 column on mobile; the ratios only apply from `lg` up via the
  // `--split-cols` CSS variable (so mobile stacking is preserved).
  const sectionMaxWidth = resolveSectionMaxWidth(config.section_max_width);
  const leftRatio = resolveSplitRatio(config.split_left_ratio, DEFAULT_SPLIT_LEFT_RATIO);
  const rightRatio = resolveSplitRatio(config.split_right_ratio, DEFAULT_SPLIT_RIGHT_RATIO);
  const gridStyle = { '--split-cols': `${leftRatio}fr ${rightRatio}fr` } as CSSProperties;

  return (
    <main className="min-h-screen bg-slate-100 py-0 lg:py-10">
      <div className="mx-auto w-full lg:px-4" style={{ maxWidth: sectionMaxWidth }}>
        <div className="overflow-hidden bg-white shadow-xl shadow-slate-200/60 lg:rounded-3xl">
          <div className="grid lg:[grid-template-columns:var(--split-cols)]" style={gridStyle}>
            {/* Hero */}
            <div
              className={`relative overflow-hidden p-3 lg:p-3 ${hasCustomHtml ? 'bg-white text-slate-900' : 'text-white'}`}
              style={hasCustomHtml ? undefined : { backgroundImage: accentGradient }}
            >
              {!hasCustomHtml && (
                <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/15 opacity-40 blur-2xl" />
              )}
              <div className="relative">
                <CheckoutTitleBlock
                  config={config}
                  headlineClassName="text-3xl font-extrabold leading-tight lg:text-4xl"
                  messageClassName="mt-4 max-w-md text-base leading-relaxed text-white/85"
                />
              </div>
            </div>

            {/* Form */}
            <div className="p-6 sm:p-8 lg:p-10">
              <div className="space-y-6">
                {buyerForm}
                {discountCodes}
                {orderSummary}
                {submitButton}
                <p className="flex items-center justify-center gap-1.5 text-xs text-slate-500">
                  <Lock className="h-4 w-4 text-emerald-500" /> Thanh toán an toàn · Bảo mật thông tin
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
