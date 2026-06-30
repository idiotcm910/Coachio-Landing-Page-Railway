// Shared Tailwind class fragments for the Lucky Draw admin UI.
// Mirrors the CSS-var driven style used across the funnel admin workspaces.

export const inputClass =
  'rounded-[var(--coachio-admin-dashboard-radius-sm)] border border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface-muted)] px-3 py-2 text-sm text-[var(--coachio-admin-dashboard-text)] outline-none focus:border-[var(--coachio-admin-dashboard-accent)]';

export const cardClass =
  'rounded-[var(--coachio-admin-dashboard-radius-lg)] border border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface)] p-6 shadow-[var(--coachio-admin-dashboard-shadow-sm)]';

export const primaryButtonClass =
  'inline-flex h-10 items-center gap-2 rounded-[var(--coachio-admin-dashboard-radius-sm)] bg-[var(--coachio-admin-dashboard-accent)] px-4 text-sm font-semibold text-[var(--coachio-admin-dashboard-text-inverse)] transition hover:bg-[var(--coachio-admin-dashboard-accent-hover)] disabled:opacity-50';

export const ghostButtonClass =
  'inline-flex h-9 items-center gap-1.5 rounded-[var(--coachio-admin-dashboard-radius-sm)] border border-[var(--coachio-admin-dashboard-border)] px-3 text-sm font-semibold text-[var(--coachio-admin-dashboard-text-muted)] transition hover:bg-[var(--coachio-admin-dashboard-surface-hover)] hover:text-[var(--coachio-admin-dashboard-text)] disabled:opacity-50';

export const labelClass = 'text-xs font-semibold text-[var(--coachio-admin-dashboard-text-soft)]';
