'use client';

import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface FunnelPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

/**
 * Modal "Xem toàn trang" — hiển thị preview trang funnel ở kích thước đầy đủ.
 * Dùng chung cho checkout / payment / success. Đóng bằng Escape hoặc backdrop.
 */
export function FunnelPreviewModal({ isOpen, onClose, title, children }: FunnelPreviewModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div role="dialog" aria-modal="true" aria-label={title} className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/55" onClick={onClose} aria-hidden="true" />

      <div className="relative flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-[var(--coachio-admin-dashboard-radius-lg)] bg-[var(--coachio-admin-dashboard-surface)] shadow-[var(--coachio-admin-dashboard-shadow-modal)]">
        <div className="flex items-center gap-3 border-b border-[var(--coachio-admin-dashboard-border)] px-5 py-4">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--coachio-admin-dashboard-accent)]">Preview</p>
            <p className="mt-0.5 text-base font-bold text-[var(--coachio-admin-dashboard-text)]">{title}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            title="Close"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--coachio-admin-dashboard-radius-sm)] border border-[var(--coachio-admin-dashboard-border)] text-[var(--coachio-admin-dashboard-text-muted)] transition hover:bg-[var(--coachio-admin-dashboard-surface-hover)] hover:text-[var(--coachio-admin-dashboard-text)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="overflow-auto bg-gray-50">{children}</div>
      </div>
    </div>
  );
}
