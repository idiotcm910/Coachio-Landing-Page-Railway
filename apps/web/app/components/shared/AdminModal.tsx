'use client';

import { type ReactNode, useEffect } from 'react';
import { X } from 'lucide-react';

interface AdminModalProps {
  title: string;
  subtitle?: string;
  onClose: () => void;
  /** Sticky footer content (e.g. Cancel / Save buttons). */
  footer?: ReactNode;
  children: ReactNode;
  /** Tailwind max-width class for the card (default `max-w-lg`). */
  maxWidthClassName?: string;
  ariaLabel?: string;
}

/**
 * Shared admin modal shell — the single source of truth for the admin-dashboard
 * modal pattern (centered overlay, surface card, sticky header/footer, scrollable
 * body). Mirrors VariablesModal/AdminFunnelSeoModal so every admin dialog looks
 * and behaves identically. Closes on backdrop click and Escape; locks body scroll.
 */
export function AdminModal({
  title,
  subtitle,
  onClose,
  footer,
  children,
  maxWidthClassName = 'max-w-lg',
  ariaLabel,
}: AdminModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel ?? title}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
    >
      <div className="absolute inset-0 bg-black/55" onClick={onClose} aria-hidden="true" />

      <div
        className={`relative flex max-h-[88vh] w-full ${maxWidthClassName} flex-col overflow-hidden rounded-[var(--coachio-admin-dashboard-radius-lg)] bg-[var(--coachio-admin-dashboard-surface)] shadow-[var(--coachio-admin-dashboard-shadow-modal)]`}
      >
        {/* Header */}
        <div className="flex items-start gap-3 border-b border-[var(--coachio-admin-dashboard-border)] px-5 py-4">
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-bold text-[var(--coachio-admin-dashboard-text)]">{title}</p>
            {subtitle && (
              <p className="mt-0.5 text-xs text-[var(--coachio-admin-dashboard-text-muted)]">{subtitle}</p>
            )}
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

        {/* Body (scrolls) */}
        <div className="overflow-auto p-5">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="flex justify-end gap-3 border-t border-[var(--coachio-admin-dashboard-border)] px-5 py-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
