'use client';

import { type KeyboardEvent, type ReactNode, useCallback, useEffect, useState } from 'react';
import { ReceiptText, TrendingUp } from 'lucide-react';
import {
  getApiErrorMessage,
  type LeadStatusBreakdown,
  type RevenueScopeSummary,
} from '@coachio/api-client';
import { AdminAnalyticsError } from './AdminAnalyticsError';
import { AdminAnalyticsSkeleton } from './AdminAnalyticsSkeleton';
import { AdminPagination } from './AdminPagination';
import { AnalyticsEmptyRow, KpiCard, formatConversion, formatVnd } from './revenueShared';
import { buildAnalyticsQueryRange, type AnalyticsDateRange } from './dateRange';

const PAGE_SIZE = 10;

/** Shape shared by funnel and product revenue rows. */
export interface RollupRevenueRow {
  revenue: number;
  paid_orders: number;
  leads: LeadStatusBreakdown;
  conversion_rate: number;
}

interface RollupRevenuePage<T> {
  summary: RevenueScopeSummary;
  meta: { page: number; pageSize: number; totalPages: number; totalItems: number };
  result: T[];
}

interface AdminRollupRevenueTableProps<T extends RollupRevenueRow> {
  range: Required<AnalyticsDateRange>;
  /** Column header + title for the grouped entity (e.g. "Funnel", "Product"). */
  entityLabel: string;
  /** Optional note rendered under the table title (e.g. scope caveat). */
  note?: string;
  fetcher: (params: { startDate?: string; endDate?: string; page: number; pageSize: number }) => Promise<RollupRevenuePage<T>>;
  getRowKey: (row: T) => string;
  renderName: (row: T) => ReactNode;
  /** When provided, rows become interactive (clickable + keyboard-focusable). */
  onRowClick?: (row: T) => void;
}

function LeadBreakdownCell({ leads }: { leads: LeadStatusBreakdown }) {
  return (
    <div>
      <div className="font-semibold text-[var(--coachio-admin-dashboard-text)]">{leads.total}</div>
      <div className="text-xs text-[var(--coachio-admin-dashboard-text-muted)]">
        {leads.subscribed} subscribed · {leads.lead} lead · {leads.purchased} purchased
      </div>
    </div>
  );
}

export function AdminRollupRevenueTable<T extends RollupRevenueRow>({
  range,
  entityLabel,
  note,
  fetcher,
  getRowKey,
  renderName,
  onRowClick,
}: AdminRollupRevenueTableProps<T>) {
  const [data, setData] = useState<RollupRevenuePage<T> | null>(null);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    setPage(1);
  }, [range]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const queryRange = buildAnalyticsQueryRange(range);
      setData(await fetcher({ ...queryRange, page, pageSize: PAGE_SIZE }));
    } catch (caught) {
      setError(getApiErrorMessage(caught, `Load ${entityLabel.toLowerCase()} revenue failed`));
    } finally {
      setIsLoading(false);
    }
  }, [entityLabel, fetcher, page, range]);

  useEffect(() => {
    loadData();
  }, [loadData, reloadKey]);

  if (isLoading) return <AdminAnalyticsSkeleton rows={5} />;
  if (error) return <AdminAnalyticsError message={error} onRetry={() => setReloadKey((current) => current + 1)} />;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2">
        <KpiCard label="Total revenue" value={formatVnd(data?.summary.total_revenue || 0)} icon={TrendingUp} tone="accent" />
        <KpiCard label="Paid orders" value={String(data?.summary.paid_orders || 0)} icon={ReceiptText} tone="info" />
      </div>

      <div className="overflow-hidden rounded-[var(--coachio-admin-dashboard-radius-lg)] border border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface)] shadow-[var(--coachio-admin-dashboard-shadow-sm)]">
        <div className="border-b border-[var(--coachio-admin-dashboard-border)] px-4 py-4">
          <h3 className="text-base font-semibold text-[var(--coachio-admin-dashboard-text)]">Revenue by {entityLabel.toLowerCase()}</h3>
          {note ? <p className="mt-1 text-xs text-[var(--coachio-admin-dashboard-text-muted)]">{note}</p> : null}
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-[var(--coachio-admin-dashboard-border)] text-sm">
            <thead className="bg-[var(--coachio-admin-dashboard-surface-muted)] text-left text-xs font-semibold uppercase text-[var(--coachio-admin-dashboard-text-soft)]">
              <tr>
                <th className="px-4 py-3">{entityLabel}</th>
                <th className="px-4 py-3">Paid orders</th>
                <th className="px-4 py-3">Leads</th>
                <th className="px-4 py-3">Conversion</th>
                <th className="px-4 py-3 text-right">Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--coachio-admin-dashboard-border-subtle)]">
              {data?.result.length ? data.result.map((row) => (
                <tr
                  key={getRowKey(row)}
                  {...(onRowClick ? {
                    role: 'button',
                    tabIndex: 0,
                    onClick: () => onRowClick(row),
                    onKeyDown: (event: KeyboardEvent<HTMLTableRowElement>) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        onRowClick(row);
                      }
                    },
                  } : {})}
                  className={onRowClick ? 'cursor-pointer hover:bg-[var(--coachio-admin-dashboard-surface-hover)]' : undefined}
                >
                  <td className="px-4 py-3">{renderName(row)}</td>
                  <td className="px-4 py-3 font-semibold">{row.paid_orders}</td>
                  <td className="px-4 py-3"><LeadBreakdownCell leads={row.leads} /></td>
                  <td className="px-4 py-3 font-semibold">{formatConversion(row.conversion_rate)}</td>
                  <td className="px-4 py-3 text-right font-semibold">{formatVnd(row.revenue)}</td>
                </tr>
              )) : <AnalyticsEmptyRow colSpan={5} />}
            </tbody>
          </table>
        </div>
        {data ? <AdminPagination page={data.meta.page} pageSize={data.meta.pageSize} totalPages={data.meta.totalPages} totalItems={data.meta.totalItems} onPageChange={setPage} /> : null}
      </div>
    </div>
  );
}
