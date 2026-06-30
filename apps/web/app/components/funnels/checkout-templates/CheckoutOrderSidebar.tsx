'use client';

import { ShieldCheck } from 'lucide-react';
import { CheckoutTitleBlock } from './CheckoutTitleBlock';
import type { CheckoutTemplateProps } from './checkout-template-types';

/**
 * Template C — Order sidebar: tiêu đề/mô tả làm hero trên cùng, form người mua bên trái,
 * thẻ đơn hàng (mã giảm + tóm tắt + CTA) sticky bên phải. Kiểu e-commerce quen thuộc.
 */
export function CheckoutOrderSidebar({
  config, buyerForm, discountCodes, orderSummary, submitButton,
}: CheckoutTemplateProps) {
  return (
    <main className="min-h-screen bg-slate-100 py-10">
      <div className="mx-auto max-w-5xl px-4">

        {/* Hero: tiêu đề + mô tả */}
        <div className="mb-6">
          <CheckoutTitleBlock
            config={config}
            headlineClassName="text-3xl font-extrabold leading-tight text-slate-900"
            messageClassName="mt-2 max-w-2xl text-base text-slate-500"
          />
        </div>

        <div className="grid items-start gap-6 lg:grid-cols-[1fr_360px]">
          {/* Form chính */}
          <div className="space-y-5">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">{buyerForm}</div>
            <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500 shadow-sm">
              <ShieldCheck className="h-9 w-9 shrink-0 rounded-lg bg-emerald-50 p-2 text-emerald-600" />
              Thông tin của bạn được bảo mật. Chúng tôi không chia sẻ cho bên thứ ba.
            </div>
          </div>

          {/* Thẻ đơn hàng sticky */}
          <aside className="lg:sticky lg:top-6">
            <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-lg shadow-slate-200/60">
              {discountCodes}
              {orderSummary}
              {submitButton}
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
