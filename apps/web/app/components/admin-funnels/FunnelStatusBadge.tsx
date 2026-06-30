'use client';

import type { FunnelStatus } from '@coachio/api-client';

const statusConfig: Record<FunnelStatus, { label: string; className: string }> = {
  draft: {
    label: 'Draft',
    className:
      'border-[var(--coachio-admin-dashboard-warning-border)] bg-[var(--coachio-admin-dashboard-warning-bg)] text-[var(--coachio-admin-dashboard-warning-text)]',
  },
  published: {
    label: 'Published',
    className:
      'border-[var(--coachio-admin-dashboard-success-border)] bg-[var(--coachio-admin-dashboard-success-bg)] text-[var(--coachio-admin-dashboard-success-text)]',
  },
  archived: {
    label: 'Archived',
    className:
      'border-[var(--coachio-admin-dashboard-neutral-border)] bg-[var(--coachio-admin-dashboard-neutral-bg)] text-[var(--coachio-admin-dashboard-neutral-text)]',
  },
};

export function FunnelStatusBadge({ status }: { status: FunnelStatus }) {
  const config = statusConfig[status] ?? statusConfig.draft;
  return (
    <span
      className={`inline-flex h-7 w-fit items-center rounded-[var(--coachio-admin-dashboard-radius-sm)] border px-2.5 text-xs font-semibold uppercase ${config.className}`}
    >
      {config.label}
    </span>
  );
}
