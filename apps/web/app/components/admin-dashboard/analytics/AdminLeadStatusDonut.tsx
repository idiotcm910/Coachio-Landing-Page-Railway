'use client';

import type { LeadStatusBreakdown } from '@coachio/api-client';

interface AdminLeadStatusDonutProps {
  leads: LeadStatusBreakdown;
}

const SEGMENTS = [
  { key: 'subscribed', label: 'Subscribed', color: 'var(--coachio-admin-dashboard-info-text)' },
  { key: 'lead', label: 'Lead', color: 'var(--coachio-admin-dashboard-warning-text)' },
  { key: 'purchased', label: 'Purchased', color: 'var(--coachio-admin-dashboard-success-text)' },
] as const;

const RADIUS = 52;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** Small SVG donut of lead lifecycle status with a legend. */
export function AdminLeadStatusDonut({ leads }: AdminLeadStatusDonutProps) {
  const total = leads.total || 0;
  let offset = 0;

  return (
    <div className="flex items-center gap-5">
      <svg viewBox="0 0 140 140" className="h-32 w-32 shrink-0 -rotate-90">
        <circle cx="70" cy="70" r={RADIUS} fill="none" stroke="var(--coachio-admin-dashboard-surface-hover)" strokeWidth="16" />
        {total > 0
          ? SEGMENTS.map((segment) => {
              const value = leads[segment.key];
              const length = (value / total) * CIRCUMFERENCE;
              const dash = (
                <circle
                  key={segment.key}
                  cx="70"
                  cy="70"
                  r={RADIUS}
                  fill="none"
                  stroke={segment.color}
                  strokeWidth="16"
                  strokeDasharray={`${length} ${CIRCUMFERENCE - length}`}
                  strokeDashoffset={-offset}
                />
              );
              offset += length;
              return dash;
            })
          : null}
      </svg>
      <ul className="space-y-1.5 text-sm">
        {SEGMENTS.map((segment) => (
          <li key={segment.key} className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: segment.color }} />
            <span className="text-[var(--coachio-admin-dashboard-text-muted)]">{segment.label}</span>
            <span className="font-semibold text-[var(--coachio-admin-dashboard-text)]">{leads[segment.key]}</span>
          </li>
        ))}
        <li className="flex items-center gap-2 pt-1 text-xs font-semibold uppercase text-[var(--coachio-admin-dashboard-text-soft)]">
          Total {total}
        </li>
      </ul>
    </div>
  );
}
