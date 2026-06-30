'use client';

/**
 * AdminDiscountsWorkspace — discount panel embedded in a funnel/course editor.
 *
 * Discounts are a GLOBAL pool managed on /admin/discounts. Inside an owner editor
 * the admin can NOT create / edit / delete codes — they only see the codes already
 * applied to this owner (set as default for it, or scoped to it) and may CANCEL
 * those applications: turn off "default for this owner" and/or "restrict to this
 * owner" (scope). A button opens the full discount manager in a new tab.
 */

import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, ExternalLink, Loader2, Star, Tag, Target } from 'lucide-react';
import {
  adminDiscountsApi, getApiErrorMessage,
  type Discount, type DiscountType,
} from '@coachio/api-client';
import { useToast } from '../toast';

const DISCOUNT_TYPE_LABELS: Record<DiscountType, string> = {
  percent: 'Phần trăm (%)',
  fixed: 'Cố định (VND)',
};

interface AdminDiscountsWorkspaceProps {
  ownerType: 'funnel' | 'course';
  ownerId: string;
}

export function AdminDiscountsWorkspace({ ownerType, ownerId }: AdminDiscountsWorkspaceProps) {
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [togglingKey, setTogglingKey] = useState<string | null>(null);
  const { success, error: toastError } = useToast();

  const ownerLabel = ownerType === 'funnel' ? 'funnel' : 'course';

  useEffect(() => {
    let mounted = true;
    setIsLoading(true);
    adminDiscountsApi
      .list({ ownerType, ownerId })
      .then((data) => { if (mounted) setDiscounts(data); })
      .catch((e) => { if (mounted) setError(getApiErrorMessage(e, 'Không tải được danh sách mã giảm giá')); })
      .finally(() => { if (mounted) setIsLoading(false); });
    return () => { mounted = false; };
  }, [ownerType, ownerId]);

  /** Is this funnel/course in the discount's scope whitelist? */
  function isScopedToOwner(d: Discount): boolean {
    return (d.scopes ?? []).some((s) => s.owner_type === ownerType && s.owner_id === ownerId);
  }

  /** A discount is "applied to this owner" when it is a default for it OR scoped to it. */
  const applied = useMemo(
    () => discounts.filter((d) => d.is_default_for_owner || isScopedToOwner(d)),
    [discounts], // eslint-disable-line react-hooks/exhaustive-deps
  );

  async function handleToggleDefault(d: Discount) {
    const key = `${d.id}:default`;
    setTogglingKey(key);
    try {
      if (d.is_default_for_owner) {
        await adminDiscountsApi.unsetDefault(d.id, { ownerType, ownerId });
        setDiscounts((prev) => prev.map((x) => (x.id === d.id ? { ...x, is_default_for_owner: false } : x)));
        success(`Đã bỏ đặt mặc định cho ${ownerLabel} này`);
      } else {
        await adminDiscountsApi.setDefault(d.id, { ownerType, ownerId });
        // One default at a time per owner — clear the flag on the others.
        setDiscounts((prev) => prev.map((x) => ({ ...x, is_default_for_owner: x.id === d.id })));
        success(`Đã đặt làm mã mặc định cho ${ownerLabel} này`);
      }
    } catch (e) {
      toastError(getApiErrorMessage(e, 'Không cập nhật được mặc định'));
    } finally {
      setTogglingKey(null);
    }
  }

  async function handleToggleScope(d: Discount) {
    const key = `${d.id}:scope`;
    setTogglingKey(key);
    try {
      if (isScopedToOwner(d)) {
        await adminDiscountsApi.removeScope(d.id, { ownerType, ownerId });
        setDiscounts((prev) =>
          prev.map((x) =>
            x.id === d.id
              ? { ...x, scopes: (x.scopes ?? []).filter((s) => !(s.owner_type === ownerType && s.owner_id === ownerId)) }
              : x,
          ),
        );
        success(`Đã gỡ giới hạn áp riêng cho ${ownerLabel} này`);
      } else {
        await adminDiscountsApi.addScope(d.id, { ownerType, ownerId });
        setDiscounts((prev) =>
          prev.map((x) =>
            x.id === d.id
              ? { ...x, scopes: [...(x.scopes ?? []), { owner_type: ownerType, owner_id: ownerId }] }
              : x,
          ),
        );
        success(`Đã giới hạn mã chỉ áp cho ${ownerLabel} này`);
      }
    } catch (e) {
      toastError(getApiErrorMessage(e, 'Không cập nhật được phạm vi áp dụng'));
    } finally {
      setTogglingKey(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-[var(--coachio-admin-dashboard-text)]">Mã giảm giá</h3>
          <p className="mt-0.5 max-w-xl text-xs text-[var(--coachio-admin-dashboard-text-muted)]">
            Mã giảm giá là kho dùng chung. Tại đây chỉ hiển thị mã đã được áp cho {ownerLabel} này; bạn có thể hủy việc
            áp (bỏ mặc định / gỡ giới hạn áp riêng). Để tạo, sửa hoặc xóa mã, mở trang quản lý mã giảm giá.
          </p>
        </div>
        <a
          href="/admin/discounts"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-9 items-center gap-2 rounded-[var(--coachio-admin-dashboard-radius-sm)] border border-[var(--coachio-admin-dashboard-border)] px-4 text-sm font-semibold text-[var(--coachio-admin-dashboard-text)] hover:border-[var(--coachio-admin-dashboard-accent)] hover:text-[var(--coachio-admin-dashboard-accent)]"
        >
          <ExternalLink className="h-4 w-4" />
          Quản lý mã giảm giá
        </a>
      </div>

      {isLoading && (
        <div className="flex items-center gap-3 text-sm text-[var(--coachio-admin-dashboard-text-muted)]">
          <Loader2 className="h-5 w-5 animate-spin text-[var(--coachio-admin-dashboard-accent)]" />
          Đang tải...
        </div>
      )}

      {error && (
        <div className="flex items-start gap-3 rounded-[var(--coachio-admin-dashboard-radius-md)] border border-[var(--coachio-admin-dashboard-danger-border)] bg-[var(--coachio-admin-dashboard-danger-bg)] px-4 py-3 text-sm font-semibold text-[var(--coachio-admin-dashboard-danger-text)]">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" /><span>{error}</span>
        </div>
      )}

      {!isLoading && !error && (
        <div className="overflow-hidden rounded-[var(--coachio-admin-dashboard-radius-lg)] border border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface)] shadow-[var(--coachio-admin-dashboard-shadow-sm)]">
          <div className="hidden grid-cols-[minmax(120px,1.3fr)_minmax(0,1fr)_110px_70px_150px_160px] gap-3 border-b border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface-muted)] px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[var(--coachio-admin-dashboard-text-soft)] md:grid">
            <span>Mã</span><span>Loại</span><span>Giá trị</span><span>Đã dùng</span><span>Mặc định</span><span>Áp riêng</span>
          </div>
          {applied.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-12 text-center text-sm text-[var(--coachio-admin-dashboard-text-muted)]">
              <Tag className="h-8 w-8 opacity-40" />
              Chưa có mã giảm giá nào được áp cho {ownerLabel} này.
            </div>
          ) : applied.map((d) => {
            const scoped = isScopedToOwner(d);
            const isTogglingDefault = togglingKey === `${d.id}:default`;
            const isTogglingScope = togglingKey === `${d.id}:scope`;
            return (
              <div key={d.id} className="grid gap-3 border-b border-[var(--coachio-admin-dashboard-border-subtle)] px-4 py-3 last:border-b-0 md:grid-cols-[minmax(120px,1.3fr)_minmax(0,1fr)_110px_70px_150px_160px] md:items-center">
                <code className="min-w-0 break-all text-xs font-bold text-[var(--coachio-admin-dashboard-accent)]">{d.code}</code>
                <span className="text-xs text-[var(--coachio-admin-dashboard-text-muted)]">{DISCOUNT_TYPE_LABELS[d.discount_type]}</span>
                <span className="text-sm font-semibold text-[var(--coachio-admin-dashboard-text)]">
                  {d.discount_type === 'percent' ? `${d.discount_value}%` : `${d.discount_value.toLocaleString('vi-VN')}₫`}
                </span>
                <span className="text-xs text-[var(--coachio-admin-dashboard-text-muted)]">{d.redeemed_count}</span>

                {/* Default-for-owner toggle */}
                <button
                  type="button"
                  title={d.is_default_for_owner ? `Bỏ mặc định cho ${ownerLabel} này` : `Đặt mặc định cho ${ownerLabel} này`}
                  onClick={() => handleToggleDefault(d)}
                  disabled={isTogglingDefault}
                  className={`inline-flex h-7 w-fit items-center justify-center gap-1.5 whitespace-nowrap rounded-[var(--coachio-admin-dashboard-radius-sm)] px-2.5 text-xs font-semibold transition disabled:opacity-50 ${
                    d.is_default_for_owner
                      ? 'bg-[var(--coachio-admin-dashboard-accent)] text-[var(--coachio-admin-dashboard-text-inverse)]'
                      : 'border border-[var(--coachio-admin-dashboard-border)] text-[var(--coachio-admin-dashboard-text-muted)] hover:border-[var(--coachio-admin-dashboard-accent)] hover:text-[var(--coachio-admin-dashboard-accent)]'
                  }`}
                >
                  {isTogglingDefault
                    ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
                    : <Star className={`h-3.5 w-3.5 shrink-0 ${d.is_default_for_owner ? 'fill-current' : ''}`} />}
                  <span>{d.is_default_for_owner ? 'Mặc định' : 'Đặt mặc định'}</span>
                </button>

                {/* Scope (restrict-to-owner) toggle */}
                <button
                  type="button"
                  title={scoped ? `Gỡ giới hạn áp riêng cho ${ownerLabel} này` : `Giới hạn chỉ áp cho ${ownerLabel} này`}
                  onClick={() => handleToggleScope(d)}
                  disabled={isTogglingScope}
                  className={`inline-flex h-7 w-fit items-center justify-center gap-1.5 whitespace-nowrap rounded-[var(--coachio-admin-dashboard-radius-sm)] px-2.5 text-xs font-semibold transition disabled:opacity-50 ${
                    scoped
                      ? 'bg-[var(--coachio-admin-dashboard-accent)] text-[var(--coachio-admin-dashboard-text-inverse)]'
                      : 'border border-[var(--coachio-admin-dashboard-border)] text-[var(--coachio-admin-dashboard-text-muted)] hover:border-[var(--coachio-admin-dashboard-accent)] hover:text-[var(--coachio-admin-dashboard-accent)]'
                  }`}
                >
                  {isTogglingScope
                    ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
                    : <Target className="h-3.5 w-3.5 shrink-0" />}
                  <span>{scoped ? 'Áp riêng' : 'Giới hạn riêng'}</span>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
