'use client';

import { useEffect } from 'react';
import { X } from 'lucide-react';
import type { FunnelLanding } from '@coachio/api-client';
import { AdminFunnelSeoPanel } from './AdminFunnelSeoPanel';

interface AdminFunnelSeoModalProps {
  isOpen: boolean;
  onClose: () => void;
  funnelId: string;
  landing: FunnelLanding;
  onUpdated: (updated: FunnelLanding) => void;
}

/**
 * SEO configuration modal for the funnel landing.
 * Wraps AdminFunnelSeoPanel in a modal frame (same pattern as EmailVariablesModal).
 */
export function AdminFunnelSeoModal({ isOpen, onClose, funnelId, landing, onUpdated }: AdminFunnelSeoModalProps) {
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
    <div role="dialog" aria-modal="true" aria-label="SEO settings" className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/55" onClick={onClose} aria-hidden="true" />

      <div className="relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-[var(--coachio-admin-dashboard-radius-lg)] bg-[var(--coachio-admin-dashboard-surface)] shadow-[var(--coachio-admin-dashboard-shadow-modal)]">
        <div className="flex items-center gap-3 border-b border-[var(--coachio-admin-dashboard-border)] px-5 py-4">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--coachio-admin-dashboard-accent)]">SEO</p>
            <p className="mt-0.5 text-base font-bold text-[var(--coachio-admin-dashboard-text)]">Landing SEO settings</p>
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

        <div className="overflow-auto p-5">
          <AdminFunnelSeoPanel funnelId={funnelId} landing={landing} onUpdated={onUpdated} />
        </div>
      </div>
    </div>
  );
}
