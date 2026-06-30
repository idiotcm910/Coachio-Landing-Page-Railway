'use client';

import type { LuckyEventStatus } from '@coachio/api-client';

const statusConfig: Record<LuckyEventStatus, { label: string; className: string }> = {
  draft: {
    label: 'Draft',
    className:
      'border-[var(--coachio-admin-dashboard-neutral-border)] bg-[var(--coachio-admin-dashboard-neutral-bg)] text-[var(--coachio-admin-dashboard-neutral-text)]',
  },
  open: {
    label: 'Open',
    className:
      'border-[var(--coachio-admin-dashboard-success-border)] bg-[var(--coachio-admin-dashboard-success-bg)] text-[var(--coachio-admin-dashboard-success-text)]',
  },
  locked: {
    label: 'Locked',
    className:
      'border-[var(--coachio-admin-dashboard-warning-border)] bg-[var(--coachio-admin-dashboard-warning-bg)] text-[var(--coachio-admin-dashboard-warning-text)]',
  },
  completed: {
    label: 'Completed',
    className:
      'border-[var(--coachio-admin-dashboard-accent-soft)] bg-[var(--coachio-admin-dashboard-accent-soft)] text-[var(--coachio-admin-dashboard-accent)]',
  },
};

export function LuckyEventStatusBadge({ status }: { status: LuckyEventStatus }) {
  const config = statusConfig[status] ?? statusConfig.draft;
  return (
    <span
      className={`inline-flex h-7 w-fit items-center rounded-[var(--coachio-admin-dashboard-radius-sm)] border px-2.5 text-xs font-semibold uppercase ${config.className}`}
    >
      {config.label}
    </span>
  );
}
