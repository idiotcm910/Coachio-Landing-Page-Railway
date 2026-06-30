// Shared formatters + badge token helpers for the admin orders screens.
// Currency/date formatting and badge → design-token mapping live here so the
// table, row and detail drawer stay visually consistent (DRY).

const currencyFormatter = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
});

const dateTimeFormatter = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export function formatCurrencyVnd(value: number): string {
  return currencyFormatter.format(value ?? 0);
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return dateTimeFormatter.format(parsed);
}

/** Inline CSS-variable colours so badges never hardcode hex. */
export interface BadgeTokens {
  label: string;
  background: string;
  color: string;
  border: string;
}

function tone(prefix: 'success' | 'warning' | 'danger' | 'info' | 'neutral', label: string): BadgeTokens {
  return {
    label,
    background: `var(--coachio-admin-dashboard-${prefix}-bg)`,
    color: `var(--coachio-admin-dashboard-${prefix}-text)`,
    border: `var(--coachio-admin-dashboard-${prefix}-border)`,
  };
}

const STATUS_LABELS: Record<string, string> = {
  SUCCESS: 'Success',
  PENDING: 'Pending',
  CANCELLED: 'Cancelled',
};

export function statusBadge(status: string): BadgeTokens {
  const label = STATUS_LABELS[status] ?? status;
  if (status === 'SUCCESS') return tone('success', label);
  if (status === 'PENDING') return tone('warning', label);
  if (status === 'CANCELLED') return tone('danger', label);
  return tone('neutral', label);
}

export function vatBadge(): BadgeTokens {
  return tone('info', 'VAT');
}

export function workshopBadge(): BadgeTokens {
  return tone('neutral', 'Workshop');
}
