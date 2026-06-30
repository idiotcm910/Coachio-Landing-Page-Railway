'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Gift,
  ListChecks,
  Loader2,
  PlayCircle,
  Trophy,
  Users,
} from 'lucide-react';
import { adminLuckyEventsApi, getApiErrorMessage, type LuckyEvent } from '@coachio/api-client';
import { useToast } from '../shared/toast';
import { LuckyEventStatusBadge } from './LuckyEventStatusBadge';
import { LuckyDrawFormTab } from './LuckyDrawFormTab';
import { LuckyDrawSuccessTab } from './LuckyDrawSuccessTab';
import { LuckyDrawPrizesTab } from './LuckyDrawPrizesTab';
import { LuckyDrawParticipantsTab } from './LuckyDrawParticipantsTab';
import { LuckyDrawSpinTab } from './LuckyDrawSpinTab';
import { LuckyDrawWinnersTab } from './LuckyDrawWinnersTab';

export type LuckyDrawTab = 'form' | 'success' | 'prizes' | 'participants' | 'spin' | 'winners';

const TABS: { id: LuckyDrawTab; label: string; icon: typeof ListChecks }[] = [
  { id: 'form', label: 'Form', icon: ListChecks },
  { id: 'success', label: 'Success', icon: CheckCircle2 },
  { id: 'prizes', label: 'Prizes', icon: Gift },
  { id: 'participants', label: 'Participants', icon: Users },
  { id: 'spin', label: 'Spin', icon: PlayCircle },
  { id: 'winners', label: 'Winners', icon: Trophy },
];

interface AdminLuckyDrawEditShellProps {
  eventId: string;
  tab: LuckyDrawTab;
}

export function AdminLuckyDrawEditShell({ eventId, tab }: AdminLuckyDrawEditShellProps) {
  const router = useRouter();
  const { error: toastError } = useToast();
  const [event, setEvent] = useState<LuckyEvent | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    adminLuckyEventsApi
      .get(eventId)
      .then((ev) => {
        if (mounted) setEvent(ev);
      })
      .catch((e) => {
        if (mounted) {
          const msg = getApiErrorMessage(e, 'Failed to load event');
          setError(msg);
          toastError(msg);
        }
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });
    return () => {
      mounted = false;
    };
    // toastError is stable from context; eventId drives the fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  function navigateTo(next: LuckyDrawTab) {
    router.push(`/admin/lucky-draw/${eventId}/edit/${next}`);
  }

  if (isLoading) {
    return (
      <main className="grid min-h-screen place-items-center bg-[var(--coachio-admin-dashboard-background,#f8fafc)]">
        <div className="flex items-center gap-3 text-sm font-semibold text-[var(--coachio-admin-dashboard-text-muted)]">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading event…
        </div>
      </main>
    );
  }

  if (error || !event) {
    return (
      <main className="grid min-h-screen place-items-center bg-[var(--coachio-admin-dashboard-background,#f8fafc)] p-6">
        <div className="flex max-w-md flex-col items-center gap-3 text-center">
          <AlertCircle className="h-8 w-8 text-[var(--coachio-admin-dashboard-danger-text)]" />
          <p className="text-sm font-semibold text-[var(--coachio-admin-dashboard-text)]">{error || 'Event not found'}</p>
          <button
            type="button"
            onClick={() => router.push('/admin/lucky-draw')}
            className="inline-flex h-10 items-center gap-2 rounded-[var(--coachio-admin-dashboard-radius-sm)] bg-[var(--coachio-admin-dashboard-accent)] px-4 text-sm font-semibold text-[var(--coachio-admin-dashboard-text-inverse)]"
          >
            Back to events
          </button>
        </div>
      </main>
    );
  }

  function renderContent() {
    if (!event) return null;
    switch (tab) {
      case 'form':
        return <LuckyDrawFormTab event={event} onUpdated={setEvent} />;
      case 'success':
        return <LuckyDrawSuccessTab event={event} onUpdated={setEvent} />;
      case 'prizes':
        return <LuckyDrawPrizesTab eventId={event.id} />;
      case 'participants':
        return <LuckyDrawParticipantsTab event={event} onUpdated={setEvent} />;
      case 'spin':
        return <LuckyDrawSpinTab eventId={event.id} status={event.status} />;
      case 'winners':
        return <LuckyDrawWinnersTab eventId={event.id} />;
      default:
        return null;
    }
  }

  return (
    <main className="min-h-screen bg-[var(--coachio-admin-dashboard-background,#f8fafc)] text-[var(--coachio-admin-dashboard-text)]">
      {/* Header */}
      <div className="border-b border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface)] px-4 py-4 shadow-[var(--coachio-admin-dashboard-shadow-sm)] md:px-8 md:py-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => router.push('/admin/lucky-draw')}
              className="grid h-10 w-10 place-items-center rounded-[var(--coachio-admin-dashboard-radius-sm)] border border-[var(--coachio-admin-dashboard-border)] text-[var(--coachio-admin-dashboard-text-muted)] transition hover:bg-[var(--coachio-admin-dashboard-surface-hover)]"
              aria-label="Back to events"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--coachio-admin-dashboard-text-soft)]">Lucky Draw</p>
              <h1 className="text-xl font-semibold text-[var(--coachio-admin-dashboard-text)]">{event.title}</h1>
            </div>
          </div>
          <LuckyEventStatusBadge status={event.status} />
        </div>
      </div>

      <div className="mx-auto flex max-w-6xl flex-col gap-6 p-4 md:flex-row md:p-8">
        {/* Sidebar tabs */}
        <nav className="flex gap-2 overflow-x-auto md:w-52 md:shrink-0 md:flex-col md:overflow-visible">
          {TABS.map((t) => {
            const active = t.id === tab;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => navigateTo(t.id)}
                className={`flex shrink-0 items-center gap-2 rounded-[var(--coachio-admin-dashboard-radius-sm)] px-3 py-2.5 text-sm font-semibold transition ${
                  active
                    ? 'bg-[var(--coachio-admin-dashboard-accent)] text-[var(--coachio-admin-dashboard-text-inverse)]'
                    : 'border border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface)] text-[var(--coachio-admin-dashboard-text-muted)] hover:bg-[var(--coachio-admin-dashboard-surface-hover)]'
                }`}
              >
                <t.icon className="h-4 w-4" />
                {t.label}
              </button>
            );
          })}
        </nav>

        {/* Content */}
        <div className="min-w-0 flex-1">{renderContent()}</div>
      </div>
    </main>
  );
}
