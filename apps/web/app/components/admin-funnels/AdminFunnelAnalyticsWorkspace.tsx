'use client';

import { useCallback, useEffect, useState } from 'react';
import { BarChart3, CreditCard, Eye, ShoppingBag, TrendingUp, UserCheck, UserPlus, Users, Wallet } from 'lucide-react';
import {
  adminFunnelAnalyticsApi,
  getApiErrorMessage,
  type FunnelAnalyticsOverview,
  type FunnelLeadsSummary,
} from '@coachio/api-client';
import { useToast } from '../shared/toast';
import { AdminAnalyticsDateRange } from '../admin-dashboard/analytics/AdminAnalyticsDateRange';
import { AdminAnalyticsError } from '../admin-dashboard/analytics/AdminAnalyticsError';
import { AdminAnalyticsSkeleton } from '../admin-dashboard/analytics/AdminAnalyticsSkeleton';
import { AdminRevenueAreaChart } from '../admin-dashboard/analytics/AdminRevenueAreaChart';
import {
  buildAnalyticsQueryRange,
  getDefaultAnalyticsDateRange,
  type AnalyticsDateRange,
} from '../admin-dashboard/analytics/dateRange';

interface AdminFunnelAnalyticsWorkspaceProps {
  funnelId: string;
}

function formatVnd(amount: number): string {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(amount);
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

function MetricCard({ icon: Icon, label, value, hint }: {
  icon: typeof Wallet; label: string; value: string; hint?: string;
}) {
  return (
    <div className="rounded-[var(--coachio-admin-dashboard-radius-lg)] border border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface)] p-5 shadow-[var(--coachio-admin-dashboard-shadow-sm)]">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--coachio-admin-dashboard-text-soft)]">
        <Icon className="h-4 w-4 text-[var(--coachio-admin-dashboard-accent)]" />
        {label}
      </div>
      <p className="mt-2 text-2xl font-bold text-[var(--coachio-admin-dashboard-text)]">{value}</p>
      {hint && <p className="mt-1 text-xs text-[var(--coachio-admin-dashboard-text-muted)]">{hint}</p>}
    </div>
  );
}

/** Lead lifecycle breakdown: stat cards + a stacked proportion bar. */
function LeadStatusSection({ leads }: { leads: FunnelLeadsSummary }) {
  const total = leads.total;
  const pct = (n: number) => (total ? Math.round((n / total) * 1000) / 10 : 0);

  const cards: Array<{
    key: 'subscribed' | 'lead' | 'purchased';
    label: string;
    icon: typeof Users;
    count: number;
    chip: string;
    bar: string;
  }> = [
    {
      key: 'subscribed',
      label: 'Đăng ký (subscribed)',
      icon: UserPlus,
      count: leads.subscribed,
      chip: 'bg-[var(--coachio-admin-dashboard-accent-soft)] text-[var(--coachio-admin-dashboard-accent)]',
      bar: 'bg-[var(--coachio-admin-dashboard-accent)]',
    },
    {
      key: 'lead',
      label: 'Vào checkout (lead)',
      icon: UserCheck,
      count: leads.lead,
      chip: 'bg-[var(--coachio-admin-dashboard-neutral-bg)] text-[var(--coachio-admin-dashboard-neutral-text)]',
      bar: 'bg-[var(--coachio-admin-dashboard-neutral-text)]',
    },
    {
      key: 'purchased',
      label: 'Đã mua (purchased)',
      icon: ShoppingBag,
      count: leads.purchased,
      chip: 'bg-[var(--coachio-admin-dashboard-success-bg)] text-[var(--coachio-admin-dashboard-success-text)]',
      bar: 'bg-[var(--coachio-admin-dashboard-success-text)]',
    },
  ];

  return (
    <div className="space-y-4 rounded-[var(--coachio-admin-dashboard-radius-lg)] border border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface)] p-5 shadow-[var(--coachio-admin-dashboard-shadow-sm)]">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-[var(--coachio-admin-dashboard-accent)]" />
          <h3 className="text-sm font-bold text-[var(--coachio-admin-dashboard-text)]">Leads theo trạng thái</h3>
        </div>
        <span className="text-xs text-[var(--coachio-admin-dashboard-text-muted)]">
          Tổng <strong className="text-[var(--coachio-admin-dashboard-text)]">{total.toLocaleString('vi-VN')}</strong> leads
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {cards.map((c) => (
          <div key={c.key} className="rounded-[var(--coachio-admin-dashboard-radius-md)] border border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface-muted)] p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-[var(--coachio-admin-dashboard-text-muted)]">{c.label}</p>
                <strong className="mt-2 block text-2xl font-bold text-[var(--coachio-admin-dashboard-text)]">
                  {c.count.toLocaleString('vi-VN')}
                </strong>
                <p className="mt-0.5 text-xs text-[var(--coachio-admin-dashboard-text-soft)]">{pct(c.count)}% tổng leads</p>
              </div>
              <div className={`grid h-10 w-10 place-items-center rounded-[var(--coachio-admin-dashboard-radius-sm)] ${c.chip}`}>
                <c.icon className="h-5 w-5" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Stacked proportion bar */}
      {total > 0 && (
        <div className="space-y-2">
          <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-[var(--coachio-admin-dashboard-surface-muted)]">
            {cards.map((c) =>
              c.count > 0 ? (
                <div key={c.key} className={`h-full ${c.bar}`} style={{ width: `${pct(c.count)}%` }} title={`${c.label}: ${c.count}`} />
              ) : null,
            )}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--coachio-admin-dashboard-text-muted)]">
            {cards.map((c) => (
              <span key={c.key} className="inline-flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full ${c.bar}`} />
                {c.label}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const PAGE_ROWS: Array<{ key: 'landing' | 'checkout' | 'payment' | 'success'; label: string }> = [
  { key: 'landing', label: 'Landing' },
  { key: 'checkout', label: 'Checkout (form)' },
  { key: 'payment', label: 'QR page' },
  { key: 'success', label: 'Thank-you' },
];

const CONVERSION_STEPS: Array<{ key: 'landing_to_checkout' | 'checkout_to_payment' | 'payment_to_success'; label: string }> = [
  { key: 'landing_to_checkout', label: 'Landing → Checkout' },
  { key: 'checkout_to_payment', label: 'Checkout → QR' },
  { key: 'payment_to_success', label: 'QR → Thank-you' },
];

export function AdminFunnelAnalyticsWorkspace({ funnelId }: AdminFunnelAnalyticsWorkspaceProps) {
  const [range, setRange] = useState<Required<AnalyticsDateRange>>(() => getDefaultAnalyticsDateRange());
  const [data, setData] = useState<FunnelAnalyticsOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const { error: toastError } = useToast();

  const load = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const overview = await adminFunnelAnalyticsApi.getOverview(funnelId, buildAnalyticsQueryRange(range));
      setData(overview);
    } catch (caught) {
      const msg = getApiErrorMessage(caught, 'Failed to load analytics data');
      setError(msg);
      toastError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [funnelId, range, toastError]);

  useEffect(() => { load(); }, [load]);

  const traffic = data?.traffic;
  const views: Record<string, number> = {
    landing: traffic?.landing_views ?? 0,
    checkout: traffic?.checkout_views ?? 0,
    payment: traffic?.payment_views ?? 0,
    success: traffic?.success_views ?? 0,
  };
  const visitors: Record<string, number> = {
    landing: traffic?.landing_visitors ?? 0,
    checkout: traffic?.checkout_visitors ?? 0,
    payment: traffic?.payment_visitors ?? 0,
    success: traffic?.success_visitors ?? 0,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <BarChart3 className="h-5 w-5 text-[var(--coachio-admin-dashboard-accent)]" />
        <h2 className="text-lg font-semibold text-[var(--coachio-admin-dashboard-text)]">Analytics &amp; Traffic</h2>
      </div>

      <AdminAnalyticsDateRange value={range} onChange={setRange} />
      <p className="text-xs text-[var(--coachio-admin-dashboard-text-muted)]">Maximum date range: 1 month (31 days).</p>

      {isLoading ? (
        <AdminAnalyticsSkeleton rows={4} />
      ) : error ? (
        <AdminAnalyticsError message={error} onRetry={load} />
      ) : data ? (
        <>
          {/* Metric cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard icon={Wallet} label="Revenue" value={formatVnd(data.revenue.total_revenue)} />
            <MetricCard icon={CreditCard} label="Paid orders" value={String(data.revenue.paid_orders)} />
            <MetricCard icon={TrendingUp} label="Avg. order value" value={formatVnd(data.revenue.average_order_value)} />
            <MetricCard
              icon={Eye}
              label="Conversion traffic→payment"
              value={formatPercent(data.conversion.traffic_to_payment)}
              hint={`${data.revenue.paid_orders} orders / ${visitors.landing} landing visitors`}
            />
          </div>

          {/* Leads by status */}
          <LeadStatusSection leads={data.leads} />

          {/* Traffic per page */}
          <div className="overflow-hidden rounded-[var(--coachio-admin-dashboard-radius-lg)] border border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface)] shadow-[var(--coachio-admin-dashboard-shadow-sm)]">
            <div className="border-b border-[var(--coachio-admin-dashboard-border)] px-5 py-3">
              <h3 className="text-sm font-bold text-[var(--coachio-admin-dashboard-text)]">Traffic by page</h3>
            </div>
            <div className="grid grid-cols-[minmax(0,1fr)_100px_120px] border-b border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface-muted)] px-5 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--coachio-admin-dashboard-text-soft)]">
              <span>Page</span><span className="text-right">Views</span><span className="text-right">Unique visitors</span>
            </div>
            {PAGE_ROWS.map((row) => (
              <div key={row.key} className="grid grid-cols-[minmax(0,1fr)_100px_120px] border-b border-[var(--coachio-admin-dashboard-border-subtle)] px-5 py-3 last:border-b-0">
                <span className="text-sm font-semibold text-[var(--coachio-admin-dashboard-text)]">{row.label}</span>
                <span className="text-right text-sm text-[var(--coachio-admin-dashboard-text)]">{views[row.key].toLocaleString('vi-VN')}</span>
                <span className="text-right text-sm text-[var(--coachio-admin-dashboard-text-muted)]">{visitors[row.key].toLocaleString('vi-VN')}</span>
              </div>
            ))}
          </div>

          {/* Step conversion */}
          <div className="grid gap-4 sm:grid-cols-3">
            {CONVERSION_STEPS.map((step) => (
              <div key={step.key} className="rounded-[var(--coachio-admin-dashboard-radius-lg)] border border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface)] p-5 shadow-[var(--coachio-admin-dashboard-shadow-sm)]">
                <p className="text-xs font-semibold text-[var(--coachio-admin-dashboard-text-soft)]">{step.label}</p>
                <p className="mt-1 text-xl font-bold text-[var(--coachio-admin-dashboard-accent)]">{formatPercent(data.conversion[step.key])}</p>
              </div>
            ))}
          </div>

          {/* Daily revenue chart */}
          <div className="rounded-[var(--coachio-admin-dashboard-radius-lg)] border border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface)] p-5 shadow-[var(--coachio-admin-dashboard-shadow-sm)]">
            <h3 className="mb-3 text-sm font-bold text-[var(--coachio-admin-dashboard-text)]">Daily revenue</h3>
            <AdminRevenueAreaChart points={data.daily} />
          </div>
        </>
      ) : null}
    </div>
  );
}
