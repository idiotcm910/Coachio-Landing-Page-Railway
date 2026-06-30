// Shared Tailwind className tokens for the gift admin UI (mirrors AdminModal/shell
// conventions: Tailwind utilities + --coachio-admin-dashboard-* CSS vars).

export const FIELD = 'flex flex-col gap-1';
export const LABEL =
  'text-xs font-semibold uppercase tracking-wide text-[var(--coachio-admin-dashboard-text-soft)]';
export const INPUT =
  'h-9 w-full rounded-[var(--coachio-admin-dashboard-radius-sm)] border border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface)] px-3 text-sm text-[var(--coachio-admin-dashboard-text)] outline-none focus:border-[var(--coachio-admin-dashboard-accent)]';
export const TEXTAREA =
  'w-full rounded-[var(--coachio-admin-dashboard-radius-sm)] border border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface)] px-3 py-2 text-sm text-[var(--coachio-admin-dashboard-text)] outline-none focus:border-[var(--coachio-admin-dashboard-accent)]';
export const SELECT = INPUT;
export const BTN_PRIMARY =
  'inline-flex h-9 items-center justify-center gap-2 rounded-[var(--coachio-admin-dashboard-radius-sm)] bg-[var(--coachio-admin-dashboard-accent)] px-4 text-sm font-semibold text-[var(--coachio-admin-dashboard-text-inverse)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60';
export const BTN_SECONDARY =
  'inline-flex h-9 items-center justify-center gap-2 rounded-[var(--coachio-admin-dashboard-radius-sm)] border border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface)] px-4 text-sm font-semibold text-[var(--coachio-admin-dashboard-text-muted)] transition hover:bg-[var(--coachio-admin-dashboard-surface-hover)] disabled:opacity-60';
export const BTN_DANGER =
  'inline-flex h-9 items-center justify-center gap-2 rounded-[var(--coachio-admin-dashboard-radius-sm)] border border-[var(--coachio-admin-dashboard-danger-border,#fecaca)] bg-[var(--coachio-admin-dashboard-danger-bg,#fef2f2)] px-3 text-sm font-semibold text-[var(--coachio-admin-dashboard-danger-text,#dc2626)] transition hover:opacity-90';
export const PANEL =
  'rounded-[var(--coachio-admin-dashboard-radius-md,0.5rem)] border border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface)] p-4';
// --- Wizard tokens (chips, segmented controls, pills) ---
export const CHIP =
  'inline-flex cursor-pointer select-none items-center gap-2 rounded-full border border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface)] px-3 py-1.5 text-sm text-[var(--coachio-admin-dashboard-text)] transition';
export const CHIP_ON =
  'border-[var(--coachio-admin-dashboard-accent)] bg-[var(--coachio-admin-dashboard-accent-soft,#fff7ed)] font-semibold text-[var(--coachio-admin-dashboard-accent)]';
export const SEG_WRAP =
  'inline-flex flex-wrap gap-1 rounded-[var(--coachio-admin-dashboard-radius-sm)] border border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface-muted)] p-1';
export const SEG_BTN =
  'rounded-md px-3.5 py-2 text-sm text-[var(--coachio-admin-dashboard-text-muted)] transition';
export const SEG_BTN_ON =
  'bg-[var(--coachio-admin-dashboard-surface)] font-semibold text-[var(--coachio-admin-dashboard-text)] shadow-sm';
export const PILL =
  'rounded-full border border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface-muted)] px-2.5 py-1 text-xs';
export const COUNT_PILL =
  'inline-flex items-center gap-1.5 rounded-full border border-[var(--coachio-admin-dashboard-accent)] bg-[var(--coachio-admin-dashboard-accent-soft,#fff7ed)] px-3 py-1.5 text-xs font-bold text-[var(--coachio-admin-dashboard-accent)]';

export const TABLE = 'w-full border-collapse text-sm';
export const TH =
  'border-b border-[var(--coachio-admin-dashboard-border)] px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-[var(--coachio-admin-dashboard-text-soft)]';
export const TD =
  'border-b border-[var(--coachio-admin-dashboard-border)] px-3 py-2 text-[var(--coachio-admin-dashboard-text)] align-middle';

export const STATUS_BADGE: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-700',
  scheduled: 'bg-amber-100 text-amber-800',
  sending: 'bg-sky-100 text-sky-800',
  completed: 'bg-emerald-100 text-emerald-800',
  failed: 'bg-red-100 text-red-800',
  cancelled: 'bg-slate-200 text-slate-600',
  sent: 'bg-emerald-100 text-emerald-800',
  pending: 'bg-slate-100 text-slate-700',
};

export function badgeClass(status: string): string {
  const base = 'inline-flex rounded-full px-2 py-0.5 text-xs font-semibold';
  return `${base} ${STATUS_BADGE[status] ?? 'bg-slate-100 text-slate-700'}`;
}

export function formatVnDateTime(iso?: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-GB', { timeZone: 'Asia/Ho_Chi_Minh' });
  } catch {
    return iso;
  }
}
