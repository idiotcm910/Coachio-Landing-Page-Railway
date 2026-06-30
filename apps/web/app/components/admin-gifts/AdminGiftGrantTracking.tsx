'use client';

import { useCallback, useEffect, useState } from 'react';
import { Mail, RotateCw, X } from 'lucide-react';
import {
  adminFunnelsApi,
  adminGiftGrantsApi,
  adminGiftsApi,
  getApiErrorMessage,
  type Funnel,
  type Gift,
  type GiftGrant,
  type GiftGrantDetail,
  type GiftGrantFilters,
  type GiftGrantStats,
} from '@coachio/api-client';
import { useToast } from '../shared/toast';
import { BTN_PRIMARY, BTN_SECONDARY, INPUT, PANEL, SELECT, TABLE, TD, TH, badgeClass, formatVnDateTime } from './gift-ui';

export function AdminGiftGrantTracking() {
  const { success, error: toastError } = useToast();
  const [filters, setFilters] = useState<GiftGrantFilters>({});
  const [items, setItems] = useState<GiftGrant[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<GiftGrantStats | null>(null);
  const [gifts, setGifts] = useState<Gift[]>([]);
  const [funnels, setFunnels] = useState<Funnel[]>([]);
  const [loading, setLoading] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  useEffect(() => {
    adminGiftsApi.list(true).then(setGifts).catch(() => {});
    adminFunnelsApi.list().then(setFunnels).catch(() => {});
  }, []);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [list, st] = await Promise.all([
        adminGiftGrantsApi.list({ ...filters, page: 1, size: 100 }),
        adminGiftGrantsApi.stats(filters),
      ]);
      setItems(list.items);
      setTotal(list.total);
      setStats(st);
    } catch (e) {
      toastError(getApiErrorMessage(e, 'Failed to load gift grant history'));
    } finally {
      setLoading(false);
    }
  }, [filters, toastError]);

  useEffect(() => { reload(); }, [reload]);

  const setF = (patch: Partial<GiftGrantFilters>) => setFilters((f) => ({ ...f, ...patch }));

  const handleResend = async (id: string) => {
    try {
      const r = await adminGiftGrantsApi.resend(id);
      if (r.resent) success('Email resent');
      else toastError('Resend failed');
      reload();
    } catch (e) {
      toastError(getApiErrorMessage(e, 'Failed to resend'));
    }
  };

  const handleBulkRetry = async () => {
    try {
      const r = await adminGiftGrantsApi.bulkRetry(filters);
      success(`Resent ${r.resent} emails (${r.failed} failed)`);
      reload();
    } catch (e) {
      toastError(getApiErrorMessage(e, 'Failed to bulk resend'));
    }
  };

  const giftName = (id: string) => gifts.find((g) => g.id === id)?.name ?? id;

  return (
    <div className="flex flex-col gap-4">
      {/* Stats panel */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Grants" value={stats?.total_grants ?? 0} />
        <Stat label="Total credits granted" value={(stats?.total_credits_granted ?? 0).toLocaleString('en-US')} />
        <Stat label="Recipients" value={stats?.distinct_recipients ?? 0} />
        <Stat label="Failed emails" value={stats?.email_failed_count ?? 0} />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-2">
        <select className={SELECT} value={filters.gift_id ?? ''} onChange={(e) => setF({ gift_id: e.target.value || undefined })}>
          <option value="">All gifts</option>
          {gifts.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
        <select className={SELECT} value={filters.funnel_id ?? ''} onChange={(e) => setF({ funnel_id: e.target.value || undefined })}>
          <option value="">All funnels</option>
          {funnels.map((f) => <option key={f.id} value={f.id}>{f.title}</option>)}
        </select>
        <select className={SELECT} value={filters.source_type ?? ''} onChange={(e) => setF({ source_type: (e.target.value || undefined) as GiftGrantFilters['source_type'] })}>
          <option value="">All sources</option>
          <option value="auto">Automatic</option>
          <option value="campaign">Campaign</option>
        </select>
        <select className={SELECT} value={filters.email_status ?? ''} onChange={(e) => setF({ email_status: (e.target.value || undefined) as GiftGrantFilters['email_status'] })}>
          <option value="">All email statuses</option>
          <option value="sent">Sent</option>
          <option value="pending">Pending</option>
          <option value="failed">Failed</option>
        </select>
        <select className={SELECT} value={filters.content ?? ''} onChange={(e) => setF({ content: (e.target.value || undefined) as GiftGrantFilters['content'] })}>
          <option value="">All contents</option>
          <option value="includes_credits">Includes credits</option>
          <option value="skills_only">Skills only</option>
        </select>
        <input className={`${INPUT} max-w-[14rem]`} placeholder="Search email…" value={filters.email ?? ''} onChange={(e) => setF({ email: e.target.value || undefined })} />
        <button type="button" className={BTN_SECONDARY} onClick={handleBulkRetry} title="Resend all failed emails in the filter">
          <RotateCw className="h-4 w-4" /> Retry failed
        </button>
      </div>

      <p className="text-xs text-[var(--coachio-admin-dashboard-text-soft)]">{total} grants match the filter{total > items.length ? ` (showing ${items.length})` : ''}.</p>

      {/* Table */}
      <div className="overflow-x-auto rounded-[var(--coachio-admin-dashboard-radius-md,0.5rem)] border border-[var(--coachio-admin-dashboard-border)]">
        <table className={TABLE}>
          <thead>
            <tr>
              <th className={TH}>Recipient</th>
              <th className={TH}>Gift</th>
              <th className={TH}>Granted</th>
              <th className={TH}>Source</th>
              <th className={TH}>Time</th>
              <th className={TH}>Email</th>
              <th className={TH}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td className={TD} colSpan={7}>Loading…</td></tr>}
            {!loading && items.length === 0 && <tr><td className={TD} colSpan={7}>No grants yet.</td></tr>}
            {items.map((g) => (
              <tr key={g.id} className="cursor-pointer hover:bg-[var(--coachio-admin-dashboard-surface-hover)]" onClick={() => setDetailId(g.id)}>
                <td className={TD}>
                  <div className="font-medium">{g.email}</div>
                  {g.recipient_name && <div className="text-xs text-[var(--coachio-admin-dashboard-text-soft)]">{g.recipient_name}</div>}
                  {g.new_account_created && <span className="text-[10px] font-semibold text-sky-700">NEW ACCOUNT</span>}
                </td>
                <td className={TD}>{giftName(g.gift_id)}</td>
                <td className={TD}>
                  {g.unlocked_skills && <span className="mr-1">skills</span>}
                  {g.credits_granted > 0 && <span className="mr-1">{g.credits_granted.toLocaleString('en-US')} credits</span>}
                  {!g.unlocked_skills && g.credits_granted === 0 && '—'}
                </td>
                <td className={TD}>{g.source_type === 'campaign' ? 'Campaign' : 'Automatic'}</td>
                <td className={TD}>{formatVnDateTime(g.granted_at)}</td>
                <td className={TD}><span className={badgeClass(g.email_status)}>{g.email_status}</span></td>
                <td className={TD} onClick={(e) => e.stopPropagation()}>
                  <button type="button" className={BTN_SECONDARY} onClick={() => handleResend(g.id)} title="Resend email"><Mail className="h-4 w-4" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {detailId && (
        <GrantDetailDrawer grantId={detailId} giftName={giftName} onClose={() => setDetailId(null)} onResend={handleResend} />
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className={PANEL}>
      <p className="text-xs uppercase tracking-wide text-[var(--coachio-admin-dashboard-text-soft)]">{label}</p>
      <p className="mt-1 text-xl font-semibold text-[var(--coachio-admin-dashboard-text)]">{value}</p>
    </div>
  );
}

function GrantDetailDrawer({
  grantId,
  giftName,
  onClose,
  onResend,
}: {
  grantId: string;
  giftName: (id: string) => string;
  onClose: () => void;
  onResend: (id: string) => void;
}) {
  const { error: toastError } = useToast();
  const [d, setD] = useState<GiftGrantDetail | null>(null);

  useEffect(() => {
    adminGiftGrantsApi.detail(grantId).then(setD).catch((e) => toastError(getApiErrorMessage(e, 'Failed to load details')));
  }, [grantId, toastError]);

  return (
    <div className="fixed inset-0 z-[100]">
      <button type="button" aria-label="Close" className="absolute inset-0 bg-black/40" onClick={onClose} />
      <aside className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col overflow-auto bg-[var(--coachio-admin-dashboard-surface)] p-5 shadow-[var(--coachio-admin-dashboard-shadow-modal)]">
        <div className="flex items-start justify-between">
          <h3 className="text-base font-semibold">Grant details</h3>
          <button type="button" onClick={onClose} className="rounded p-1 hover:bg-[var(--coachio-admin-dashboard-surface-hover)]"><X className="h-4 w-4" /></button>
        </div>
        {!d ? (
          <p className="mt-4 text-sm text-[var(--coachio-admin-dashboard-text-soft)]">Loading…</p>
        ) : (
          <div className="mt-4 flex flex-col gap-2 text-sm">
            <Row k="Email" v={d.email} />
            <Row k="Name" v={d.recipient_name ?? '—'} />
            <Row k="Phone" v={d.recipient_phone ?? '—'} />
            <Row k="Gift" v={d.gift_name ?? giftName(d.gift_id)} />
            <Row k="Skills unlocked" v={d.unlocked_skills ? 'Yes' : 'No'} />
            <Row k="Credits granted" v={d.credits_granted.toLocaleString('en-US')} />
            <Row k="Current balance" v={d.current_credit_balance != null ? d.current_credit_balance.toLocaleString('en-US') : '—'} />
            <Row k="New account" v={d.new_account_created ? 'Yes' : 'No'} />
            <Row k="Source" v={d.source_label ?? d.source ?? '—'} />
            <Row k="Email status" v={d.email_status} />
            <Row k="Sent at" v={formatVnDateTime(d.email_sent_at)} />
            <Row k="Resend count" v={String(d.resend_count)} />
            {d.email_error && <Row k="Email error" v={d.email_error} />}
            <Row k="Granted at" v={formatVnDateTime(d.granted_at)} />
            {d.external_items_snapshot && d.external_items_snapshot.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase text-[var(--coachio-admin-dashboard-text-soft)]">Resources sent</p>
                <ul className="mt-1 list-disc pl-5">
                  {d.external_items_snapshot.map((it, i) => <li key={i}><a className="text-[var(--coachio-admin-dashboard-accent)]" href={it.url} target="_blank" rel="noreferrer">{it.label}</a></li>)}
                </ul>
              </div>
            )}
            <button type="button" className={`${BTN_PRIMARY} mt-3`} onClick={() => onResend(d.id)}>
              <Mail className="h-4 w-4" /> Resend email
            </button>
          </div>
        )}
      </aside>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-[var(--coachio-admin-dashboard-border)] py-1">
      <span className="text-[var(--coachio-admin-dashboard-text-soft)]">{k}</span>
      <span className="text-right font-medium text-[var(--coachio-admin-dashboard-text)]">{v}</span>
    </div>
  );
}
