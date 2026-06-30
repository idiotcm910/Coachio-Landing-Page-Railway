'use client';

import { Loader2 } from 'lucide-react';
import type { FunnelQuote } from '@coachio/api-client';

interface FunnelOrderSummaryProps {
  quote: FunnelQuote | null;
  loading: boolean;
  error: string | null;
}

function fmt(amount: number, currency = 'VND'): string {
  return new Intl.NumberFormat('vi-VN').format(amount) + ' ' + currency;
}

export function FunnelOrderSummary({ quote, loading, error }: FunnelOrderSummaryProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-bold uppercase tracking-wide text-orange-600">Tóm tắt đơn hàng</h3>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {loading && !quote && (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Đang tải...
        </div>
      )}

      {quote && (
        <div className="space-y-2 text-sm text-gray-700">
          <div className="flex justify-between">
            <span>Tạm tính</span>
            <span>{fmt(quote.subtotal_amount, quote.currency)}</span>
          </div>

          {quote.discount_amount > 0 && (
            <div className="flex justify-between text-green-700">
              <span>Giảm giá</span>
              <span>- {fmt(quote.discount_amount, quote.currency)}</span>
            </div>
          )}

          <div className="flex justify-between border-t border-gray-200 pt-2 text-base font-bold text-gray-900">
            <span>Tổng cộng</span>
            <span className={quote.is_free ? 'text-green-600' : ''}>
              {quote.is_free ? 'Miễn phí' : fmt(quote.final_amount, quote.currency)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
