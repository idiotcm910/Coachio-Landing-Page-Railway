'use client';

import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

export type ToastVariant = 'success' | 'error' | 'info';

export interface ToastOptions {
  id?: string;
  title?: string;
  message: ReactNode;
  variant?: ToastVariant;
  /** Auto-dismiss delay in ms. Pass 0 to disable auto-dismiss. Default 4000. */
  duration?: number;
}

interface ToastEntry extends Required<Omit<ToastOptions, 'title' | 'id'>> {
  id: string;
  title?: string;
}

interface ToastContextValue {
  toast: (options: ToastOptions) => string;
  success: (message: ReactNode, options?: Omit<ToastOptions, 'message' | 'variant'>) => string;
  error: (message: ReactNode, options?: Omit<ToastOptions, 'message' | 'variant'>) => string;
  info: (message: ReactNode, options?: Omit<ToastOptions, 'message' | 'variant'>) => string;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const DEFAULT_DURATION = 4000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);
  const counterRef = useRef(0);

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((entry) => entry.id !== id));
  }, []);

  const toast = useCallback((options: ToastOptions) => {
    counterRef.current += 1;
    const id = options.id ?? `toast-${Date.now()}-${counterRef.current}`;
    const entry: ToastEntry = {
      id,
      title: options.title,
      message: options.message,
      variant: options.variant ?? 'info',
      duration: options.duration ?? DEFAULT_DURATION,
    };
    setToasts((current) => [...current, entry]);
    return id;
  }, []);

  const value = useMemo<ToastContextValue>(() => ({
    toast,
    success: (message, options) => toast({ ...options, message, variant: 'success' }),
    error: (message, options) => toast({ ...options, message, variant: 'error' }),
    info: (message, options) => toast({ ...options, message, variant: 'info' }),
    dismiss,
  }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a <ToastProvider>');
  }
  return ctx;
}

function ToastViewport({ toasts, onDismiss }: { toasts: ToastEntry[]; onDismiss: (id: string) => void }) {
  return (
    <>
      <div
        role="region"
        aria-label="Notifications"
        className="pointer-events-none fixed right-4 top-4 z-[1100] flex w-[360px] max-w-[calc(100vw-2rem)] flex-col gap-2"
      >
        {toasts.map((entry) => (
          <ToastItem key={entry.id} entry={entry} onDismiss={onDismiss} />
        ))}
      </div>
      <style>{`
        @keyframes toast-slide-in {
          from { transform: translateX(110%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
        .toast-item { animation: toast-slide-in 0.22s cubic-bezier(.16,1,.3,1) both; }
      `}</style>
    </>
  );
}

const VARIANT_STYLES: Record<ToastVariant, { bg: string; border: string; text: string; Icon: typeof CheckCircle2 }> = {
  success: { bg: 'bg-emerald-50', border: 'border-emerald-300', text: 'text-emerald-900', Icon: CheckCircle2 },
  error: { bg: 'bg-red-50', border: 'border-red-300', text: 'text-red-900', Icon: AlertCircle },
  info: { bg: 'bg-sky-50', border: 'border-sky-300', text: 'text-sky-900', Icon: Info },
};

function ToastItem({ entry, onDismiss }: { entry: ToastEntry; onDismiss: (id: string) => void }) {
  const { id, title, message, variant, duration } = entry;
  const { bg, border, text, Icon } = VARIANT_STYLES[variant];

  useEffect(() => {
    if (duration <= 0) return undefined;
    const timer = window.setTimeout(() => onDismiss(id), duration);
    return () => window.clearTimeout(timer);
  }, [id, duration, onDismiss]);

  return (
    <div
      role={variant === 'error' ? 'alert' : 'status'}
      aria-live={variant === 'error' ? 'assertive' : 'polite'}
      className={`toast-item pointer-events-auto flex items-start gap-3 rounded-lg border ${border} ${bg} ${text} px-4 py-3 shadow-md`}
    >
      <Icon className="mt-0.5 h-5 w-5 shrink-0" />
      <div className="min-w-0 flex-1 text-sm">
        {title ? <p className="mb-0.5 font-semibold">{title}</p> : null}
        <div className="font-medium">{message}</div>
      </div>
      <button
        type="button"
        onClick={() => onDismiss(id)}
        aria-label="Close notification"
        className="-mr-1 rounded p-1 opacity-70 transition hover:bg-black/5 hover:opacity-100"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
