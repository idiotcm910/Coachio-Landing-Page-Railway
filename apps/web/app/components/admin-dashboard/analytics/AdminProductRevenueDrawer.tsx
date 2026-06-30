'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { CreditCard, ReceiptText, TrendingUp, Users, X } from 'lucide-react';
import {
  funnelRevenueAnalyticsApi,
  getApiErrorMessage,
  type ProductRevenueDetail,
} from '@coachio/api-client';
import { AdminFunnelContributionBars } from './AdminFunnelContributionBars';
import { AdminLeadStatusDonut } from './AdminLeadStatusDonut';
import { AdminRevenueAreaChart } from './AdminRevenueAreaChart';
import { AnalyticsEmptyRow, KpiCard, formatConversion, formatVnd } from './revenueShared';
import { buildAnalyticsQueryRange, type AnalyticsDateRange } from './dateRange';

interface AdminProductRevenueDrawerProps {
  productId: string | null;
  range: Required<AnalyticsDateRange>;
  onClose: () => void;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[var(--coachio-admin-dashboard-radius-lg)] border border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface)] p-4">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--coachio-admin-dashboard-text-soft)]">{title}</h3>
      {children}
    </div>
  );
}

export function AdminProductRevenueDrawer({ productId, range, onClose }: AdminProductRevenueDrawerProps) {
  const [detail, setDetail] = useState<ProductRevenueDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const loadDetail = useCallback(async () => {
    if (!productId) return;
    setIsLoading(true);
    setError('');
    try {
      setDetail(await funnelRevenueAnalyticsApi.getProductRevenueDetail(productId, buildAnalyticsQueryRange(range)));
    } catch (caught) {
      setError(getApiErrorMessage(caught, 'Load product detail failed'));
    } finally {
      setIsLoading(false);
    }
  }, [productId, range]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  if (!productId) return null;

  return (
    <div className="fixed inset-0 z-50">
      <button type="button" className="absolute inset-0 bg-slate-950/40" aria-label="Close product detail" onClick={onClose} />
      <aside className="absolute inset-y-0 right-0 flex w-full max-w-3xl flex-col bg-[var(--coachio-admin-dashboard-surface-muted)] shadow-[var(--coachio-admin-dashboard-shadow-modal)]">
        <div className="flex items-start justify-between gap-4 border-b border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface)] px-5 py-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--coachio-admin-dashboard-text-soft)]">Product detail</p>
            <h2 className="mt-1 truncate text-xl font-semibold text-[var(--coachio-admin-dashboard-text)]">{detail?.product_name || 'Loading'}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-[var(--coachio-admin-dashboard-radius-sm)] border border-[var(--coachio-admin-dashboard-border)] text-[var(--coachio-admin-dashboard-text-muted)]"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="h-20 animate-pulse rounded-[var(--coachio-admin-dashboard-radius-md)] bg-[var(--coachio-admin-dashboard-surface-hover)]" />
              ))}
            </div>
          ) : null}

          {!isLoading && error ? (
            <div className="rounded-[var(--coachio-admin-dashboard-radius-md)] border border-[var(--coachio-admin-dashboard-danger-border)] bg-[var(--coachio-admin-dashboard-danger-bg)] p-4 text-sm font-semibold text-[var(--coachio-admin-dashboard-danger-text)]">
              {error}
            </div>
          ) : null}

          {!isLoading && !error && detail ? (
            <div className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <KpiCard label="Total revenue" value={formatVnd(detail.summary.total_revenue)} icon={TrendingUp} tone="accent" />
                <KpiCard label="Paid orders" value={String(detail.summary.paid_orders)} icon={ReceiptText} tone="info" />
                <KpiCard label="Leads" value={String(detail.summary.leads.total)} icon={Users} tone="success" />
                <KpiCard label="Conversion" value={formatConversion(detail.summary.conversion_rate)} icon={CreditCard} tone="warning" />
              </div>

              <Section title="Daily revenue">
                <AdminRevenueAreaChart points={detail.daily} />
              </Section>

              <div className="grid gap-5 xl:grid-cols-2">
                <Section title="Funnel contribution">
                  <AdminFunnelContributionBars funnels={detail.funnels} />
                </Section>
                <Section title="Lead status">
                  <AdminLeadStatusDonut leads={detail.summary.leads} />
                </Section>
              </div>

              <div className="overflow-hidden rounded-[var(--coachio-admin-dashboard-radius-lg)] border border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface)]">
                <div className="border-b border-[var(--coachio-admin-dashboard-border)] px-4 py-3">
                  <h3 className="text-base font-semibold text-[var(--coachio-admin-dashboard-text)]">Funnels</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-[var(--coachio-admin-dashboard-border)] text-sm">
                    <thead className="bg-[var(--coachio-admin-dashboard-surface-muted)] text-left text-xs font-semibold uppercase text-[var(--coachio-admin-dashboard-text-soft)]">
                      <tr>
                        <th className="px-4 py-3">Funnel</th>
                        <th className="px-4 py-3">Paid orders</th>
                        <th className="px-4 py-3">Leads</th>
                        <th className="px-4 py-3">Conversion</th>
                        <th className="px-4 py-3 text-right">Revenue</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--coachio-admin-dashboard-border-subtle)]">
                      {detail.funnels.length ? detail.funnels.map((funnel) => (
                        <tr key={funnel.funnel_id} className="hover:bg-[var(--coachio-admin-dashboard-surface-hover)]">
                          <td className="px-4 py-3">
                            <Link href={`/admin/funnels/${funnel.funnel_id}/edit/analytics`} className="font-semibold text-[var(--coachio-admin-dashboard-accent)] hover:underline">
                              {funnel.funnel_title}
                            </Link>
                            <div className="text-xs text-[var(--coachio-admin-dashboard-text-muted)]">{funnel.funnel_slug}</div>
                          </td>
                          <td className="px-4 py-3 font-semibold">{funnel.paid_orders}</td>
                          <td className="px-4 py-3">
                            <div className="font-semibold text-[var(--coachio-admin-dashboard-text)]">{funnel.leads.total}</div>
                            <div className="text-xs text-[var(--coachio-admin-dashboard-text-muted)]">{funnel.leads.subscribed} · {funnel.leads.lead} · {funnel.leads.purchased}</div>
                          </td>
                          <td className="px-4 py-3 font-semibold">{formatConversion(funnel.conversion_rate)}</td>
                          <td className="px-4 py-3 text-right font-semibold">{formatVnd(funnel.revenue)}</td>
                        </tr>
                      )) : <AnalyticsEmptyRow colSpan={5} />}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </aside>
    </div>
  );
}
