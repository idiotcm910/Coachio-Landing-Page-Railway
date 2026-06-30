'use client';

import type { AdminFunnelOrderListItem } from '@coachio/api-client';
import { OrderBadge } from './OrderBadge';
import { formatCurrencyVnd, formatDateTime, statusBadge } from './order-format';
import styles from './AdminOrdersTable.module.scss';

interface AdminFunnelOrdersTableProps {
  items: AdminFunnelOrderListItem[];
  loading: boolean;
  sortOrder: 'asc' | 'desc';
  onToggleSort: () => void;
  onActivate: (order: AdminFunnelOrderListItem) => void;
  activatingId: string | null;
}

const SKELETON_ROWS = 6;

export function AdminFunnelOrdersTable({
  items,
  loading,
  sortOrder,
  onToggleSort,
  onActivate,
  activatingId,
}: AdminFunnelOrdersTableProps) {
  const showSkeleton = loading && items.length === 0;
  const showEmpty = !loading && items.length === 0;

  return (
    <div className={styles.wrapper}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">Order code</th>
            <th scope="col">Buyer</th>
            <th scope="col">Funnel</th>
            <th scope="col">Product</th>
            <th scope="col" className={styles.right}>Amount</th>
            <th scope="col">Status</th>
            <th scope="col">Provider</th>
            <th scope="col" aria-sort={sortOrder === 'desc' ? 'descending' : 'ascending'}>
              <button type="button" className={styles.sortButton} onClick={onToggleSort}>
                Date
                <span aria-hidden="true">{sortOrder === 'desc' ? ' ↓' : ' ↑'}</span>
              </button>
            </th>
            <th scope="col">Actions</th>
          </tr>
        </thead>
        <tbody>
          {showSkeleton &&
            Array.from({ length: SKELETON_ROWS }).map((_, i) => (
              <tr key={`sk-${i}`} className={styles.skeletonRow}>
                <td colSpan={9}>
                  <span className={styles.skeletonBar} aria-hidden="true" />
                </td>
              </tr>
            ))}

          {!showSkeleton &&
            items.map((order) => (
              <tr key={order.id} className={styles.row}>
                <td className={styles.code} data-label="Order code">{order.order_code}</td>
                <td data-label="Buyer">
                  <span className={styles.buyerEmail}>{order.buyer_email}</span>
                  {order.buyer_full_name && <span className={styles.buyerName}>{order.buyer_full_name}</span>}
                  {order.buyer_phone && <span className={styles.buyerName}>{order.buyer_phone}</span>}
                </td>
                <td data-label="Funnel">{order.funnel_title}</td>
                <td data-label="Product">{order.product_name}</td>
                <td className={styles.right} data-label="Amount">{formatCurrencyVnd(order.amount)}</td>
                <td data-label="Status">
                  <OrderBadge tokens={statusBadge(order.status)} />
                </td>
                <td data-label="Provider">{order.payment_provider}</td>
                <td data-label="Date">
                  {order.paid_at ? formatDateTime(order.paid_at) : formatDateTime(order.created_at)}
                </td>
                <td data-label="Actions">
                  {order.status === 'PENDING' ? (
                    <button
                      type="button"
                      className={styles.activateButton}
                      onClick={() => onActivate(order)}
                      disabled={activatingId === order.id}
                    >
                      {activatingId === order.id ? 'Đang kích hoạt…' : 'Kích hoạt'}
                    </button>
                  ) : (
                    <span aria-hidden="true">—</span>
                  )}
                </td>
              </tr>
            ))}
        </tbody>
      </table>

      {showEmpty && <p className={styles.empty}>No funnel orders yet.</p>}
    </div>
  );
}
