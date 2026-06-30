'use client';

import { useEffect, useState } from 'react';
import { Monitor, Smartphone, X } from 'lucide-react';

interface EmailPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  previewHtml: string;
  previewSubject: string;
}

type ViewMode = 'desktop' | 'mobile';

/**
 * Modal preview email cỡ lớn cho admin xem chi tiết.
 * Iframe sandbox (KHÔNG allow-same-origin) — html đã sanitize từ BE.
 */
export function EmailPreviewModal({ isOpen, onClose, previewHtml, previewSubject }: EmailPreviewModalProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('desktop');

  // Đóng bằng phím Esc + khoá scroll nền khi mở
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

  const frameWidth = viewMode === 'mobile' ? '375px' : '100%';

  const toggleBtn = (mode: ViewMode, label: string, Icon: typeof Monitor) => (
    <button
      type="button"
      title={label}
      onClick={() => setViewMode(mode)}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-[6px] transition ${
        viewMode === mode
          ? 'bg-[var(--coachio-admin-dashboard-surface)] text-[var(--coachio-admin-dashboard-text)] shadow-[var(--coachio-admin-dashboard-shadow-sm)]'
          : 'text-[var(--coachio-admin-dashboard-text-muted)] hover:text-[var(--coachio-admin-dashboard-text)]'
      }`}
    >
      <Icon className="h-4 w-4" />
    </button>
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Xem trước email"
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
    >
      {/* Scrim */}
      <div className="absolute inset-0 bg-black/55" onClick={onClose} aria-hidden="true" />

      {/* Panel */}
      <div
        className="relative flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-[var(--coachio-admin-dashboard-radius-lg)] bg-[var(--coachio-admin-dashboard-surface)] shadow-[var(--coachio-admin-dashboard-shadow-modal)]"
      >
        {/* Header */}
        <div
          className="flex items-center gap-3 border-b px-4 py-3"
          style={{ borderColor: 'var(--coachio-admin-dashboard-border)' }}
        >
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-[var(--coachio-admin-dashboard-text)]">Xem trước email</p>
            <p className="mt-0.5 truncate text-xs text-[var(--coachio-admin-dashboard-text-muted)]">
              <span className="font-semibold">Subject:</span> {previewSubject || '—'}
            </p>
          </div>

          <div className="inline-flex rounded-[var(--coachio-admin-dashboard-radius-sm)] bg-[var(--coachio-admin-dashboard-surface-muted)] p-0.5">
            {toggleBtn('desktop', 'Desktop', Monitor)}
            {toggleBtn('mobile', 'Mobile', Smartphone)}
          </div>

          <button
            type="button"
            onClick={onClose}
            title="Đóng"
            className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--coachio-admin-dashboard-radius-sm)] border border-[var(--coachio-admin-dashboard-border)] text-[var(--coachio-admin-dashboard-text-muted)] transition hover:bg-[var(--coachio-admin-dashboard-surface-hover)] hover:text-[var(--coachio-admin-dashboard-text)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Iframe area */}
        <div className="flex-1 overflow-auto bg-[var(--coachio-admin-dashboard-surface-muted)] p-4">
          <div className="mx-auto transition-all" style={{ width: frameWidth, maxWidth: '100%' }}>
            <iframe
              title="Email preview lớn"
              srcDoc={previewHtml || '<html><body style="font-family:sans-serif;padding:16px;color:#6b7280;">Chưa có nội dung preview.</body></html>'}
              sandbox="allow-popups"
              className="w-full rounded-[var(--coachio-admin-dashboard-radius-sm)] border bg-white"
              style={{ borderColor: 'var(--coachio-admin-dashboard-border)', minHeight: '70vh', display: 'block' }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
