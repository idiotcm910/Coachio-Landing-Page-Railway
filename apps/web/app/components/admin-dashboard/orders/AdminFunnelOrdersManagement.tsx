'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  adminFunnelOrdersApi,
  getApiErrorMessage,
  type AdminFunnelOrderListItem,
} from '@coachio/api-client';
import { AdminFunnelOrdersKpiCards } from './AdminFunnelOrdersKpiCards';
import { AdminFunnelOrdersToolbar, type FunnelOrdersFilters } from './AdminFunnelOrdersToolbar';
import { AdminFunnelOrdersTable } from './AdminFunnelOrdersTable';
import { ConfirmDialog } from '../../shared/ConfirmDialog';
import { useToast } from '../../shared/toast';
import { formatCurrencyVnd } from './order-format';
import styles from './AdminOrdersManagement.module.scss';

type LoadState = 'idle' | 'loading' | 'loaded' | 'error';

const PER_PAGE = 20;

const DEFAULT_FILTERS: FunnelOrdersFilters = {
  status: 'SUCCESS',
  q: '',
  date_from: '',
  date_to: '',
};

interface FunnelOrderSummary {
  success_count: number;
  revenue: number;
  aov: number;
}

function toListParams(filters: FunnelOrdersFilters, sortOrder: 'asc' | 'desc') {
  return {
    status: filters.status !== 'ALL' ? filters.status : undefined,
    q: filters.q.trim() || undefined,
    date_from: filters.date_from || undefined,
    date_to: filters.date_to || undefined,
    per_page: PER_PAGE,
    sort_by: 'paid_at' as const,
    sort_order: sortOrder,
  };
}

function toSummaryParams(filters: FunnelOrdersFilters) {
  return {
    status: filters.status !== 'ALL' ? filters.status : undefined,
    q: filters.q.trim() || undefined,
    date_from: filters.date_from || undefined,
    date_to: filters.date_to || undefined,
  };
}

export function AdminFunnelOrdersManagement() {
  const [filters, setFilters] = useState<FunnelOrdersFilters>(DEFAULT_FILTERS);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [items, setItems] = useState<AdminFunnelOrderListItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasNext, setHasNext] = useState(false);
  const [state, setState] = useState<LoadState>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [summary, setSummary] = useState<FunnelOrderSummary | null>(null);
  const [confirmOrder, setConfirmOrder] = useState<AdminFunnelOrderListItem | null>(null);
  const [activatingId, setActivatingId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const { success, error: toastError } = useToast();

  const updateFilters = useCallback((patch: Partial<FunnelOrdersFilters>) => {
    setFilters((prev) => ({ ...prev, ...patch }));
  }, []);

  const resetFilters = useCallback(() => setFilters(DEFAULT_FILTERS), []);

  // Debounced reload on filter/sort change.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setState('loading');
      setErrorMsg('');
      Promise.all([
        adminFunnelOrdersApi.list(toListParams(filters, sortOrder), { signal: controller.signal }),
        adminFunnelOrdersApi.summary(toSummaryParams(filters), { signal: controller.signal }),
      ])
        .then(([list, sum]) => {
          setItems(list.items);
          setNextCursor(list.next_cursor);
          setHasNext(list.has_next);
          setSummary(sum);
          setState('loaded');
        })
        .catch((err) => {
          if ((err as { name?: string })?.name === 'AbortError') return;
          setErrorMsg(getApiErrorMessage(err, 'Failed to load funnel orders'));
          setState('error');
        });
    }, 350);

    return () => window.clearTimeout(timer);
  }, [filters, sortOrder]);

  const loadMore = useCallback(() => {
    if (!nextCursor) return;
    const params = { ...toListParams(filters, sortOrder), cursor: nextCursor };
    setState('loading');
    adminFunnelOrdersApi
      .list(params)
      .then((list) => {
        setItems((prev) => [...prev, ...list.items]);
        setNextCursor(list.next_cursor);
        setHasNext(list.has_next);
        setState('loaded');
      })
      .catch((err) => {
        setErrorMsg(getApiErrorMessage(err, 'Failed to load more'));
        setState('error');
      });
  }, [filters, sortOrder, nextCursor]);

  const handleConfirmActivate = useCallback(() => {
    if (!confirmOrder) return;
    const target = confirmOrder;
    setActivatingId(target.id);
    adminFunnelOrdersApi
      .activate(target.id)
      .then((updated) => {
        // Reflect the new SUCCESS state in-place so the badge flips and the
        // Activate button disappears without a full reload.
        setItems((prev) =>
          prev.map((it) =>
            it.id === updated.id
              ? { ...it, status: updated.status, paid_at: updated.paid_at }
              : it,
          ),
        );
        setSummary((prev) =>
          prev
            ? {
                success_count: prev.success_count + 1,
                revenue: prev.revenue + updated.amount,
                aov: Math.round((prev.revenue + updated.amount) / (prev.success_count + 1)),
              }
            : prev,
        );
        success(`Đã kích hoạt đơn ${target.order_code}`);
        setConfirmOrder(null);
      })
      .catch((err) => {
        toastError(getApiErrorMessage(err, 'Kích hoạt đơn thất bại'));
      })
      .finally(() => setActivatingId(null));
  }, [confirmOrder, success, toastError]);

  return (
    <div className={styles.container}>
      <AdminFunnelOrdersKpiCards summary={summary} loading={state === 'loading'} />

      <AdminFunnelOrdersToolbar
        filters={filters}
        resultCount={items.length}
        onChange={updateFilters}
        onReset={resetFilters}
      />

      {state === 'error' && (
        <div role="alert" className={styles.error}>
          {errorMsg || 'An error occurred while loading funnel orders.'}
        </div>
      )}

      <AdminFunnelOrdersTable
        items={items}
        loading={state === 'loading'}
        sortOrder={sortOrder}
        onToggleSort={() => setSortOrder((o) => (o === 'desc' ? 'asc' : 'desc'))}
        onActivate={setConfirmOrder}
        activatingId={activatingId}
      />

      {hasNext && (
        <div className={styles.loadMoreWrap}>
          <button
            type="button"
            className={styles.loadMore}
            onClick={loadMore}
            disabled={state === 'loading'}
          >
            {state === 'loading' ? 'Loading…' : 'Load more'}
          </button>
        </div>
      )}

      <ConfirmDialog
        isOpen={confirmOrder !== null}
        title="Kích hoạt đơn hàng"
        description={
          confirmOrder
            ? `Xác nhận đã nhận tiền cho đơn ${confirmOrder.order_code} (${confirmOrder.buyer_email} · ${formatCurrencyVnd(confirmOrder.amount)})? Hệ thống sẽ đánh dấu SUCCESS và chạy toàn bộ luồng: gửi email, cập nhật lead, cấp quyền truy cập. Thao tác này không thể hoàn tác.`
            : ''
        }
        confirmLabel="Kích hoạt"
        cancelLabel="Huỷ"
        confirmingLabel="Đang kích hoạt…"
        isConfirming={activatingId !== null}
        onConfirm={handleConfirmActivate}
        onClose={() => {
          if (activatingId === null) setConfirmOrder(null);
        }}
      />
    </div>
  );
}
