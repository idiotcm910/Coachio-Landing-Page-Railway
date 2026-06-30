'use client';

/**
 * Skeleton loaders cho các trang public funnel (checkout / payment QR / success).
 * Dùng theme slate + `animate-pulse` để khớp giao diện public (không phải token admin).
 */

function Bar({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-slate-200 ${className}`} />;
}

/** Skeleton trang checkout — mô phỏng layout 2 cột (hero + form) khi đang tải quote. */
export function FunnelCheckoutSkeleton() {
  return (
    <main className="min-h-screen bg-slate-100 py-0 lg:py-10" aria-busy="true" aria-label="Đang tải trang thanh toán">
      <div className="mx-auto w-full max-w-5xl lg:px-4">
        <div className="overflow-hidden bg-white shadow-xl shadow-slate-200/60 lg:rounded-3xl">
          <div className="grid lg:grid-cols-2">
            {/* Hero */}
            <div className="space-y-4 bg-slate-100 p-8 lg:p-10">
              <Bar className="h-4 w-24" />
              <Bar className="h-9 w-3/4" />
              <Bar className="h-9 w-2/3" />
              <Bar className="h-4 w-full" />
              <Bar className="h-4 w-5/6" />
            </div>
            {/* Form */}
            <div className="space-y-6 p-6 sm:p-8 lg:p-10">
              <Bar className="h-5 w-40" />
              <div className="space-y-4">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="space-y-1.5">
                    <Bar className="h-3 w-24" />
                    <Bar className="h-11 w-full" />
                  </div>
                ))}
              </div>
              <Bar className="h-px w-full" />
              <div className="space-y-2">
                <Bar className="h-4 w-full" />
                <Bar className="h-4 w-2/3" />
              </div>
              <Bar className="h-14 w-full rounded-xl" />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

/** Skeleton thẻ trang success — khi đang poll trạng thái đơn. */
export function FunnelSuccessSkeleton() {
  return (
    <div className="flex flex-col items-center gap-4" aria-busy="true" aria-label="Đang tải thông tin đơn hàng">
      <div className="h-16 w-16 animate-pulse rounded-full bg-slate-200" />
      <Bar className="h-6 w-40" />
      <Bar className="h-4 w-56" />
      <Bar className="mt-2 h-12 w-full rounded-xl" />
      <Bar className="h-12 w-full rounded-xl" />
    </div>
  );
}

/** Skeleton ô vuông cho ảnh QR — hiển thị trong lúc ảnh QR (sepay) đang tải. */
export function FunnelQrSkeleton() {
  return <div className="mx-auto aspect-square w-full max-w-xs animate-pulse rounded-xl bg-slate-200" />;
}
