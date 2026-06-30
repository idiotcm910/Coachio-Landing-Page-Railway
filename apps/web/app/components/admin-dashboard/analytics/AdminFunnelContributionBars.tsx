'use client';

import type { FunnelRevenueRow } from '@coachio/api-client';
import { formatVnd } from './revenueShared';

interface AdminFunnelContributionBarsProps {
  funnels: FunnelRevenueRow[];
}

/** Horizontal revenue bars per funnel — bar length = share of the product total. */
export function AdminFunnelContributionBars({ funnels }: AdminFunnelContributionBarsProps) {
  const total = funnels.reduce((sum, funnel) => sum + funnel.revenue, 0);
  const max = Math.max(...funnels.map((funnel) => funnel.revenue), 1);

  if (!funnels.length) {
    return <p className="text-sm font-semibold text-[var(--coachio-admin-dashboard-text-muted)]">No funnel revenue in this date range.</p>;
  }

  return (
    <div className="space-y-3">
      {funnels.map((funnel) => {
        const share = total ? Math.round((funnel.revenue / total) * 100) : 0;
        const width = Math.max((funnel.revenue / max) * 100, 2);
        return (
          <div key={funnel.funnel_id}>
            <div className="mb-1 flex items-center justify-between gap-3 text-xs font-semibold text-[var(--coachio-admin-dashboard-text-muted)]">
              <span className="truncate text-[var(--coachio-admin-dashboard-text)]">{funnel.funnel_title}</span>
              <span className="shrink-0">{formatVnd(funnel.revenue)} · {share}% · {funnel.leads.total} leads</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-[var(--coachio-admin-dashboard-surface-hover)]">
              <div className="h-full rounded-full bg-[var(--coachio-admin-dashboard-accent)]" style={{ width: `${width}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
