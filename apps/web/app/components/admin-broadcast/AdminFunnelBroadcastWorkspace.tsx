'use client';

import { useCallback, useMemo, useState } from 'react';
import { Plus, ArrowLeft } from 'lucide-react';
import { adminFunnelBroadcastsApi } from '@coachio/api-client';
import type { AudienceConfig, BroadcastCampaign } from '@coachio/api-client';
import {
  useBroadcastCampaigns,
  BroadcastCampaignList,
  BroadcastComposer,
  BroadcastAudiencePicker,
  BroadcastScheduleField,
  BroadcastCampaignDetail,
  EMPTY_FILTERS,
  type BroadcastApiAdapter,
  type BroadcastComposerValue,
} from './index';
import styles from './AdminBroadcastManagement.module.scss';

// Universal lead tokens always included
const UNIVERSAL_VARS = [
  { key: 'name', label: 'Recipient name' },
  { key: 'email', label: 'Recipient email' },
];

interface AdminFunnelBroadcastWorkspaceProps {
  funnelId: string;
  funnelTitle: string;
  variables?: Record<string, string>;
  variablesMeta?: Record<string, unknown>;
}

const EMPTY_COMPOSER: BroadcastComposerValue = {
  title: '',
  subject: '',
  html_body: '',
};

type View = 'list' | 'compose' | 'detail';

/**
 * Funnel-scoped broadcast email campaigns workspace.
 * Rendered in the funnel editor when the "broadcasts" sidebar tab is active.
 * - origin=funnel: uses adminFunnelBroadcastsApi (funnelId baked in).
 * - Custom variables: funnel.variables + universal name/email tokens.
 * - Audience picker in funnel mode seeded to [funnelId]; filters adjustable.
 */
export function AdminFunnelBroadcastWorkspace({
  funnelId,
  funnelTitle,
  variables,
  variablesMeta,
}: AdminFunnelBroadcastWorkspaceProps) {
  // Build variable palette: universal tokens + this funnel's custom vars
  const customVars = useMemo(
    () =>
      Object.keys(variables ?? {}).map((key) => ({
        key,
        label: (variablesMeta?.[key] as { label?: string } | undefined)?.label ?? key,
      })),
    [variables, variablesMeta],
  );
  const composerVars = useMemo(() => [...UNIVERSAL_VARS, ...customVars], [customVars]);

  // Funnel-scoped adapter: all calls include funnelId
  const adapter: BroadcastApiAdapter = useMemo(
    () => ({
      list: () => adminFunnelBroadcastsApi.list(funnelId),
      create: (input) => adminFunnelBroadcastsApi.create(funnelId, input),
      update: (id, input) => adminFunnelBroadcastsApi.update(funnelId, id, input),
      remove: (id) => adminFunnelBroadcastsApi.remove(funnelId, id),
      send: (id, at) => adminFunnelBroadcastsApi.send(funnelId, id, at ?? null),
      cancel: (id) => adminFunnelBroadcastsApi.cancel(funnelId, id),
      test: (id, email) => adminFunnelBroadcastsApi.test(funnelId, id, email),
      retryFailed: (id) => adminFunnelBroadcastsApi.retryFailed(funnelId, id),
      stats: (id) => adminFunnelBroadcastsApi.stats(funnelId, id),
      // For funnel origin, audiencePreview requires a saved campaign id (server enforces funnel_ids=[funnelId])
      audiencePreview: (idOrConfig) => {
        if (typeof idOrConfig !== 'string') {
          throw new Error('funnel audiencePreview requires a saved campaign id');
        }
        return adminFunnelBroadcastsApi.audiencePreview(funnelId, idOrConfig);
      },
    }),
    [funnelId],
  );

  const {
    campaigns,
    loading,
    error,
    createCampaign,
    updateCampaign,
    removeCampaign,
    sendCampaign,
    cancelCampaign,
    testCampaign,
    retryFailed,
  } = useBroadcastCampaigns(adapter);

  // Audience config: seed funnel_ids to [funnelId] so count is non-zero immediately
  const FUNNEL_AUDIENCE: AudienceConfig = useMemo(
    () => ({ funnel_ids: [funnelId], filters: EMPTY_FILTERS }),
    [funnelId],
  );

  const [view, setView] = useState<View>('list');
  const [editingCampaign, setEditingCampaign] = useState<BroadcastCampaign | null>(null);
  const [detailCampaign, setDetailCampaign] = useState<BroadcastCampaign | null>(null);

  const [composerValue, setComposerValue] = useState<BroadcastComposerValue>(EMPTY_COMPOSER);
  const [audience, setAudience] = useState<AudienceConfig>(FUNNEL_AUDIENCE);
  const [scheduledAt, setScheduledAt] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [confirmSend, setConfirmSend] = useState(false);
  const [recipientCount, setRecipientCount] = useState<number | null>(null);
  const [formError, setFormError] = useState('');

  function openNew() {
    setEditingCampaign(null);
    setComposerValue(EMPTY_COMPOSER);
    setAudience(FUNNEL_AUDIENCE);
    setScheduledAt(null);
    setFormError('');
    setView('compose');
  }

  function openEdit(campaign: BroadcastCampaign) {
    setEditingCampaign(campaign);
    setComposerValue({
      title: campaign.title,
      subject: campaign.subject,
      html_body: campaign.html_body,
    });
    // Preserve stored audience_config but ensure funnelId is always present
    const stored = campaign.audience_config ?? FUNNEL_AUDIENCE;
    setAudience({
      ...stored,
      funnel_ids: stored.funnel_ids.includes(funnelId)
        ? stored.funnel_ids
        : [funnelId, ...stored.funnel_ids],
    });
    setScheduledAt(campaign.scheduled_at ?? null);
    setFormError('');
    setView('compose');
  }

  function openDetail(campaign: BroadcastCampaign) {
    setDetailCampaign(campaign);
    setView('detail');
  }

  function backToList() {
    setView('list');
    setEditingCampaign(null);
    setDetailCampaign(null);
    setConfirmSend(false);
    setFormError('');
  }

  async function handleSaveDraft() {
    if (!composerValue.title.trim()) {
      setFormError('Please enter an internal title for the campaign');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      if (editingCampaign) {
        await updateCampaign(editingCampaign.id, {
          title: composerValue.title,
          subject: composerValue.subject,
          html_body: composerValue.html_body,
          audience_config: audience,
          scheduled_at: scheduledAt,
        });
      } else {
        const created = await createCampaign({
          title: composerValue.title,
          subject: composerValue.subject,
          html_body: composerValue.html_body,
          audience_config: audience,
          scheduled_at: scheduledAt,
        });
        setEditingCampaign(created);
      }
    } catch {
      // toast handled by hook
    } finally {
      setSaving(false);
    }
  }

  async function handleSend() {
    if (!editingCampaign) return;
    setSending(true);
    setConfirmSend(false);
    try {
      await sendCampaign(editingCampaign.id, scheduledAt);
      backToList();
    } catch {
      // toast handled by hook
    } finally {
      setSending(false);
    }
  }

  function handleRequestSend(count: number | null) {
    setRecipientCount(count);
    setConfirmSend(true);
  }

  const handleCampaignUpdated = useCallback(
    (updated: BroadcastCampaign) => {
      if (detailCampaign?.id === updated.id) {
        setDetailCampaign(updated);
      }
    },
    [detailCampaign],
  );

  const fetchStats = useCallback(
    (id: string, failedPage?: number, failedSize?: number) =>
      adminFunnelBroadcastsApi.stats(funnelId, id, failedPage, failedSize),
    [funnelId],
  );

  // --- Render: List ---
  if (view === 'list') {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <h2 className={styles.title}>Email Campaigns — {funnelTitle}</h2>
          <button type="button" className={styles.btnPrimary} onClick={openNew}>
            <Plus className={styles.icon} />
            New campaign
          </button>
        </div>

        {error && <p className={styles.errorMsg}>{error}</p>}

        {loading ? (
          <p className={styles.loading}>Loading...</p>
        ) : (
          <BroadcastCampaignList
            campaigns={campaigns}
            onEdit={openEdit}
            onView={openDetail}
            onCancel={(c) => cancelCampaign(c.id)}
            onDelete={(c) => removeCampaign(c.id)}
          />
        )}
      </div>
    );
  }

  // --- Render: Detail ---
  if (view === 'detail' && detailCampaign) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <button type="button" className={styles.backBtn} onClick={backToList}>
            <ArrowLeft className={styles.icon} />
            Back
          </button>
          <h2 className={styles.title}>{detailCampaign.title}</h2>
        </div>
        <BroadcastCampaignDetail
          campaign={detailCampaign}
          onRetryFailed={retryFailed}
          fetchStats={fetchStats}
          onCampaignUpdated={handleCampaignUpdated}
        />
      </div>
    );
  }

  // --- Render: Compose/Edit ---
  // Draft and scheduled campaigns are still editable (no send jobs materialized yet).
  const isScheduled = editingCampaign?.status === 'scheduled';
  const canSend = !!editingCampaign && (editingCampaign.status === 'draft' || isScheduled);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <button type="button" className={styles.backBtn} onClick={backToList}>
          <ArrowLeft className={styles.icon} />
          Back
        </button>
        <h2 className={styles.title}>
          {editingCampaign ? `Edit: ${editingCampaign.title}` : 'New campaign'}
        </h2>
      </div>

      {formError && <p className={styles.errorMsg}>{formError}</p>}

      <div className={styles.composeLayout}>
        {/* Left: composer with funnel custom variables */}
        <div className={styles.composeLeft}>
          <BroadcastComposer
            value={composerValue}
            onChange={setComposerValue}
            variables={composerVars}
            onTestSend={(email) => {
              if (!editingCampaign) return Promise.resolve();
              return testCampaign(editingCampaign.id, email);
            }}
          />
        </div>

        {/* Right: audience (funnel-fixed) + schedule + CTA */}
        <div className={styles.composeRight}>
          <div className={styles.panel}>
            <p className={styles.panelTitle}>Audience</p>
            <BroadcastAudiencePicker
              mode="funnel"
              funnelId={funnelId}
              funnelTitle={funnelTitle}
              value={audience}
              onChange={setAudience}
              onCountChange={setRecipientCount}
            />
          </div>

          <div className={styles.panel}>
            <p className={styles.panelTitle}>Schedule</p>
            <BroadcastScheduleField value={scheduledAt} onChange={setScheduledAt} />
          </div>

          <div className={styles.ctaRow}>
            <button
              type="button"
              className={styles.btnSecondary}
              onClick={handleSaveDraft}
              disabled={saving}
            >
              {saving ? 'Saving...' : isScheduled ? 'Save changes' : 'Save draft'}
            </button>

            {canSend && (
              <button
                type="button"
                className={styles.btnSend}
                onClick={() => handleRequestSend(recipientCount)}
                disabled={sending}
              >
                {scheduledAt ? (isScheduled ? 'Update schedule' : 'Schedule send') : 'Send now'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation dialog */}
      {confirmSend && (
        <div className={styles.overlay}>
          <div className={styles.dialog}>
            <h3 className={styles.dialogTitle}>Confirm send</h3>
            <p className={styles.dialogBody}>
              {recipientCount !== null
                ? `You are about to send this campaign to ${recipientCount.toLocaleString()} recipients.`
                : 'You are about to send this campaign to the selected recipients.'}
              {scheduledAt
                ? ` Scheduled for ${new Date(scheduledAt).toLocaleString()}.`
                : ' This action cannot be undone.'}
            </p>
            <div className={styles.dialogActions}>
              <button
                type="button"
                className={styles.btnSecondary}
                onClick={() => setConfirmSend(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.btnSend}
                onClick={handleSend}
                disabled={sending}
              >
                {sending ? 'Sending...' : scheduledAt ? 'Confirm schedule' : 'Confirm send'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
