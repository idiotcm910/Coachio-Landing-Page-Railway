'use client';

import { Maximize2 } from 'lucide-react';
import type { ReactNode } from 'react';

export interface PreviewTab {
  id: string;
  label: string;
}

interface FunnelConfigWithPreviewProps {
  /** Cột trái: form cấu hình. */
  form: ReactNode;
  /** Cột phải: nội dung preview. */
  preview: ReactNode;
  /** Tab chuyển preview (tuỳ chọn, vd Checkout | Thanh toán). */
  tabs?: PreviewTab[];
  activeTab?: string;
  onTabChange?: (id: string) => void;
  /** Mở modal xem toàn trang. */
  onOpenFull: () => void;
}

/**
 * Bố cục 2 cột dùng chung cho màn cấu hình funnel:
 * trái = form cấu hình, phải = preview (kèm tab tuỳ chọn + nút "Xem toàn trang").
 */
export function FunnelConfigWithPreview({
  form,
  preview,
  tabs,
  activeTab,
  onTabChange,
  onOpenFull,
}: FunnelConfigWithPreviewProps) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:h-full lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
      {/* Cột trái: cấu hình — cuộn nội bộ để không kéo cao layout */}
      <div className="min-w-0 space-y-6 lg:h-full lg:min-h-0 lg:overflow-y-auto lg:pr-1">{form}</div>

      {/* Cột phải: preview — fill đúng chiều cao vùng nội dung (không dư, không thiếu) */}
      <div className="min-w-0 lg:h-full lg:min-h-0">
        <div className="flex h-[70vh] min-h-[520px] flex-col overflow-hidden rounded-[var(--coachio-admin-dashboard-radius-lg)] border border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface)] shadow-[var(--coachio-admin-dashboard-shadow-sm)] lg:h-full lg:min-h-0">
          {/* Thanh tiêu đề preview */}
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--coachio-admin-dashboard-border)] px-4 py-3">
            {tabs && tabs.length > 0 ? (
              <div className="inline-flex items-center gap-1 rounded-[var(--coachio-admin-dashboard-radius-md)] border border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface-muted)] p-1">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => onTabChange?.(tab.id)}
                    className={`h-8 rounded-[var(--coachio-admin-dashboard-radius-sm)] px-3 text-xs font-semibold transition ${
                      activeTab === tab.id
                        ? 'bg-[var(--coachio-admin-dashboard-surface)] text-[var(--coachio-admin-dashboard-accent)] shadow-[var(--coachio-admin-dashboard-shadow-sm)]'
                        : 'text-[var(--coachio-admin-dashboard-text-muted)] hover:text-[var(--coachio-admin-dashboard-text)]'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            ) : (
              <span className="text-xs font-semibold uppercase tracking-wide text-[var(--coachio-admin-dashboard-text-muted)]">
                Preview
              </span>
            )}

            <button
              type="button"
              onClick={onOpenFull}
              className="inline-flex h-8 items-center gap-1.5 rounded-[var(--coachio-admin-dashboard-radius-sm)] border border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface)] px-3 text-xs font-semibold text-[var(--coachio-admin-dashboard-text)] transition hover:bg-[var(--coachio-admin-dashboard-surface-hover)]"
            >
              <Maximize2 className="h-3.5 w-3.5" />
              Full preview
            </button>
          </div>

          {/* Khung preview cuộn được */}
          <div className="min-h-0 flex-1 overflow-auto bg-gray-50">{preview}</div>
        </div>
      </div>
    </div>
  );
}
