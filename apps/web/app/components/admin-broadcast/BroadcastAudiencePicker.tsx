'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { HelpCircle, Loader2 } from 'lucide-react';
import { adminBroadcastsApi } from '@coachio/api-client';
import type { AudienceConfig, AudienceFilters } from '@coachio/api-client';
import { DateTimeField } from '../shared/variables/DateTimeField';
import { AdminModal } from '../shared/AdminModal';
import styles from './BroadcastAudiencePicker.module.scss';

interface FunnelOption {
  id: string;
  title: string;
}

interface BroadcastAudiencePickerProps {
  mode: 'funnel' | 'admin';
  /** funnel mode: the fixed funnel id (readonly display) */
  funnelId?: string;
  funnelTitle?: string;
  /** admin mode: available funnels to pick from */
  funnelOptions?: FunnelOption[];
  value: AudienceConfig;
  onChange(next: AudienceConfig): void;
  /** called whenever the live recipient count updates; null while loading or on error */
  onCountChange?: (count: number | null) => void;
}

const EMPTY_FILTERS: AudienceFilters = {
  status: null,
  converted: null,
  created_from: null,
  created_to: null,
};

export function BroadcastAudiencePicker({
  mode,
  funnelId,
  funnelTitle,
  funnelOptions = [],
  value,
  onChange,
  onCountChange,
}: BroadcastAudiencePickerProps) {
  const [count, setCount] = useState<number | null>(null);
  const [counting, setCounting] = useState(false);
  const [showStatusHelp, setShowStatusHelp] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const previewCount = useCallback(async (config: AudienceConfig) => {
    setCounting(true);
    onCountChange?.(null);
    try {
      const result = await adminBroadcastsApi.audiencePreviewUnbound(
        config.funnel_ids,
        config.filters,
      );
      setCount(result.count);
      onCountChange?.(result.count);
    } catch {
      setCount(null);
      onCountChange?.(null);
    } finally {
      setCounting(false);
    }
  }, [onCountChange]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => previewCount(value), 600);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value, previewCount]);

  function setFilters(patch: Partial<AudienceFilters>) {
    onChange({ ...value, filters: { ...value.filters, ...patch } });
  }

  function toggleFunnel(id: string) {
    const ids = value.funnel_ids.includes(id)
      ? value.funnel_ids.filter((f) => f !== id)
      : [...value.funnel_ids, id];
    onChange({ ...value, funnel_ids: ids });
  }

  return (
    <div className={styles.picker}>
      {/* Funnel selection */}
      <div className={styles.section}>
        <span className={styles.label}>Lead source (funnel)</span>
        {mode === 'funnel' ? (
          <div className={styles.fixedFunnel}>
            {funnelTitle ?? funnelId ?? '—'}
          </div>
        ) : (
          <div className={styles.funnelList}>
            {funnelOptions.length === 0 ? (
              <p className={styles.empty}>No funnels available.</p>
            ) : (
              funnelOptions.map((f) => (
                <label key={f.id} className={styles.checkRow}>
                  <input
                    type="checkbox"
                    checked={value.funnel_ids.includes(f.id)}
                    onChange={() => toggleFunnel(f.id)}
                  />
                  <span>{f.title}</span>
                </label>
              ))
            )}
          </div>
        )}
      </div>

      {/* Filters */}
      <div className={styles.section}>
        <span className={styles.label}>Filters</span>
        <div className={styles.filters}>
          <div className={styles.filterField}>
            <span className={styles.filterLabelRow}>
              <span className={styles.filterLabel}>Lead status</span>
              <button
                type="button"
                className={styles.helpBtn}
                onClick={() => setShowStatusHelp((s) => !s)}
                aria-label="Lead status explanation"
                aria-expanded={showStatusHelp}
              >
                <HelpCircle className={styles.helpIcon} />
              </button>
            </span>
            <select
              className={styles.select}
              value={value.filters.status ?? ''}
              onChange={(e) => setFilters({ status: (e.target.value as 'purchased' | 'lead' | 'subscribed') || null })}
            >
              <option value="">All</option>
              <option value="subscribed">Subscribed (opt-in form)</option>
              <option value="lead">Lead (not purchased)</option>
              <option value="purchased">Purchased</option>
            </select>
            {showStatusHelp && (
              <AdminModal
                title="Lead status"
                subtitle="Classify recipients by purchase history"
                onClose={() => setShowStatusHelp(false)}
                maxWidthClassName="max-w-md"
              >
                <div className={styles.helpModalBody}>
                  <p>
                    <strong>Subscribed</strong>: opted in via a landing-page form, <strong>has not entered checkout</strong>.
                  </p>
                  <p>
                    <strong>Lead</strong>: entered checkout but <strong>has not purchased</strong> — no successful payment order.
                  </p>
                  <p>
                    <strong>Purchased</strong>: has a <strong>successful order</strong> (above the configured price threshold).
                  </p>
                  <p>
                    <strong>All</strong>: includes all of the groups above.
                  </p>
                </div>
              </AdminModal>
            )}
          </div>

          <div className={styles.filterField}>
            <span className={styles.filterLabel}>From date</span>
            <DateTimeField
              kind="date"
              value={value.filters.created_from ?? ''}
              onChange={(v) => setFilters({ created_from: v || null })}
            />
          </div>

          <div className={styles.filterField}>
            <span className={styles.filterLabel}>To date</span>
            <DateTimeField
              kind="date"
              value={value.filters.created_to ?? ''}
              onChange={(v) => setFilters({ created_to: v || null })}
            />
          </div>
        </div>
      </div>

      {/* Recipient count */}
      <div className={styles.countRow}>
        {counting ? (
          <span className={styles.counting}>
            <Loader2 className={styles.spin} /> Counting...
          </span>
        ) : count !== null ? (
          <span className={styles.count}>
            <strong>{count.toLocaleString('en-US')}</strong> estimated recipients
          </span>
        ) : null}
      </div>
    </div>
  );
}

export { EMPTY_FILTERS };
export type { FunnelOption };
