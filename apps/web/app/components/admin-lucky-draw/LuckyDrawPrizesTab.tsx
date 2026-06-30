'use client';

import { useEffect, useState } from 'react';
import { Gift, Loader2, Plus, Trash2 } from 'lucide-react';
import { adminLuckyEventsApi, getApiErrorMessage, type LuckyPrize } from '@coachio/api-client';
import { useToast } from '../shared/toast';
import { cardClass, ghostButtonClass, inputClass, labelClass, primaryButtonClass } from './luckyDrawStyles';

export function LuckyDrawPrizesTab({ eventId }: { eventId: string }) {
  const { success, error: toastError } = useToast();
  const [prizes, setPrizes] = useState<LuckyPrize[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  const [newName, setNewName] = useState('');
  const [newQty, setNewQty] = useState(1);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let mounted = true;
    adminLuckyEventsApi
      .listPrizes(eventId)
      .then((p) => mounted && setPrizes(p))
      .catch((e) => mounted && toastError(getApiErrorMessage(e, 'Failed to load prizes')))
      .finally(() => mounted && setIsLoading(false));
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  async function handleCreate() {
    if (!newName.trim() || newQty < 1) {
      toastError('Enter a prize name and a valid quantity');
      return;
    }
    setCreating(true);
    try {
      const created = await adminLuckyEventsApi.createPrize(eventId, {
        name: newName.trim(),
        quantity: newQty,
        sort_order: prizes.length,
      });
      setPrizes((prev) => [...prev, created]);
      setNewName('');
      setNewQty(1);
      success('Prize added');
    } catch (e) {
      toastError(getApiErrorMessage(e, 'Failed to add prize'));
    } finally {
      setCreating(false);
    }
  }

  async function handleUpdate(prize: LuckyPrize, patch: Partial<Pick<LuckyPrize, 'name' | 'quantity'>>) {
    setSavingId(prize.id);
    try {
      const updated = await adminLuckyEventsApi.updatePrize(eventId, prize.id, patch);
      setPrizes((prev) => prev.map((p) => (p.id === prize.id ? updated : p)));
      success('Prize updated');
    } catch (e) {
      toastError(getApiErrorMessage(e, 'Failed to update prize'));
    } finally {
      setSavingId(null);
    }
  }

  async function handleDelete(prize: LuckyPrize) {
    if (!confirm(`Delete prize "${prize.name}"?`)) return;
    try {
      await adminLuckyEventsApi.removePrize(eventId, prize.id);
      setPrizes((prev) => prev.filter((p) => p.id !== prize.id));
      success('Prize deleted');
    } catch (e) {
      toastError(getApiErrorMessage(e, 'Failed to delete prize'));
    }
  }

  return (
    <div className="space-y-4">
      <div className={cardClass}>
        <h3 className="mb-1 text-base font-semibold text-[var(--coachio-admin-dashboard-text)]">Prizes</h3>
        <p className="text-xs text-[var(--coachio-admin-dashboard-text-soft)]">
          Each prize has a quantity — the number of winners it can yield across spins.
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-3 text-sm font-semibold text-[var(--coachio-admin-dashboard-text-muted)]">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading prizes…
        </div>
      ) : (
        prizes.map((prize) => (
          <div key={prize.id} className={`flex flex-wrap items-end gap-3 ${cardClass}`}>
            <label className="flex flex-1 flex-col gap-1">
              <span className={labelClass}>Name</span>
              <input
                className={inputClass}
                defaultValue={prize.name}
                onBlur={(e) => e.target.value.trim() !== prize.name && handleUpdate(prize, { name: e.target.value.trim() })}
              />
            </label>
            <label className="flex w-28 flex-col gap-1">
              <span className={labelClass}>Quantity</span>
              <input
                type="number"
                min={1}
                className={inputClass}
                defaultValue={prize.quantity}
                onBlur={(e) => {
                  const q = Math.max(1, Number(e.target.value) || 1);
                  if (q !== prize.quantity) handleUpdate(prize, { quantity: q });
                }}
              />
            </label>
            <div className="flex flex-col gap-1">
              <span className={labelClass}>Awarded</span>
              <span className="inline-flex h-9 items-center rounded-[var(--coachio-admin-dashboard-radius-sm)] bg-[var(--coachio-admin-dashboard-surface-muted)] px-3 text-sm font-semibold text-[var(--coachio-admin-dashboard-text)]">
                {prize.awarded_count} / {prize.quantity}
              </span>
            </div>
            {savingId === prize.id && <Loader2 className="mb-2 h-4 w-4 animate-spin text-[var(--coachio-admin-dashboard-text-muted)]" />}
            <button
              type="button"
              onClick={() => handleDelete(prize)}
              className="mb-0.5 grid h-9 w-9 place-items-center rounded-[var(--coachio-admin-dashboard-radius-sm)] border border-[var(--coachio-admin-dashboard-border)] text-[var(--coachio-admin-dashboard-danger-text)] transition hover:bg-[var(--coachio-admin-dashboard-danger-bg)]"
              aria-label="Delete prize"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))
      )}

      {/* Add prize */}
      <div className={`flex flex-wrap items-end gap-3 ${cardClass}`}>
        <Gift className="mb-2 h-5 w-5 text-[var(--coachio-admin-dashboard-text-soft)]" />
        <label className="flex flex-1 flex-col gap-1">
          <span className={labelClass}>New prize name</span>
          <input className={inputClass} value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. First prize" />
        </label>
        <label className="flex w-28 flex-col gap-1">
          <span className={labelClass}>Quantity</span>
          <input type="number" min={1} className={inputClass} value={newQty} onChange={(e) => setNewQty(Math.max(1, Number(e.target.value) || 1))} />
        </label>
        <button type="button" onClick={handleCreate} disabled={creating} className={primaryButtonClass}>
          {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Add
        </button>
      </div>
    </div>
  );
}
