'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Loader2, RefreshCw, RotateCcw } from 'lucide-react';
import { getApiErrorMessage } from '@coachio/api-client';
import type { BroadcastCampaign, CampaignStats } from '@coachio/api-client';
import { useToast } from '../shared/toast';
import styles from './BroadcastCampaignDetail.module.scss';

interface BroadcastCampaignDetailProps {
  campaign: BroadcastCampaign;
  onRetryFailed(id: string): Promise<BroadcastCampaign>;
  fetchStats(id: string, failedPage?: number, failedSize?: number): Promise<CampaignStats>;
  onCampaignUpdated(updated: BroadcastCampaign): void;
}

const FAILED_PAGE_SIZE = 50;
const AUTO_REFRESH_MS = 5_000;

export function BroadcastCampaignDetail({
  campaign,
  onRetryFailed,
  fetchStats,
  onCampaignUpdated,
}: BroadcastCampaignDetailProps) {
  const { success, error: toastError } = useToast();
  const [stats, setStats] = useState<CampaignStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [statsError, setStatsError] = useState('');
  const [failedPage, setFailedPage] = useState(1);
  const [retrying, setRetrying] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadStats = useCallback(async (page = failedPage) => {
    setLoadingStats(true);
    setStatsError('');
    try {
      const s = await fetchStats(campaign.id, page, FAILED_PAGE_SIZE);
      setStats(s);
    } catch (e) {
      setStatsError(getApiErrorMessage(e, 'Failed to load stats'));
    } finally {
      setLoadingStats(false);
    }
  }, [campaign.id, failedPage, fetchStats]);

  // Initial load
  useEffect(() => {
    loadStats(1);
    setFailedPage(1);
  }, [campaign.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-refresh while sending
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
      onCampaignUpdated(updated);
      success('Retrying failed emails');
      await loadStats(1);
      setFailedPage(1);
    } catch (e) {
      toastError(getApiErrorMessage(e, 'Failed to resend failed emails'));
    } finally {
      setRetrying(false);
    }
  }

  async function goPage(page: number) {
    setFailedPage(page);
    await loadStats(page);
  }

  const totalFailedPages = stats ? Math.ceil(stats.failed_total / FAILED_PAGE_SIZE) : 0;
  const processed = stats ? stats.sent + stats.failed : 0;
  const progressPct =
    stats && stats.total > 0 ? Math.min(100, Math.round((processed / stats.total) * 100)) : 0;

  return (
    <div className={styles.detail}>
      {/* last_error banner */}
      {campaign.last_error && (
        <div className={styles.errorBanner}>
          <AlertTriangle className={styles.bannerIcon} />
          <div>
            <p className={styles.bannerTitle}>Campaign system error</p>
            <p className={styles.bannerMsg}>{campaign.last_error}</p>
          </div>
        </div>
      )}

      {/* Stat cards */}
      {stats && (
        <div className={styles.cards}>
          <div className={styles.card}>
            <span className={styles.cardLabel}>Total recipients</span>
            <span className={styles.cardValue}>{stats.total.toLocaleString()}</span>
          </div>
          <div className={`${styles.card} ${styles.cardSuccess}`}>
            <span className={styles.cardLabel}>Sent</span>
            <span className={styles.cardValue}>{stats.sent.toLocaleString()}</span>
          </div>
          <div className={`${styles.card} ${styles.cardDanger}`}>
            <span className={styles.cardLabel}>Failed</span>
            <span className={styles.cardValue}>{stats.failed.toLocaleString()}</span>
          </div>
          <div className={styles.card}>
            <span className={styles.cardLabel}>Pending</span>
            <span className={styles.cardValue}>{stats.pending.toLocaleString()}</span>
          </div>
        </div>
      )}

      {/* Send progress bar */}
      {stats && stats.total > 0 && (
        <div className={styles.progressWrap}>
          <div className={styles.progressHead}>
            <span className={styles.progressLabel}>Send progress</span>
            <span className={styles.progressValue}>
              {processed.toLocaleString()} / {stats.total.toLocaleString()} ({progressPct}%)
            </span>
          </div>
          <div className={styles.progressTrack}>
            <div className={styles.progressBar} style={{ width: `${progressPct}%` }} />
          </div>
        </div>
      )}

      {/* Stats header row */}
      <div className={styles.statsHeader}>
        <p className={styles.sectionTitle}>Failed emails</p>
        <div className={styles.headerActions}>
          {campaign.status === 'sending' && (
            <span className={styles.liveIndicator}>
              <span className={styles.liveDot} />
              Sending — auto-refresh every 5s
            </span>
          )}
          <button
            type="button"
            className={styles.refreshBtn}
            onClick={() => loadStats(failedPage)}
            disabled={loadingStats}
            title="Refresh stats"
          >
            {loadingStats ? <Loader2 className={styles.spin} /> : <RefreshCw className={styles.icon} />}
          </button>
          {stats && stats.failed > 0 && (
            <button
              type="button"
              className={styles.retryBtn}
              onClick={handleRetry}
              disabled={retrying}
            >
              {retrying ? <Loader2 className={styles.spin} /> : <RotateCcw className={styles.icon} />}
              Resend failed
            </button>
          )}
        </div>
      </div>

      {statsError && <p className={styles.statsError}>{statsError}</p>}

      {/* Failed jobs table */}
      {stats && stats.failed_jobs.length > 0 ? (
        <>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Error</th>
                  <th>Attempts</th>
                </tr>
              </thead>
              <tbody>
                {stats.failed_jobs.map((job) => (
                  <tr key={job.id}>
                    <td className={styles.email}>{job.email}</td>
                    <td className={styles.jobError}>{job.error ?? '—'}</td>
                    <td className={styles.attempts}>{job.attempts}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalFailedPages > 1 && (
            <div className={styles.pagination}>
              <button
                type="button"
                className={styles.pageBtn}
                disabled={failedPage <= 1}
                onClick={() => goPage(failedPage - 1)}
              >
                ← Prev
              </button>
              <span className={styles.pageInfo}>
                Page {failedPage} / {totalFailedPages}
              </span>
              <button
                type="button"
                className={styles.pageBtn}
                disabled={failedPage >= totalFailedPages}
                onClick={() => goPage(failedPage + 1)}
              >
                Next →
              </button>
            </div>
          )}
        </>
      ) : stats ? (
        <p className={styles.noFailed}>No failed emails.</p>
      ) : null}
    </div>
  );
}
