'use client';

import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import {
  adminGiftsApi,
  getApiErrorMessage,
  type ExternalItem,
  type Gift,
} from '@coachio/api-client';
import { AdminModal } from '../shared/AdminModal';
import { useToast } from '../shared/toast';
import { BTN_DANGER, BTN_PRIMARY, BTN_SECONDARY, FIELD, INPUT, LABEL } from './gift-ui';

interface Props {
  gift?: Gift | null;
  onClose: () => void;
  onSaved: () => void;
}

export function GiftFormModal({ gift, onClose, onSaved }: Props) {
  const { success, error: toastError } = useToast();

  const [name, setName] = useState(gift?.name ?? '');
  const [description, setDescription] = useState(gift?.description ?? '');
  const [externalItems, setExternalItems] = useState<ExternalItem[]>(gift?.external_items ?? []);
  const [saving, setSaving] = useState(false);

  const updateItem = (idx: number, patch: Partial<ExternalItem>) =>
    setExternalItems((items) => items.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  const addItem = () => setExternalItems((items) => [...items, { label: '', url: '', description: '' }]);
  const removeItem = (idx: number) => setExternalItems((items) => items.filter((_, i) => i !== idx));

  const handleSave = async () => {
    if (!name.trim()) {
      toastError('Please enter a gift name');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        external_items: externalItems.filter((it) => it.label.trim() && it.url.trim()),
      };
      if (gift) {
        await adminGiftsApi.update(gift.id, payload);
        success('Gift updated');
      } else {
        await adminGiftsApi.create(payload);
        success('Gift created');
      }
      onSaved();
    } catch (e) {
      toastError(getApiErrorMessage(e, 'Failed to save gift'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminModal
      title={gift ? 'Edit gift' : 'Create gift'}
      subtitle="External resources (files/links). Email is configured on the campaign/automation."
      onClose={onClose}
      maxWidthClassName="max-w-2xl"
      footer={
        <>
          <button type="button" className={BTN_SECONDARY} onClick={onClose}>Cancel</button>
          <button type="button" className={BTN_PRIMARY} onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <label className={FIELD}>
          <span className={LABEL}>Gift name</span>
          <input className={INPUT} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Workshop closing gift" />
        </label>
        <label className={FIELD}>
          <span className={LABEL}>Description (internal)</span>
          <input className={INPUT} value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>

        {/* External items */}
        <div className="rounded-[var(--coachio-admin-dashboard-radius-md,0.5rem)] border border-[var(--coachio-admin-dashboard-border)] p-3">
          <div className="flex items-center justify-between">
            <p className={LABEL}>External resources / links</p>
            <button type="button" className={BTN_SECONDARY} onClick={addItem}>
              <Plus className="h-4 w-4" /> Add
            </button>
          </div>
          {externalItems.length === 0 && (
            <p className="mt-2 text-xs text-[var(--coachio-admin-dashboard-text-soft)]">No links yet.</p>
          )}
          <div className="mt-2 flex flex-col gap-2">
            {externalItems.map((it, idx) => (
              <div key={idx} className="flex flex-wrap items-center gap-2">
                <input className={`${INPUT} flex-1 min-w-[8rem]`} placeholder="Label" value={it.label} onChange={(e) => updateItem(idx, { label: e.target.value })} />
                <input className={`${INPUT} flex-1 min-w-[10rem]`} placeholder="https://..." value={it.url} onChange={(e) => updateItem(idx, { url: e.target.value })} />
                <input className={`${INPUT} flex-1 min-w-[8rem]`} placeholder="Description (optional)" value={it.description ?? ''} onChange={(e) => updateItem(idx, { description: e.target.value })} />
                <button type="button" className={BTN_DANGER} onClick={() => removeItem(idx)} title="Delete">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AdminModal>
  );
}
