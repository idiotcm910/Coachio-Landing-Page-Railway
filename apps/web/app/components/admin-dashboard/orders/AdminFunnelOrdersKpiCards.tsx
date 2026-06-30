'use client';

import { formatCurrencyVnd } from './order-format';
import styles from './AdminOrdersKpiCards.module.scss';

interface FunnelOrderSummary {
  success_count: number;
  revenue: number;
  aov: number;
}

interface AdminFunnelOrdersKpiCardsProps {
  summary: FunnelOrderSummary | null;
  loading: boolean;
}

export function AdminFunnelOrdersKpiCards({ summary, loading }: AdminFunnelOrdersKpiCardsProps) {
  const cards = [
    { key: 'count', label: 'Successful Orders', value: summary ? summary.success_count.toLocaleString() : '—' },
    { key: 'revenue', label: 'Revenue', value: summary ? formatCurrencyVnd(summary.revenue) : '—' },
    { key: 'aov', label: 'Avg. Order Value', value: summary ? formatCurrencyVnd(summary.aov) : '—' },
  ];

  return (
    <div className={styles.grid} style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
      {cards.map((card) => (
        <div key={card.key} className={styles.card}>
          <span className={styles.label}>{card.label}</span>
          {loading && !summary ? (
            <span className={styles.skeleton} aria-hidden="true" />
          ) : (
            <span className={styles.value}>{card.value}</span>
          )}
        </div>
      ))}
    </div>
  );
}
