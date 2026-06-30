'use client';

import { useState } from 'react';
import { AdminAnalyticsDateRange } from './AdminAnalyticsDateRange';
import { AdminFunnelRevenueTable } from './AdminFunnelRevenueTable';
import { AdminProductRevenueTable } from './AdminProductRevenueTable';
import { getDefaultAnalyticsDateRange, type AnalyticsDateRange } from './dateRange';

type RevenueTabId = 'funnel' | 'product';

const TABS: { id: RevenueTabId; label: string }[] = [
  { id: 'funnel', label: 'Funnel' },
  { id: 'product', label: 'Product' },
];

export function AdminRevenueTabs() {
  const [range, setRange] = useState<Required<AnalyticsDateRange>>(() => getDefaultAnalyticsDateRange());
  const [activeTab, setActiveTab] = useState<RevenueTabId>('funnel');

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--coachio-admin-dashboard-text-soft)]">Analytics</p>
        <h2 className="text-2xl font-semibold text-[var(--coachio-admin-dashboard-text)]">Revenue</h2>
      </div>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Revenue breakdown">
        {TABS.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-[var(--coachio-admin-dashboard-radius-sm)] border px-4 py-2 text-sm font-semibold transition ${
                isActive
                  ? 'border-[var(--coachio-admin-dashboard-accent)] bg-[var(--coachio-admin-dashboard-accent-soft)] text-[var(--coachio-admin-dashboard-accent)]'
                  : 'border-[var(--coachio-admin-dashboard-border)] text-[var(--coachio-admin-dashboard-text-muted)] hover:border-[var(--coachio-admin-dashboard-accent)] hover:text-[var(--coachio-admin-dashboard-accent)]'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <AdminAnalyticsDateRange value={range} onChange={setRange} />

      {activeTab === 'funnel' ? <AdminFunnelRevenueTable range={range} /> : null}
      {activeTab === 'product' ? <AdminProductRevenueTable range={range} /> : null}
    </div>
  );
}
