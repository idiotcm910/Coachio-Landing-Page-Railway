'use client';

import { useState } from 'react';
import { funnelRevenueAnalyticsApi, type ProductRevenueRow } from '@coachio/api-client';
import { AdminProductRevenueDrawer } from './AdminProductRevenueDrawer';
import { AdminRollupRevenueTable } from './AdminRollupRevenueTable';
import type { AnalyticsDateRange } from './dateRange';

interface AdminProductRevenueTableProps {
  range: Required<AnalyticsDateRange>;
}

export function AdminProductRevenueTable({ range }: AdminProductRevenueTableProps) {
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);

  return (
    <>
      <AdminRollupRevenueTable<ProductRevenueRow>
        range={range}
        entityLabel="Product"
        note="Funnel-sourced revenue — the sum of all funnels that sell each product."
        fetcher={(params) => funnelRevenueAnalyticsApi.getRevenueByProduct(params)}
        getRowKey={(row) => row.product_id}
        onRowClick={(row) => setSelectedProductId(row.product_id)}
        renderName={(row) => (
          <div className="font-semibold text-[var(--coachio-admin-dashboard-text)]">{row.product_name || 'Unnamed product'}</div>
        )}
      />
      <AdminProductRevenueDrawer
        productId={selectedProductId}
        range={range}
        onClose={() => setSelectedProductId(null)}
      />
    </>
  );
}
