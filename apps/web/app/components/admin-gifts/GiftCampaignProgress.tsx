'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Loader2,
  RefreshCw,
  RotateCcw,
} from 'lucide-react';
import {
  getApiErrorMessage,
  type GiftCampaign,
  type GiftCampaignStats,
} from '@coachio/api-client';
import { useToast } from '../shared/toast';
import { BTN_DANGER, BTN_SECONDARY, TABLE, TD, TH, badgeClass, formatVnDateTime } from './gift-ui';

const FAILED_PAGE_SIZE = 50;
const AUTO_REFRESH_MS = 5_000;

interface Props {
  campaign: GiftCampaign;
  fetchStats: (id: string, failedPage?: number, failedSize?: number) => Promise<GiftCampaignStats>;
  onRetryFailed: (id: string) => Promise<GiftCampaign>;
  onCancel: (id: string) => Promise<GiftCampaign>;
  onUpdated: (c: GiftCampaign) => void;
}

/**
 * Gift-campaign delivery progress — stat cards, live progress bar, auto-refresh
 * while sending, cancel + resend-failed actions, and a paginated failed-recipients
 * table. Mirrors BroadcastCampaignDetail's auto-refresh pattern. Rendered as a
 * panel inside an AdminModal opened from the campaign list.
 */
export function GiftCampaignProgress({ campaign, fetchStats, onRetryFailed, onCancel, onUpdated }: Props) {
  const { success, error: toastError } = useToast();
  const [stats, setStats] = useState<GiftCampaignStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [statsError, setStatsError] = useState('');
  const [failedPage, setFailedPage] = useState(1);
  const [retrying, setRetrying] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadStats = useCallback(
    async (page = failedPage) => {
      setLoadingStats(true);
      setStatsError('');
      try {
        setStats(await fetchStats(campaign.id, page, FAILED_PAGE_SIZE));
      } catch (e) {
        setStatsError(getApiErrorMessage(e, 'Failed to load stats'));
      } finally {
        setLoadingStats(false);
      }
    },
    [campaign.id, failedPage, fetchStats],
  );

  // Initial load (per campaign).
  useEffect(() => {
    setFailedPage(1);
    loadStats(1);
  }, [campaign.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-refresh while sending.
  useEffect(() => {
    if (campaign.status !== 'sending') {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }
    intervalRef.current = setInterval(() => loadStats(failedPage), AUTO_REFRESH_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [campaign.status, failedPage, loadStats]);

  async function handleRetry() {
    setRetrying(true);
    try {
      const updated = await onRetryFailed(campaign.id);
      onUpdated(updated);
      success('Resending failed emails');
      setFailedPage(1);
      await loadStats(1);
    } catch (e) {
      toastError(getApiErrorMessage(e, 'Failed to resend failed emails'));
    } finally {
      setRetrying(false);
    }
  }

  async function handleCancel() {
    setCancelling(true);
    try {
      const updated = await onCancel(campaign.id);
      onUpdated(updated);
      success('Campaign cancelled');
      await loadStats(failedPage);
    } catch (e) {
      toastError(getApiErrorMessage(e, 'Failed to cancel campaign'));
    } finally {
      setCancelling(false);
    }
  }

  async function goPage(page: number) {
    setFailedPage(page);
    await loadStats(page);
  }

  const isSending = campaign.status === 'sending';
  const canCancel = campaign.status === 'scheduled' || campaign.status === 'sending';
  const totalFailedPages = stats ? Math.ceil(stats.failed_total / FAILED_PAGE_SIZE) : 0;
  const processed = stats ? stats.sent + stats.failed + stats.skipped : 0;
  const pct = stats && stats.total > 0 ? Math.min(100, Math.round((processed / stats.total) * 100)) : 0;

  return (
    <div className="flex flex-col gap-4">
      {/* Header: status + live indicator */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className={badgeClass(campaign.status)}>{campaign.status}</span>
          {campaign.scheduled_at && (
            <span className="text-xs text-[var(--coachio-admin-dashboard-text-soft)]">
              Scheduled {formatVnDateTime(campaign.scheduled_at)}
            </span>
          )}
        </div>
        {isSending && (
          <span className="inline-flex items-center gap-2 text-xs text-sky-600">
            <span className="relative inline-flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-sky-500" />
            </span>
            Sending — auto-refresh every 5s
          </span>
        )}
      </div>

      {/* System error banner */}
      {campaign.last_error && (
        <div className="flex items-start gap-2.5 rounded-[var(--coachio-admin-dashboard-radius-sm)] border border-red-200 bg-red-50 px-3 py-2.5">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
          <div>
            <p className="text-sm font-semibold text-red-800">Campaign system error</p>
            <p className="text-xs text-red-700">{campaign.last_error}</p>
          </div>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <StatCard label="Total" value={stats?.total} />
        <StatCard label="Sent" value={stats?.sent} tone="ok" />
        <StatCard label="Failed" value={stats?.failed} tone="danger" />
        <StatCard label="Skipped" value={stats?.skipped} />
        <StatCard label="Pending" value={stats?.pending} tone="amber" />
      </div>

      {/* Progress bar */}
      {stats && stats.total > 0 && (
        <div>
          <div className="mb-2 flex items-baseline justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--coachio-admin-dashboard-text-soft)]">
              Send progress
            </span>
            <span className="text-sm text-[var(--coachio-admin-dashboard-text-muted)]">
              <b className="text-[var(--coachio-admin-dashboard-text)]">{processed}</b> /{' '}
              <b className="text-[var(--coachio-admin-dashboard-text)]">{stats.total}</b> ({pct}%)
            </span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-[var(--coachio-admin-dashboard-surface-muted)]">
            <div
              className={`h-full rounded-full transition-[width] duration-500 ${
                campaign.status === 'completed' ? 'bg-emerald-500' : 'bg-[var(--coachio-admin-dashboard-accent)]'
              }`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      {/* Section header + actions */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-semibold text-[var(--coachio-admin-dashboard-text)]">Failed recipients</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className={BTN_SECONDARY}
            onClick={() => loadStats(failedPage)}
            disabled={loadingStats}
            title="Refresh"
          >
            {loadingStats ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh
          </button>
          {canCancel && (
            <button type="button" className={BTN_DANGER} onClick={handleCancel} disabled={cancelling}>
              {cancelling ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />}
              Cancel campaign
            </button>
          )}
          {stats && stats.failed > 0 && (
            <button type="button" className={BTN_SECONDARY} onClick={handleRetry} disabled={retrying}>
              {retrying ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
              Resend failed
            </button>
          )}
        </div>
      </div>

      {statsError && <p className="text-sm text-red-600">{statsError}</p>}

      {/* Failed jobs table or empty state */}
      {stats && stats.failed_jobs.length > 0 ? (
        <>
          <div className="overflow-x-auto rounded-[var(--coachio-admin-dashboard-radius-md,0.5rem)] border border-[var(--coachio-admin-dashboard-border)]">
            <table className={TABLE}>
              <thead>
                <tr>
                  <th className={TH}>Email</th>
                  <th className={TH}>Error</th>
                  <th className={`${TH} text-center`}>Attempts</th>
                </tr>
              </thead>
              <tbody>
                {stats.failed_jobs.map((job) => (
                  <tr key={job.id}>
                    <td className={`${TD} font-semibold`}>{job.email}</td>
                    <td className={`${TD} text-red-600`}>{job.error ?? '—'}</td>
                    <td className={`${TD} text-center`}>{job.attempts}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalFailedPages > 1 && (
            <div className="flex items-center justify-center gap-3 text-sm">
              <button
                type="button"
                className={BTN_SECONDARY}
                disabled={failedPage <= 1}
                onClick={() => goPage(failedPage - 1)}
              >
                ← Prev
              </button>
              <span className="text-[var(--coachio-admin-dashboard-text-muted)]">
                Page {failedPage} / {totalFailedPages}
              </span>
              <button
                type="button"
                className={BTN_SECONDARY}
                disabled={failedPage >= totalFailedPages}
                onClick={() => goPage(failedPage + 1)}
              >
                Next →
              </button>
            </div>
          )}
        </>
      ) : stats ? (
        <div className="flex items-center justify-center gap-2 rounded-[var(--coachio-admin-dashboard-radius-md,0.5rem)] border border-dashed border-[var(--coachio-admin-dashboard-border)] px-4 py-5 text-sm text-[var(--coachio-admin-dashboard-text-soft)]">
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          No failed emails.
        </div>
      ) : (
        <p className="text-sm text-[var(--coachio-admin-dashboard-text-soft)]">Loading stats…</p>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value?: number;
  tone?: 'ok' | 'danger' | 'amber';
}) {
  const toneClass =
    tone === 'ok'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : tone === 'danger'
        ? 'border-red-200 bg-red-50 text-red-600'
        : tone === 'amber'
          ? 'border-amber-200 bg-amber-50 text-amber-700'
          : 'border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface)] text-[var(--coachio-admin-dashboard-text)]';
  return (
    <div className={`rounded-[var(--coachio-admin-dashboard-radius-md,0.5rem)] border px-4 py-3 ${toneClass}`}>
      <div className="text-xs font-semibold uppercase tracking-wide opacity-70">{label}</div>
      <div className="mt-1 text-2xl font-extrabold tracking-tight">{value ?? '—'}</div>
    </div>
  );
}
