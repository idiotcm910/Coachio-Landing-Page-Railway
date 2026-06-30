'use client';

import { funnelRevenueAnalyticsApi, type FunnelRevenueRow } from '@coachio/api-client';
import { AdminRollupRevenueTable } from './AdminRollupRevenueTable';
import type { AnalyticsDateRange } from './dateRange';

interface AdminFunnelRevenueTableProps {
  range: Required<AnalyticsDateRange>;
}

export function AdminFunnelRevenueTable({ range }: AdminFunnelRevenueTableProps) {
  return (
    <AdminRollupRevenueTable<FunnelRevenueRow>
      range={range}
      entityLabel="Funnel"
      fetcher={(params) => funnelRevenueAnalyticsApi.getRevenueByFunnel(params)}
      getRowKey={(row) => row.funnel_id}
      renderName={(row) => (
        <>
          <div className="font-semibold text-[var(--coachio-admin-dashboard-text)]">{row.funnel_title}</div>
          <div className="text-xs text-[var(--coachio-admin-dashboard-text-muted)]">{row.funnel_slug}</div>
        </>
      )}
    />
  );
}
