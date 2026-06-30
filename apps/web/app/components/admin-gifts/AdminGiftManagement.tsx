'use client';

import { useCallback, useEffect, useState } from 'react';
import { Archive, Pencil, Plus } from 'lucide-react';
import { adminGiftsApi, getApiErrorMessage, type Gift } from '@coachio/api-client';
import { useToast } from '../shared/toast';
import { GiftFormModal } from './GiftFormModal';
import { BTN_PRIMARY, BTN_SECONDARY, TABLE, TD, TH, formatVnDateTime } from './gift-ui';

function perksSummary(g: Gift): string {
  const parts: string[] = [];
  if (g.external_items && g.external_items.length) parts.push(`${g.external_items.length} links`);
  return parts.length ? parts.join(' · ') : '—';
}

export function AdminGiftManagement() {
  const { success, error: toastError } = useToast();
  const [gifts, setGifts] = useState<Gift[]>([]);
  const [loading, setLoading] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState<Gift | null>(null);
  const [creating, setCreating] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setGifts(await adminGiftsApi.list(showArchived));
    } catch (e) {
      toastError(getApiErrorMessage(e, 'Failed to load gifts'));
    } finally {
      setLoading(false);
    }
  }, [showArchived, toastError]);

  useEffect(() => {
    reload();
  }, [reload]);

  const handleArchive = async (g: Gift) => {
    try {
      await adminGiftsApi.archive(g.id);
      success('Gift archived');
      reload();
    } catch (e) {
      toastError(getApiErrorMessage(e, 'Failed to archive gift'));
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm text-[var(--coachio-admin-dashboard-text-muted)]">
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
          Show archived
        </label>
        <button type="button" className={BTN_PRIMARY} onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" /> Create gift
        </button>
      </div>

      <div className="overflow-x-auto rounded-[var(--coachio-admin-dashboard-radius-md,0.5rem)] border border-[var(--coachio-admin-dashboard-border)]">
        <table className={TABLE}>
          <thead>
            <tr>
              <th className={TH}>Name</th>
              <th className={TH}>Perks</th>
              <th className={TH}>Status</th>
              <th className={TH}>Created</th>
              <th className={TH}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td className={TD} colSpan={5}>Loading…</td></tr>
            )}
            {!loading && gifts.length === 0 && (
              <tr><td className={TD} colSpan={5}>No gifts yet.</td></tr>
            )}
            {gifts.map((g) => (
              <tr key={g.id}>
                <td className={TD}>
                  <div className="font-semibold">{g.name}</div>
                  {g.description && <div className="text-xs text-[var(--coachio-admin-dashboard-text-soft)]">{g.description}</div>}
                </td>
                <td className={TD}>{perksSummary(g)}</td>
                <td className={TD}>{g.is_archived ? 'Archived' : 'Active'}</td>
                <td className={TD}>{formatVnDateTime(g.created_at)}</td>
                <td className={TD}>
                  <div className="flex gap-2">
                    <button type="button" className={BTN_SECONDARY} onClick={() => setEditing(g)} title="Edit">
                      <Pencil className="h-4 w-4" />
                    </button>
                    {!g.is_archived && (
                      <button type="button" className={BTN_SECONDARY} onClick={() => handleArchive(g)} title="Archive">
                        <Archive className="h-4 w-4" />
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
        <GiftFormModal
          gift={editing}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSaved={() => { setCreating(false); setEditing(null); reload(); }}
        />
      )}
    </div>
  );
}
