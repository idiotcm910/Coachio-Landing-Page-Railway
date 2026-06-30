'use client';

import { useCallback, useEffect, useState } from 'react';
import { Eye, Pencil, Plus, Trash2 } from 'lucide-react';
import {
  adminFunnelsApi,
  adminGiftCampaignsApi,
  adminGiftsApi,
  getApiErrorMessage,
  type Funnel,
  type Gift,
  type GiftCampaign,
} from '@coachio/api-client';
import { AdminModal } from '../shared/AdminModal';
import { useToast } from '../shared/toast';
import { GiftCampaignFormModal } from './GiftCampaignFormModal';
import { GiftCampaignProgress } from './GiftCampaignProgress';
import { BTN_PRIMARY, BTN_SECONDARY, TABLE, TD, TH, badgeClass, formatVnDateTime } from './gift-ui';

export function AdminGiftCampaignManagement() {
  const { success, error: toastError } = useToast();
  const [items, setItems] = useState<GiftCampaign[]>([]);
  const [gifts, setGifts] = useState<Gift[]>([]);
  const [funnels, setFunnels] = useState<Funnel[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<GiftCampaign | null>(null);
  const [creating, setCreating] = useState(false);
  const [viewing, setViewing] = useState<GiftCampaign | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [c, g, f] = await Promise.all([
        adminGiftCampaignsApi.list(),
        adminGiftsApi.list(false),
        adminFunnelsApi.list(),
      ]);
      setItems(c);
      setGifts(g);
      setFunnels(f);
    } catch (e) {
      toastError(getApiErrorMessage(e, 'Failed to load campaigns'));
    } finally {
      setLoading(false);
    }
  }, [toastError]);

  useEffect(() => { reload(); }, [reload]);

  const giftNames = (ids?: string[] | null) =>
    (ids ?? []).map((id) => gifts.find((g) => g.id === id)?.name ?? id).join(', ') || '—';

  const handleUpdated = (updated: GiftCampaign) => {
    setItems((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    setViewing((v) => (v && v.id === updated.id ? updated : v));
  };

  const handleDelete = async (c: GiftCampaign) => {
    try {
      await adminGiftCampaignsApi.remove(c.id);
      success('Campaign deleted');
      reload();
    } catch (e) {
      toastError(getApiErrorMessage(e, 'Failed to delete campaign'));
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <button type="button" className={BTN_PRIMARY} onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" /> Create campaign
        </button>
      </div>

      <div className="overflow-x-auto rounded-[var(--coachio-admin-dashboard-radius-md,0.5rem)] border border-[var(--coachio-admin-dashboard-border)]">
        <table className={TABLE}>
          <thead>
            <tr>
              <th className={TH}>Name</th>
              <th className={TH}>Gift</th>
              <th className={TH}>Status</th>
              <th className={TH}>Recipients</th>
              <th className={TH}>Sent/Failed/Skipped</th>
              <th className={TH}>Schedule</th>
              <th className={TH}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td className={TD} colSpan={7}>Loading…</td></tr>}
            {!loading && items.length === 0 && <tr><td className={TD} colSpan={7}>No campaigns yet.</td></tr>}
            {items.map((c) => (
              <tr key={c.id}>
                <td className={TD}>{c.name}</td>
                <td className={TD}>{giftNames(c.gift_ids)}</td>
                <td className={TD}><span className={badgeClass(c.status)}>{c.status}</span></td>
                <td className={TD}>{c.total_recipients}</td>
                <td className={TD}>{c.sent_count}/{c.failed_count}/{c.skipped_count}</td>
                <td className={TD}>{c.scheduled_at ? formatVnDateTime(c.scheduled_at) : '—'}</td>
                <td className={TD}>
                  <div className="flex flex-wrap gap-2">
                    {c.status === 'draft' ? (
                      <>
                        <button type="button" className={BTN_SECONDARY} onClick={() => setEditing(c)}>
                          <Pencil className="h-4 w-4" /> Edit
                        </button>
                        <button type="button" className={BTN_SECONDARY} onClick={() => handleDelete(c)}>
                          <Trash2 className="h-4 w-4" /> Delete
                        </button>
                      </>
                    ) : (
                      <button type="button" className={BTN_SECONDARY} onClick={() => setViewing(c)}>
                        <Eye className="h-4 w-4" /> View
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(creating || editing) && (
        <GiftCampaignFormModal
          campaign={editing}
          gifts={gifts}
          funnels={funnels}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSaved={() => { setCreating(false); setEditing(null); reload(); }}
        />
      )}

      {viewing && (
        <AdminModal
          title={viewing.name}
          subtitle="Gift delivery progress"
          onClose={() => setViewing(null)}
          maxWidthClassName="max-w-3xl"
        >
          <GiftCampaignProgress
            campaign={viewing}
            fetchStats={adminGiftCampaignsApi.stats}
            onRetryFailed={adminGiftCampaignsApi.retryFailed}
            onCancel={adminGiftCampaignsApi.cancel}
            onUpdated={handleUpdated}
          />
        </AdminModal>
      )}
    </div>
  );
}
