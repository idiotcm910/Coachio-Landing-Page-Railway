'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Dice5, Loader2, Plus, Trash2, Users } from 'lucide-react';
import {
  adminFunnelsApi,
  adminLuckyEventsApi,
  getApiErrorMessage,
  type Funnel,
  type LuckyEventListItem,
} from '@coachio/api-client';
import { useToast } from '../shared/toast';
import { LuckyEventStatusBadge } from './LuckyEventStatusBadge';
import { cardClass, ghostButtonClass, inputClass, labelClass, primaryButtonClass } from './luckyDrawStyles';

export function AdminLuckyDrawManagement() {
  const router = useRouter();
  const { success, error: toastError } = useToast();
  const [events, setEvents] = useState<LuckyEventListItem[]>([]);
  const [funnels, setFunnels] = useState<Funnel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [funnelFilter, setFunnelFilter] = useState('');

  const [showCreate, setShowCreate] = useState(false);
  const [createFunnelId, setCreateFunnelId] = useState('');
  const [createTitle, setCreateTitle] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  useEffect(() => {
    let mounted = true;
    Promise.all([adminLuckyEventsApi.list(), adminFunnelsApi.list()])
      .then(([ev, fl]) => {
        if (mounted) {
          setEvents(ev);
          setFunnels(fl);
        }
      })
      .catch((e) => {
        if (mounted) setError(getApiErrorMessage(e, 'Failed to load lucky-draw events'));
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const funnelTitleById = useMemo(() => {
    const map = new Map<string, string>();
    funnels.forEach((f) => map.set(f.id, f.title));
    return map;
  }, [funnels]);

  const visibleEvents = useMemo(
    () => (funnelFilter ? events.filter((e) => e.funnel_id === funnelFilter) : events),
    [events, funnelFilter],
  );

  async function handleCreate() {
    if (!createFunnelId || !createTitle.trim()) {
      setCreateError('Funnel and title are required.');
      return;
    }
    setCreating(true);
    setCreateError('');
    try {
      const created = await adminLuckyEventsApi.create({ funnel_id: createFunnelId, title: createTitle.trim() });
      success('Event created');
      router.push(`/admin/lucky-draw/${created.id}/edit/form`);
    } catch (e) {
      const msg = getApiErrorMessage(e, 'Không thể tạo sự kiện quay số');
      setCreateError(msg);
      toastError(msg);
      setCreating(false);
    }
  }

  async function handleDelete(event: LuckyEventListItem) {
    if (!confirm(`Delete "${event.title}"? This removes its participants, prizes and winners.`)) return;
    try {
      await adminLuckyEventsApi.remove(event.id);
      setEvents((prev) => prev.filter((e) => e.id !== event.id));
      success('Event deleted');
    } catch (e) {
      toastError(getApiErrorMessage(e, 'Failed to delete event'));
    }
  }

  return (
    <section className="space-y-6">
      {/* Header */}
      <div className={`flex flex-col gap-4 ${cardClass} lg:flex-row lg:items-center lg:justify-between`}>
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-[var(--coachio-admin-dashboard-radius-sm)] border border-[var(--coachio-admin-dashboard-accent-soft)] bg-[var(--coachio-admin-dashboard-accent-soft)] px-3 py-1 text-xs font-semibold uppercase text-[var(--coachio-admin-dashboard-accent)]">
            <Dice5 className="h-4 w-4" />
            Lucky draw
          </div>
          <h2 className="text-2xl font-semibold text-[var(--coachio-admin-dashboard-text)]">Lucky Draw Events</h2>
          <p className="mt-2 text-sm text-[var(--coachio-admin-dashboard-text-muted)]">
            Run end-of-workshop draws. Each event belongs to one funnel and keeps its own participants and winners.
          </p>
        </div>
        <button type="button" onClick={() => { setShowCreate(true); setCreateError(''); }} className={primaryButtonClass}>
          <Plus className="h-5 w-5" />
          Create event
        </button>
      </div>

      {/* Filter */}
      {funnels.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className={labelClass}>Filter by funnel</span>
          <select className={`${inputClass} max-w-sm`} value={funnelFilter} onChange={(e) => setFunnelFilter(e.target.value)}>
            <option value="">All funnels</option>
            {funnels.map((f) => (
              <option key={f.id} value={f.id}>
                {f.title}
              </option>
            ))}
          </select>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-[var(--coachio-admin-dashboard-radius-md)] border border-[var(--coachio-admin-dashboard-danger-border)] bg-[var(--coachio-admin-dashboard-danger-bg)] px-4 py-3 text-sm font-semibold text-[var(--coachio-admin-dashboard-danger-text)]">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center gap-3 rounded-[var(--coachio-admin-dashboard-radius-md)] border border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface)] px-4 py-5 text-sm font-semibold text-[var(--coachio-admin-dashboard-text-muted)]">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading events…
        </div>
      ) : visibleEvents.length === 0 ? (
        <div className={`${cardClass} text-center`}>
          <Dice5 className="mx-auto mb-3 h-8 w-8 text-[var(--coachio-admin-dashboard-text-soft)]" />
          <p className="text-sm font-semibold text-[var(--coachio-admin-dashboard-text)]">No events yet</p>
          <p className="mt-1 text-sm text-[var(--coachio-admin-dashboard-text-muted)]">Create your first lucky-draw event to get started.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {visibleEvents.map((event) => (
            <button
              key={event.id}
              type="button"
              onClick={() => router.push(`/admin/lucky-draw/${event.id}/edit/form`)}
              className={`flex w-full flex-col gap-3 ${cardClass} text-left transition hover:border-[var(--coachio-admin-dashboard-accent)] sm:flex-row sm:items-center sm:justify-between`}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-3">
                  <h3 className="truncate text-base font-semibold text-[var(--coachio-admin-dashboard-text)]">{event.title}</h3>
                  <LuckyEventStatusBadge status={event.status} />
                </div>
                <p className="mt-1 text-xs text-[var(--coachio-admin-dashboard-text-soft)]">
                  {funnelTitleById.get(event.funnel_id) ?? 'Unknown funnel'}
                </p>
              </div>
              <div className="flex items-center gap-5">
                <span className="inline-flex items-center gap-1.5 text-sm text-[var(--coachio-admin-dashboard-text-muted)]">
                  <Users className="h-4 w-4" />
                  {event.participant_count} participants · {event.winner_count} winners
                </span>
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => { e.stopPropagation(); handleDelete(event); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); handleDelete(event); } }}
                  className="grid h-9 w-9 place-items-center rounded-[var(--coachio-admin-dashboard-radius-sm)] border border-[var(--coachio-admin-dashboard-border)] text-[var(--coachio-admin-dashboard-danger-text)] transition hover:bg-[var(--coachio-admin-dashboard-danger-bg)]"
                  aria-label="Delete event"
                >
                  <Trash2 className="h-4 w-4" />
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={() => !creating && setShowCreate(false)}>
          <div className={`w-full max-w-md ${cardClass}`} onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-4 text-lg font-semibold text-[var(--coachio-admin-dashboard-text)]">Create lucky-draw event</h3>
            <div className="space-y-3">
              <label className="flex flex-col gap-1">
                <span className={labelClass}>Funnel</span>
                <select className={inputClass} value={createFunnelId} onChange={(e) => setCreateFunnelId(e.target.value)}>
                  <option value="">Select a funnel…</option>
                  {funnels.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.title}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className={labelClass}>Title</span>
                <input className={inputClass} value={createTitle} onChange={(e) => setCreateTitle(e.target.value)} placeholder="e.g. Workshop draw — Jan 2026" />
              </label>
              {createError && <p className="text-xs font-semibold text-[var(--coachio-admin-dashboard-danger-text)]">{createError}</p>}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setShowCreate(false)} disabled={creating} className={ghostButtonClass}>
                Cancel
              </button>
              <button type="button" onClick={handleCreate} disabled={creating} className={primaryButtonClass}>
                {creating && <Loader2 className="h-4 w-4 animate-spin" />}
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
