'use client';

import styles from './AdminOrdersToolbar.module.scss';

export interface FunnelOrdersFilters {
  status: 'SUCCESS' | 'PENDING' | 'ALL';
  q: string;
  date_from: string;
  date_to: string;
}

interface AdminFunnelOrdersToolbarProps {
  filters: FunnelOrdersFilters;
  resultCount: number;
  onChange: (patch: Partial<FunnelOrdersFilters>) => void;
  onReset: () => void;
}

const STATUS_OPTIONS: { value: FunnelOrdersFilters['status']; label: string }[] = [
  { value: 'SUCCESS', label: 'Success' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'ALL', label: 'All' },
];

export function AdminFunnelOrdersToolbar({ filters, resultCount, onChange, onReset }: AdminFunnelOrdersToolbarProps) {
  return (
    <div className={styles.toolbar}>
      <label className={styles.field}>
        <span className={styles.label}>Search by email / name / order code</span>
        <input
          type="search"
          className={styles.input}
          placeholder="e.g. user@email.com"
          value={filters.q}
          onChange={(e) => onChange({ q: e.target.value })}
        />
      </label>

      <label className={styles.field}>
        <span className={styles.label}>Status</span>
        <select
          className={styles.input}
          value={filters.status}
          onChange={(e) => onChange({ status: e.target.value as FunnelOrdersFilters['status'] })}
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>

      <label className={styles.fieldNarrow}>
        <span className={styles.label}>From date</span>
        <input
          type="date"
          className={styles.input}
          value={filters.date_from}
          onChange={(e) => onChange({ date_from: e.target.value })}
        />
      </label>

      <label className={styles.fieldNarrow}>
        <span className={styles.label}>To date</span>
        <input
          type="date"
          className={styles.input}
          value={filters.date_to}
          onChange={(e) => onChange({ date_to: e.target.value })}
        />
      </label>

      <button type="button" className={styles.reset} onClick={onReset}>
        Reset
      </button>

      <span className={styles.count} role="status" aria-live="polite">
        {resultCount} order{resultCount !== 1 ? 's' : ''}
      </span>
    </div>
  );
}
