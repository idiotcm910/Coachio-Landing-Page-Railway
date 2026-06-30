'use client';

import { useCallback, useEffect, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import {
  adminFunnelsApi,
  adminGiftAutomationsApi,
  adminGiftsApi,
  getApiErrorMessage,
  type Funnel,
  type Gift,
  type GiftAutomation,
  type GiftTriggerStatus,
} from '@coachio/api-client';
import { AdminModal } from '../shared/AdminModal';
import { useToast } from '../shared/toast';
import { GiftEmailEditor } from './GiftEmailEditor';
import { BTN_PRIMARY, BTN_SECONDARY, FIELD, INPUT, LABEL, SELECT, TABLE, TD, TH } from './gift-ui';

const STATUS_LABEL: Record<GiftTriggerStatus, string> = {
  purchased: 'Purchased',
  subscribed: 'Subscribed (not paid)',
  lead: 'Lead (entered checkout)',
};

export function AdminGiftAutomationManagement() {
  const { success, error: toastError } = useToast();
  const [items, setItems] = useState<GiftAutomation[]>([]);
  const [gifts, setGifts] = useState<Gift[]>([]);
  const [funnels, setFunnels] = useState<Funnel[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<GiftAutomation | null>(null);
  const [creating, setCreating] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [a, g, f] = await Promise.all([
        adminGiftAutomationsApi.list(),
        adminGiftsApi.list(false),
        adminFunnelsApi.list(),
      ]);
      setItems(a);
      setGifts(g);
      setFunnels(f);
    } catch (e) {
      toastError(getApiErrorMessage(e, 'Failed to load automations'));
    } finally {
      setLoading(false);
    }
  }, [toastError]);

  useEffect(() => {
    reload();
  }, [reload]);

  const giftNames = (ids?: string[] | null) =>
    (ids ?? []).map((id) => gifts.find((g) => g.id === id)?.name ?? id).join(', ') || '—';
  const funnelName = (id?: string | null) => (id ? funnels.find((f) => f.id === id)?.title ?? id : 'All funnels');

  const handleDelete = async (a: GiftAutomation) => {
    try {
      await adminGiftAutomationsApi.remove(a.id);
      success('Automation deleted');
      reload();
    } catch (e) {
      toastError(getApiErrorMessage(e, 'Failed to delete'));
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <button type="button" className={BTN_PRIMARY} onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" /> Create automation
        </button>
      </div>

      <div className="overflow-x-auto rounded-[var(--coachio-admin-dashboard-radius-md,0.5rem)] border border-[var(--coachio-admin-dashboard-border)]">
        <table className={TABLE}>
          <thead>
            <tr>
              <th className={TH}>Gift</th>
              <th className={TH}>Funnel</th>
              <th className={TH}>Trigger when</th>
              <th className={TH}>Status</th>
              <th className={TH}>Limit</th>
              <th className={TH}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td className={TD} colSpan={6}>Loading…</td></tr>}
            {!loading && items.length === 0 && <tr><td className={TD} colSpan={6}>No automations yet.</td></tr>}
            {items.map((a) => (
              <tr key={a.id}>
                <td className={TD}>{giftNames(a.gift_ids)}</td>
                <td className={TD}>{funnelName(a.funnel_id)}</td>
                <td className={TD}>{STATUS_LABEL[a.trigger_status]}</td>
                <td className={TD}>{a.is_active ? 'On' : 'Off'}</td>
                <td className={TD}>{a.max_total_grants ? `${a.grants_count}/${a.max_total_grants}` : `${a.grants_count} (∞)`}</td>
                <td className={TD}>
                  <div className="flex gap-2">
                    <button type="button" className={BTN_SECONDARY} onClick={() => setEditing(a)} title="Edit"><Pencil className="h-4 w-4" /></button>
                    <button type="button" className={BTN_SECONDARY} onClick={() => handleDelete(a)} title="Delete"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(creating || editing) && (
        <AutomationModal
          automation={editing}
          gifts={gifts}
          funnels={funnels}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSaved={() => { setCreating(false); setEditing(null); reload(); }}
        />
      )}
    </div>
  );
}

function AutomationModal({
  automation,
  gifts,
  funnels,
  onClose,
  onSaved,
}: {
  automation: GiftAutomation | null;
  gifts: Gift[];
  funnels: Funnel[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { success, error: toastError } = useToast();
  const [giftIds, setGiftIds] = useState<string[]>(automation?.gift_ids ?? []);
  const [funnelId, setFunnelId] = useState(automation?.funnel_id ?? '');
  const [triggerStatus, setTriggerStatus] = useState<GiftTriggerStatus>(automation?.trigger_status ?? 'purchased');
  const [isActive, setIsActive] = useState(automation?.is_active ?? true);
  const [cap, setCap] = useState(automation?.max_total_grants ? String(automation.max_total_grants) : '');
  const [emailSubject, setEmailSubject] = useState(automation?.email_subject ?? 'Your gift from Coachio');
  const [emailHtml, setEmailHtml] = useState(
    automation?.email_html ?? '<p>Hi {{recipient_name}},</p>\n<p>Thank you! Here is your gift.</p>',
  );
  const [saving, setSaving] = useState(false);

  const toggleGift = (id: string) =>
    setGiftIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  const handleSave = async () => {
    if (!giftIds.length) {
      toastError('Select at least 1 gift');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        gift_ids: giftIds,
        funnel_id: funnelId || null,
        trigger_status: triggerStatus,
        is_active: isActive,
        max_total_grants: cap ? Number(cap) : null,
        email_subject: emailSubject,
        email_html: emailHtml,
      };
      if (automation) {
        await adminGiftAutomationsApi.update(automation.id, payload);
        success('Automation updated');
      } else {
        await adminGiftAutomationsApi.create(payload);
        success('Automation created');
      }
      onSaved();
    } catch (e) {
      toastError(getApiErrorMessage(e, 'Failed to save automation'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminModal
      title={automation ? 'Edit automation' : 'Create automation'}
      subtitle="Auto-send gifts when a lead reaches a status in the funnel"
      onClose={onClose}
      maxWidthClassName="max-w-[80rem]"
      footer={
        <>
          <button type="button" className={BTN_SECONDARY} onClick={onClose}>Cancel</button>
          <button type="button" className={BTN_PRIMARY} onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className={FIELD}>
          <span className={LABEL}>Gift (select one or more)</span>
          <div className="flex flex-wrap gap-2 rounded-[var(--coachio-admin-dashboard-radius-sm)] border border-[var(--coachio-admin-dashboard-border)] p-2">
            {gifts.map((g) => (
              <label key={g.id} className="flex items-center gap-1 text-sm">
                <input type="checkbox" checked={giftIds.includes(g.id)} onChange={() => toggleGift(g.id)} />
                {g.name}
              </label>
            ))}
            {gifts.length === 0 && <span className="text-xs text-[var(--coachio-admin-dashboard-text-soft)]">No gifts yet</span>}
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <label className={FIELD}>
            <span className={LABEL}>Funnel</span>
            <select className={SELECT} value={funnelId} onChange={(e) => setFunnelId(e.target.value)}>
              <option value="">All funnels</option>
              {funnels.map((f) => <option key={f.id} value={f.id}>{f.title}</option>)}
            </select>
          </label>
          <label className={FIELD}>
            <span className={LABEL}>Trigger when</span>
            <select className={SELECT} value={triggerStatus} onChange={(e) => setTriggerStatus(e.target.value as GiftTriggerStatus)}>
              <option value="purchased">{STATUS_LABEL.purchased}</option>
              <option value="subscribed">{STATUS_LABEL.subscribed}</option>
              <option value="lead">{STATUS_LABEL.lead}</option>
            </select>
          </label>
          <label className={FIELD}>
            <span className={LABEL}>Recipient limit (leave blank = unlimited)</span>
            <input type="number" min={1} className={INPUT} value={cap} onChange={(e) => setCap(e.target.value)} placeholder="e.g. 100" />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            Active
          </label>
        </div>
        <div>
          <span className={LABEL}>Delivery email</span>
          <div className="mt-2">
            <GiftEmailEditor
              gifts={gifts}
              giftIds={giftIds}
              subject={emailSubject}
              html={emailHtml}
              onChange={(patch) => {
                if (patch.subject !== undefined) setEmailSubject(patch.subject);
                if (patch.html !== undefined) setEmailHtml(patch.html);
              }}
            />
          </div>
        </div>
      </div>
    </AdminModal>
  );
}
