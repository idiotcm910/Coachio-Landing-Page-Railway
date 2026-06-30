'use client';

import type { LucideIcon } from 'lucide-react';

export const cardToneClassName = {
  accent: 'bg-[var(--coachio-admin-dashboard-accent-soft)] text-[var(--coachio-admin-dashboard-accent)]',
  info: 'bg-[var(--coachio-admin-dashboard-info-bg)] text-[var(--coachio-admin-dashboard-info-text)]',
  success: 'bg-[var(--coachio-admin-dashboard-success-bg)] text-[var(--coachio-admin-dashboard-success-text)]',
  warning: 'bg-[var(--coachio-admin-dashboard-warning-bg)] text-[var(--coachio-admin-dashboard-warning-text)]',
} as const;

export type CardTone = keyof typeof cardToneClassName;

export function formatVnd(amount: number): string {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(amount);
}

/** A 0–1 conversion ratio rendered as a whole-percent label (e.g. 0.25 → "25%"). */
export function formatConversion(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}

export function KpiCard({ label, value, icon: Icon, tone }: { label: string; value: string; icon: LucideIcon; tone: CardTone }) {
  return (
    <div className="rounded-[var(--coachio-admin-dashboard-radius-md)] border border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface)] p-4 shadow-[var(--coachio-admin-dashboard-shadow-sm)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-[var(--coachio-admin-dashboard-text-muted)]">{label}</p>
          <strong className="mt-2 block text-2xl font-semibold text-[var(--coachio-admin-dashboard-text)]">{value}</strong>
        </div>
        <div className={`grid h-10 w-10 place-items-center rounded-[var(--coachio-admin-dashboard-radius-sm)] ${cardToneClassName[tone]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

export function AnalyticsEmptyRow({ colSpan }: { colSpan: number }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-8 text-center text-sm font-semibold text-[var(--coachio-admin-dashboard-text-muted)]">
        No data for this date range.
      </td>
    </tr>
  );
}
