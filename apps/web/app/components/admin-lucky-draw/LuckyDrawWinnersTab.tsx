'use client';

import { useEffect, useState } from 'react';
import { Loader2, RefreshCw, Trophy } from 'lucide-react';
import { adminLuckyEventsApi, getApiErrorMessage, type LuckyWinner } from '@coachio/api-client';
import { useToast } from '../shared/toast';
import { cardClass, ghostButtonClass } from './luckyDrawStyles';
import { maskEmail, maskPhone } from './luckyDrawMask';

export function LuckyDrawWinnersTab({ eventId }: { eventId: string }) {
  const { error: toastError } = useToast();
  const [winners, setWinners] = useState<LuckyWinner[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function load(silent = false) {
    if (silent) setRefreshing(true);
    try {
      const list = await adminLuckyEventsApi.listWinners(eventId);
      setWinners(list);
    } catch (e) {
      toastError(getApiErrorMessage(e, 'Failed to load winners'));
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  return (
    <div className="space-y-4">
      <div className={`flex items-center justify-between gap-3 ${cardClass}`}>
        <div className="inline-flex items-center gap-2 text-base font-semibold text-[var(--coachio-admin-dashboard-text)]">
          <Trophy className="h-5 w-5 text-[var(--coachio-admin-dashboard-accent)]" />
          {winners.length} winners
        </div>
        <button type="button" onClick={() => load(true)} disabled={refreshing} className={ghostButtonClass}>
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-3 text-sm font-semibold text-[var(--coachio-admin-dashboard-text-muted)]">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading winners…
        </div>
      ) : winners.length === 0 ? (
        <div className={`${cardClass} text-center text-sm text-[var(--coachio-admin-dashboard-text-muted)]`}>No winners drawn yet.</div>
      ) : (
        <div className="overflow-hidden rounded-[var(--coachio-admin-dashboard-radius-lg)] border border-[var(--coachio-admin-dashboard-border)]">
          {winners.map((w, i) => (
            <div
              key={w.id}
              className={`flex items-center justify-between gap-3 px-4 py-3 ${i % 2 ? 'bg-[var(--coachio-admin-dashboard-surface-muted)]' : 'bg-[var(--coachio-admin-dashboard-surface)]'}`}
            >
              <div className="flex items-center gap-3">
                <span className="grid h-7 w-7 place-items-center rounded-full bg-[var(--coachio-admin-dashboard-accent-soft)] text-xs font-bold text-[var(--coachio-admin-dashboard-accent)]">
                  {w.spin_order}
                </span>
                <div>
                  <p className="text-sm font-semibold text-[var(--coachio-admin-dashboard-text)]">
                    {w.display_name ?? '—'}
                    <span className="ml-2 font-mono text-xs font-normal text-[var(--coachio-admin-dashboard-text-soft)]" title={w.participant_id}>
                      #{w.participant_id.slice(0, 8)}
                    </span>
                  </p>
                  <p className="text-xs text-[var(--coachio-admin-dashboard-text-soft)]">{w.prize_name ?? 'Prize'}</p>
                  {(w.phone || w.email) && (
                    <p className="text-xs text-[var(--coachio-admin-dashboard-text-soft)]">
                      {[w.phone && maskPhone(w.phone), w.email && maskEmail(w.email)].filter(Boolean).join(' · ')}
                    </p>
                  )}
                </div>
              </div>
              <span className="text-xs text-[var(--coachio-admin-dashboard-text-soft)]">{new Date(w.won_at).toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
