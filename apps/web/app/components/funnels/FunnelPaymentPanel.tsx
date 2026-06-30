'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2, Check } from 'lucide-react';
import { funnelsApi } from '@coachio/api-client';
import type { FunnelCheckoutResult } from '@coachio/api-client';
import { FunnelQrSkeleton } from './funnel-skeletons';

interface FunnelPaymentPanelProps {
  result: FunnelCheckoutResult;
  onSuccess: () => void;
  onBack: () => void;
}

const POLL_INTERVAL = 2000;
const MAX_POLL_TIME = 15 * 60 * 1000;

function fmt(amount: number): string {
  return new Intl.NumberFormat('vi-VN').format(amount) + ' VND';
}

export function FunnelPaymentPanel({ result, onSuccess, onBack }: FunnelPaymentPanelProps) {
  const [copied, setCopied] = useState<string | null>(null);
  const [qrLoaded, setQrLoaded] = useState(false);
  const [isPolling, setIsPolling] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pollingRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    startTimeRef.current = Date.now();
    setIsPolling(true);
    setError(null);

    const poll = async () => {
      try {
        const status = await funnelsApi.getFunnelOrderStatus(result.order_id);
        if (status.status === 'SUCCESS') {
          setIsPolling(false);
          onSuccess();
          return;
        }
        if (status.status === 'CANCELLED' || status.status === 'FAILED') {
          setIsPolling(false);
          setError('Thanh toán thất bại hoặc đã bị hủy.');
          return;
        }
        if (Date.now() - startTimeRef.current > MAX_POLL_TIME) {
          setIsPolling(false);
          setError('Hết thời gian chờ thanh toán. Vui lòng thử lại.');
          return;
        }
        pollingRef.current = setTimeout(poll, POLL_INTERVAL);
      } catch {
        pollingRef.current = setTimeout(poll, POLL_INTERVAL);
      }
    };

    poll();

    return () => {
      if (pollingRef.current) clearTimeout(pollingRef.current);
    };
  }, [result.order_id, onSuccess]);

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(field);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // clipboard not available
    }
  };

  const bankLogoUrl = result.bank_name
    ? `https://qr.sepay.vn/assets/img/banklogo/${result.bank_name}.png`
    : null;

  const detailRows = [
    result.bank_name && { key: 'bank', label: 'Ngân hàng', display: result.bank_name, copy: result.bank_name },
    result.account_number && { key: 'account', label: 'Số tài khoản', display: result.account_number, copy: result.account_number },
    { key: 'amount', label: 'Số tiền', display: fmt(result.final_amount), copy: String(result.final_amount) },
    { key: 'content', label: 'Nội dung chuyển khoản', display: result.order_code, copy: result.order_code },
  ].filter(Boolean) as Array<{ key: string; label: string; display: string; copy: string }>;

  return (
    <main className="min-h-screen bg-gray-50 py-10">
      <div className="mx-auto max-w-3xl px-4">
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          {/* Header */}
          <div className="border-b border-gray-200 px-6 py-5">
            <h2 className="text-xl font-bold text-gray-900">Hoàn tất thanh toán</h2>
          </div>

          {error ? (
            <div className="px-6 py-10 text-center">
              <p className="mb-5 text-red-600">{error}</p>
              <button
                type="button"
                onClick={onBack}
                className="rounded-md bg-gray-100 px-6 py-2 font-semibold text-gray-700 hover:bg-gray-200"
              >
                Quay lại
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-6 p-6 md:grid-cols-2 md:gap-8">
                {/* QR code */}
                <div className="flex items-center justify-center">
                  <div className="w-full max-w-xs text-center">
                    {result.qr_url && (
                      <>
                        {!qrLoaded && <FunnelQrSkeleton />}
                        <img
                          src={result.qr_url}
                          alt="Mã QR thanh toán"
                          onLoad={() => setQrLoaded(true)}
                          className={`mx-auto w-full rounded-xl border border-gray-200 shadow-sm ${qrLoaded ? '' : 'hidden'}`}
                        />
                      </>
                    )}
                    <p className="mt-4 text-sm text-gray-500">
                      Quét mã QR bằng ứng dụng ngân hàng của bạn
                    </p>
                  </div>
                </div>

                {/* Bank details */}
                <div className="flex flex-col gap-5">
                  {bankLogoUrl && (
                    <div className="flex items-center justify-center border-b border-gray-200 pb-4">
                      <img
                        src={bankLogoUrl}
                        alt={result.bank_name ?? ''}
                        className="h-12 w-auto object-contain"
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      />
                    </div>
                  )}

                  <div className="flex flex-col gap-4">
                    {detailRows.map((row) => (
                      <div key={row.key} className="flex flex-col gap-1.5">
                        <label className="text-sm font-medium text-gray-500">{row.label}</label>
                        <div className="flex items-center justify-between gap-3 rounded-md border border-gray-200 bg-gray-50 px-3 py-2.5">
                          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-900">
                            {row.display}
                          </span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(row.copy, row.key)}
                            className="flex shrink-0 items-center gap-1 rounded-md bg-orange-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-600"
                          >
                            {copied === row.key ? (
                              <><Check className="h-3.5 w-3.5" />Đã chép</>
                            ) : 'Copy'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="rounded-md border-l-4 border-orange-500 bg-orange-50 px-4 py-3 text-sm text-gray-700">
                    <strong className="text-orange-600">Quan trọng:</strong> Vui lòng nhập chính xác nội dung chuyển khoản như hiển thị ở trên.
                  </div>
                </div>
              </div>

              {/* Status bar */}
              <div className="border-t border-gray-200 bg-gray-50/60 px-6 py-4">
                {isPolling && (
                  <div className="flex items-center justify-center gap-2 text-sm font-medium text-gray-600">
                    <Loader2 className="h-5 w-5 animate-spin text-orange-500" />
                    Đang chờ xác nhận thanh toán...
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
