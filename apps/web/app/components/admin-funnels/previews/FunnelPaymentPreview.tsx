'use client';

import { Loader2 } from 'lucide-react';
import { FUNNEL_PREVIEW_SAMPLE, formatPreviewVnd } from './funnel-preview-sample';

interface FunnelPaymentPreviewProps {
  price?: number;
}

/**
 * Preview tĩnh của trang thanh toán QR (payment) public — mô phỏng FunnelPaymentPanel.
 * Không tương tác; dùng dữ liệu ngân hàng mẫu để minh hoạ bố cục QR + chi tiết chuyển khoản.
 */
export function FunnelPaymentPreview({ price }: FunnelPaymentPreviewProps) {
  const s = FUNNEL_PREVIEW_SAMPLE;
  const amount = price ?? s.price;

  const rows = [
    { label: 'Ngân hàng', value: s.bankName },
    { label: 'Số tài khoản', value: s.accountNumber },
    { label: 'Số tiền', value: formatPreviewVnd(amount) },
    { label: 'Nội dung chuyển khoản', value: s.orderCode },
  ];

  return (
    <div className="min-h-full bg-gray-50 py-10">
      <div className="pointer-events-none mx-auto max-w-3xl select-none px-4">
        <span className="mb-6 inline-flex items-center gap-1 text-sm text-gray-500">← Quay lại</span>

        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-6 py-5">
            <h2 className="text-xl font-bold text-gray-900">Hoàn tất thanh toán</h2>
          </div>

          <div className="grid grid-cols-1 gap-6 p-6 md:grid-cols-2 md:gap-8">
            {/* QR placeholder */}
            <div className="flex items-center justify-center">
              <div className="w-full max-w-xs text-center">
                <div className="mx-auto grid aspect-square w-full place-items-center rounded-xl border border-gray-200 bg-gray-100 text-xs font-semibold text-gray-400 shadow-sm">
                  QR Code
                </div>
                <p className="mt-4 text-sm text-gray-500">Quét mã QR bằng ứng dụng ngân hàng của bạn</p>
              </div>
            </div>

            {/* Bank details */}
            <div className="flex flex-col gap-4">
              {rows.map((row) => (
                <div key={row.label} className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-gray-500">{row.label}</label>
                  <div className="flex items-center justify-between gap-3 rounded-md border border-gray-200 bg-gray-50 px-3 py-2.5">
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-900">{row.value}</span>
                    <span className="shrink-0 rounded-md bg-orange-500 px-3 py-1.5 text-xs font-semibold text-white">Sao chép</span>
                  </div>
                </div>
              ))}
              <div className="rounded-md border-l-4 border-orange-500 bg-orange-50 px-4 py-3 text-sm text-gray-700">
                <strong className="text-orange-600">Quan trọng:</strong> Vui lòng nhập đúng nội dung chuyển khoản như trên.
              </div>
            </div>
          </div>

          <div className="border-t border-gray-200 bg-gray-50/60 px-6 py-4">
            <div className="flex items-center justify-center gap-2 text-sm font-medium text-gray-600">
              <Loader2 className="h-5 w-5 animate-spin text-orange-500" />
              Đang chờ xác nhận thanh toán...
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
