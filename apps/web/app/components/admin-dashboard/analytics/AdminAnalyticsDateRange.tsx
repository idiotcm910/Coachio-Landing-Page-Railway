import { CalendarDays } from 'lucide-react';
import type { AnalyticsDateRange } from './dateRange';
import { clampAnalyticsDateRange, getQuickAnalyticsRanges } from './dateRange';

interface AdminAnalyticsDateRangeProps {
  value: Required<AnalyticsDateRange>;
  onChange: (range: Required<AnalyticsDateRange>) => void;
}

export function AdminAnalyticsDateRange({ value, onChange }: AdminAnalyticsDateRangeProps) {
  function updateRange(next: AnalyticsDateRange) {
    onChange(clampAnalyticsDateRange({ ...value, ...next }));
  }

  return (
    <div className="rounded-[var(--coachio-admin-dashboard-radius-md)] border border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface)] p-4 shadow-[var(--coachio-admin-dashboard-shadow-sm)]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-3 flex items-center gap-2 text-sm font-bold text-[var(--coachio-admin-dashboard-text)]">
            <CalendarDays className="h-4 w-4 text-[var(--coachio-admin-dashboard-accent)]" />
            Date range
          </div>
          <div className="flex flex-wrap gap-2">
            {getQuickAnalyticsRanges().map((quickRange) => (
              <button
                key={quickRange.id}
                type="button"
                onClick={() => onChange(quickRange.range)}
                className="rounded-[var(--coachio-admin-dashboard-radius-sm)] border border-[var(--coachio-admin-dashboard-border)] px-3 py-2 text-sm font-semibold text-[var(--coachio-admin-dashboard-text-muted)] transition hover:border-[var(--coachio-admin-dashboard-accent)] hover:text-[var(--coachio-admin-dashboard-accent)]"
              >
                {quickRange.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase text-[var(--coachio-admin-dashboard-text-soft)]">From date</span>
            <input
              type="date"
              value={value.startDate}
              onChange={(event) => updateRange({ startDate: event.target.value })}
              className="h-10 rounded-[var(--coachio-admin-dashboard-radius-sm)] border border-[var(--coachio-admin-dashboard-border)] bg-white px-3 text-sm font-semibold outline-none focus:border-[var(--coachio-admin-dashboard-accent)]"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase text-[var(--coachio-admin-dashboard-text-soft)]">To date</span>
            <input
              type="date"
              value={value.endDate}
              onChange={(event) => updateRange({ endDate: event.target.value })}
              className="h-10 rounded-[var(--coachio-admin-dashboard-radius-sm)] border border-[var(--coachio-admin-dashboard-border)] bg-white px-3 text-sm font-semibold outline-none focus:border-[var(--coachio-admin-dashboard-accent)]"
            />
          </label>
        </div>
      </div>
    </div>
  );
}
