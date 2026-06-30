'use client';

import { ExternalLink } from 'lucide-react';

interface AdminFunnelHeaderProps {
  title: string;
  slug: string;
}

export function AdminFunnelHeader({ title, slug }: AdminFunnelHeaderProps) {
  const previewUrl = `/funnels/${slug}`;

  return (
    <header className="flex items-center justify-between border-b border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface)] px-6 py-4 shadow-[var(--coachio-admin-dashboard-shadow-sm)]">
      <div className="flex min-w-0 items-center gap-3">
        <h2 className="truncate text-base font-semibold text-[var(--coachio-admin-dashboard-text)]">{title}</h2>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <a
          href={previewUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-9 items-center gap-2 rounded-[var(--coachio-admin-dashboard-radius-sm)] border border-[var(--coachio-admin-dashboard-border)] px-3 text-sm font-semibold text-[var(--coachio-admin-dashboard-text-muted)] hover:text-[var(--coachio-admin-dashboard-text)]"
        >
          <ExternalLink className="h-4 w-4" />
          Preview
        </a>
      </div>
    </header>
  );
}
