'use client';

import { useEffect } from 'react';
import { AlertTriangle, Loader2, X } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Label shown on the confirm button while the action is in flight. */
  confirmingLabel?: string;
  tone?: 'danger' | 'default';
  isConfirming?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmDialog({
  isOpen,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  confirmingLabel = 'Deleting...',
  tone = 'default',
  isConfirming = false,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !isConfirming) {
        onClose();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isConfirming, isOpen, onClose]);

  if (!isOpen) return null;

  const confirmClass = tone === 'danger'
    ? 'bg-[var(--coachio-admin-dashboard-danger-text)] text-white hover:opacity-90'
    : 'bg-[var(--coachio-admin-dashboard-accent)] text-[var(--coachio-admin-dashboard-text-inverse)] hover:bg-[var(--coachio-admin-dashboard-accent-hover)]';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="presentation">
      <button
        type="button"
        aria-label="Close dialog"
        className="absolute inset-0 cursor-default bg-slate-950/50 backdrop-blur-sm"
        onClick={isConfirming ? undefined : onClose}
      />

      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-description"
        className="relative w-full max-w-md rounded-[var(--coachio-admin-dashboard-radius-lg)] border border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface)] p-5 text-[var(--coachio-admin-dashboard-text)] shadow-[var(--coachio-admin-dashboard-shadow-modal)]"
      >
        <div className="flex items-start gap-4">
          <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-[var(--coachio-admin-dashboard-radius-md)] ${tone === 'danger' ? 'bg-[var(--coachio-admin-dashboard-danger-bg)] text-[var(--coachio-admin-dashboard-danger-text)]' : 'bg-[var(--coachio-admin-dashboard-accent-soft)] text-[var(--coachio-admin-dashboard-accent)]'}`}>
            <AlertTriangle className="h-5 w-5" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <h2 id="confirm-dialog-title" className="text-lg font-semibold text-[var(--coachio-admin-dashboard-text)]">
                {title}
              </h2>
              <button
                type="button"
                onClick={onClose}
                disabled={isConfirming}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-[var(--coachio-admin-dashboard-radius-sm)] text-[var(--coachio-admin-dashboard-text-muted)] transition hover:bg-[var(--coachio-admin-dashboard-surface-hover)] hover:text-[var(--coachio-admin-dashboard-text)] disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Close dialog"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p id="confirm-dialog-description" className="mt-2 text-sm leading-6 text-[var(--coachio-admin-dashboard-text-muted)]">
              {description}
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={isConfirming}
            className="inline-flex h-10 items-center justify-center rounded-[var(--coachio-admin-dashboard-radius-sm)] border border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface)] px-4 text-sm font-semibold text-[var(--coachio-admin-dashboard-text)] transition hover:bg-[var(--coachio-admin-dashboard-surface-hover)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isConfirming}
            className={`inline-flex h-10 items-center justify-center gap-2 rounded-[var(--coachio-admin-dashboard-radius-sm)] px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${confirmClass}`}
          >
            {isConfirming ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {isConfirming ? confirmingLabel : confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
