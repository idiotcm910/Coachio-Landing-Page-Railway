'use client';

import { useState } from 'react';
import { X, Check, Loader2 } from 'lucide-react';
import type { AppliedDiscountInfo } from '@coachio/api-client';
import { fieldInputClass } from '../shared/text-field';

interface FunnelDiscountCodesProps {
  codes: string[];
  appliedDiscounts: AppliedDiscountInfo[];
  onAdd: (code: string) => void;
  onRemove: (code: string) => void;
  loading: boolean;
}

/**
 * Chuyển reason code từ backend (engine discount) sang thông báo tiếng Việt
 * thân thiện cho người mua. Tránh hiển thị thẳng key kỹ thuật như "not_found".
 */
const DISCOUNT_REASON_LABELS: Record<string, string> = {
  not_found: 'Mã giảm giá không tồn tại',
  inactive: 'Mã giảm giá đã bị vô hiệu hóa',
  not_started: 'Mã giảm giá chưa đến thời gian áp dụng',
  expired: 'Mã giảm giá đã hết hạn',
  usage_limit_reached: 'Mã giảm giá đã hết lượt sử dụng',
  not_applicable_here: 'Mã giảm giá không áp dụng cho sản phẩm này',
};

function reasonLabel(reason?: string | null): string {
  if (!reason) return 'Mã giảm giá không hợp lệ';
  return DISCOUNT_REASON_LABELS[reason] ?? 'Mã giảm giá không hợp lệ';
}

export function FunnelDiscountCodes({
  codes,
  appliedDiscounts,
  onAdd,
  onRemove,
  loading,
}: FunnelDiscountCodesProps) {
  const [input, setInput] = useState('');

  const handleAdd = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    }
  };

  // Map code → discount info for status display
  const discountByCode = Object.fromEntries(appliedDiscounts.map((d) => [d.code, d]));

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-bold uppercase tracking-wide text-orange-600">Mã giảm giá</h3>

      {/* Input row */}
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Nhập mã giảm giá"
          className={`${fieldInputClass()} flex-1`}
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={loading || !input.trim()}
          className="rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Áp dụng'}
        </button>
      </div>

      {/* Applied codes list */}
      {codes.length > 0 && (
        <ul className="space-y-2">
          {codes.map((code) => {
            const info = discountByCode[code];
            const applied = info?.applied ?? false;
            const reason = info?.reason;

            return (
              <li
                key={code}
                className={`flex items-center justify-between rounded-lg border px-4 py-2.5 text-sm ${
                  applied
                    ? 'border-green-200 bg-green-50'
                    : 'border-red-200 bg-red-50'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {applied ? (
                    <Check className="h-4 w-4 shrink-0 text-green-600" />
                  ) : (
                    <X className="h-4 w-4 shrink-0 text-red-500" />
                  )}
                  <div className="min-w-0">
                    <span className={`font-semibold ${applied ? 'text-green-800' : 'text-red-700'}`}>
                      {code}
                    </span>
                    {!applied && (
                      <p className="truncate text-xs text-red-500">{reasonLabel(reason)}</p>
                    )}
                    {applied && info && (
                      <p className="text-xs text-green-700">
                        Áp dụng thành công · Giảm{' '}
                        {info.discount_type === 'percent'
                          ? `${info.discount_value}%`
                          : `${new Intl.NumberFormat('vi-VN').format(info.applied_amount)} VND`}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onRemove(code)}
                  aria-label={`Xóa mã ${code}`}
                  className="ml-3 shrink-0 text-gray-400 hover:text-gray-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
