'use client';

import { Ban, Eye, Pencil, Trash2 } from 'lucide-react';
import type { BroadcastCampaign, BroadcastStatus } from '@coachio/api-client';
import styles from './BroadcastCampaignList.module.scss';

interface BroadcastCampaignListProps {
  campaigns: BroadcastCampaign[];
  /** Open the composer to edit (draft / scheduled only). */
  onEdit(campaign: BroadcastCampaign): void;
  /** Open the detail view to watch send progress / errors. */
  onView(campaign: BroadcastCampaign): void;
  onCancel(campaign: BroadcastCampaign): void;
  onDelete(campaign: BroadcastCampaign): void;
}

const EDITABLE: BroadcastStatus[] = ['draft', 'scheduled'];

const STATUS_LABEL: Record<BroadcastStatus, string> = {
  draft: 'Draft',
  scheduled: 'Scheduled',
  sending: 'Sending',
  completed: 'Completed',
  cancelled: 'Cancelled',
  failed: 'Failed',
};

const STATUS_CLASS: Record<BroadcastStatus, string> = {
  draft: styles.badgeDraft,
  scheduled: styles.badgeScheduled,
  sending: styles.badgeSending,
  completed: styles.badgeCompleted,
  cancelled: styles.badgeCancelled,
  failed: styles.badgeFailed,
};

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export function BroadcastCampaignList({ campaigns, onEdit, onView, onCancel, onDelete }: BroadcastCampaignListProps) {
  if (campaigns.length === 0) {
    return <p className={styles.empty}>No campaigns yet.</p>;
  }

  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Campaign name</th>
            <th>Status</th>
            <th>Recipients</th>
            <th>Sent / Failed</th>
            <th>Time</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {campaigns.map((c) => (
            <tr key={c.id} className={styles.row}>
              <td className={styles.title}>
                <button
                  type="button"
                  className={styles.titleBtn}
                  onClick={() => (EDITABLE.includes(c.status as BroadcastStatus) ? onEdit(c) : onView(c))}
                >
                  {c.title}
                </button>
                <span className={styles.subject}>{c.subject}</span>
              </td>
              <td>
                <span className={`${styles.badge} ${STATUS_CLASS[c.status as BroadcastStatus] ?? styles.badgeDraft}`}>
                  {STATUS_LABEL[c.status as BroadcastStatus] ?? c.status}
                </span>
              </td>
              <td className={styles.num}>{c.total_recipients.toLocaleString('en-US')}</td>
              <td className={styles.num}>
                <span className={styles.sent}>{c.sent_count.toLocaleString('en-US')}</span>
                {' / '}
                <span className={c.failed_count > 0 ? styles.failed : undefined}>
                  {c.failed_count.toLocaleString('en-US')}
                </span>
              </td>
              <td className={styles.date}>
                {c.scheduled_at ? `Scheduled: ${formatDate(c.scheduled_at)}` : formatDate(c.created_at)}
              </td>
              <td>
                <div className={styles.actions}>
                  {EDITABLE.includes(c.status as BroadcastStatus) && (
                    <button type="button" title="Edit" className={styles.actionBtn} onClick={() => onEdit(c)}>
                      <Pencil className={styles.icon} />
                    </button>
                  )}
                  <button type="button" title="View progress" className={styles.actionBtn} onClick={() => onView(c)}>
                    <Eye className={styles.icon} />
                  </button>
                  {(c.status === 'scheduled' || c.status === 'sending') && (
                    <button type="button" title="Cancel" className={styles.actionBtnDanger} onClick={() => onCancel(c)}>
                      <Ban className={styles.icon} />
                    </button>
                  )}
                  {(c.status === 'draft' || c.status === 'cancelled' || c.status === 'failed') && (
                    <button type="button" title="Delete" className={styles.actionBtnDanger} onClick={() => onDelete(c)}>
                      <Trash2 className={styles.icon} />
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
