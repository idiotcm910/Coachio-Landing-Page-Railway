'use client';

import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';

interface ConfirmOptions {
  title?: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'danger';
}

interface PendingConfirm extends ConfirmOptions {
  resolve: (ok: boolean) => void;
}

/**
 * Async confirm dialog hook — replaces window.confirm with a styled modal.
 * Returns `confirm(options): Promise<boolean>` to call imperatively and `modal`
 * ReactNode to render once near the root of the component.
 */
export function useConfirm() {
  const [pending, setPending] = useState<PendingConfirm | null>(null);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setPending({ ...options, resolve });
    });
  }, []);

  const handle = useCallback((ok: boolean) => {
    setPending((current) => {
      current?.resolve(ok);
      return null;
    });
  }, []);

  const modal = pending ? (
    <ConfirmDialog
      title={pending.title}
      message={pending.message}
      confirmLabel={pending.confirmLabel}
      cancelLabel={pending.cancelLabel}
      variant={pending.variant}
      onConfirm={() => handle(true)}
      onCancel={() => handle(false)}
    />
  ) : null;

  return { confirm, modal };
}

interface ConfirmDialogProps {
  title?: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'danger';
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Tiếp tục',
  cancelLabel = 'Hủy',
  variant = 'default',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    confirmRef.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onCancel();
      if (event.key === 'Enter' && document.activeElement === confirmRef.current) {
        onConfirm();
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel, onConfirm]);

  const confirmClass =
    variant === 'danger'
      ? 'bg-red-500 hover:bg-red-600 text-white'
      : 'bg-[var(--coachio-admin-dashboard-accent)] hover:opacity-90 text-white';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'confirm-modal-title' : undefined}
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 p-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md rounded-[var(--coachio-admin-dashboard-radius-md)] border border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface)] p-5 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        {title ? (
          <h2
            id="confirm-modal-title"
            className="mb-2 text-base font-semibold text-[var(--coachio-admin-dashboard-text)]"
          >
            {title}
          </h2>
        ) : null}
        <div className="text-sm text-[var(--coachio-admin-dashboard-text-muted)]">{message}</div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-[var(--coachio-admin-dashboard-radius-sm)] border border-[var(--coachio-admin-dashboard-border)] px-4 py-2 text-sm font-semibold text-[var(--coachio-admin-dashboard-text)] hover:bg-[var(--coachio-admin-dashboard-surface-muted)]"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            className={`rounded-[var(--coachio-admin-dashboard-radius-sm)] px-4 py-2 text-sm font-semibold ${confirmClass}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
