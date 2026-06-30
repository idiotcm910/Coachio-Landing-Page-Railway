'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, ArrowLeft } from 'lucide-react';
import { adminBroadcastsApi, adminFunnelsApi, getApiErrorMessage } from '@coachio/api-client';
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
  type FunnelOption,
} from './index';
import styles from './AdminBroadcastManagement.module.scss';

// origin=admin: ONLY universal lead tokens; no custom funnel variables (spec §1)
const ADMIN_VARIABLES = [
  { key: 'name', label: 'Recipient name' },
  { key: 'email', label: 'Recipient email' },
];

const EMPTY_AUDIENCE: AudienceConfig = {
  funnel_ids: [],
  filters: EMPTY_FILTERS,
};

const EMPTY_COMPOSER: BroadcastComposerValue = {
  title: '',
  subject: '',
  html_body: '',
};

type View = 'list' | 'compose' | 'detail';

export function AdminBroadcastManagement() {
  const adapter: BroadcastApiAdapter = useMemo(
    () => ({
      list: () => adminBroadcastsApi.list(),
      create: (input) => adminBroadcastsApi.create(input),
      update: (id, input) => adminBroadcastsApi.update(id, input),
      remove: (id) => adminBroadcastsApi.remove(id),
      send: (id, at) => adminBroadcastsApi.send(id, at),
      cancel: (id) => adminBroadcastsApi.cancel(id),
      test: (id, email) => adminBroadcastsApi.test(id, email),
      retryFailed: (id) => adminBroadcastsApi.retryFailed(id),
      stats: (id) => adminBroadcastsApi.stats(id),
      audiencePreview: (idOrConfig) =>
        typeof idOrConfig === 'string'
          ? adminBroadcastsApi.audiencePreview(idOrConfig)
          : adminBroadcastsApi.audiencePreviewUnbound(
              (idOrConfig as AudienceConfig).funnel_ids,
              (idOrConfig as AudienceConfig).filters,
            ),
    }),
    [],
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

  // Funnel options for audience picker (admin: multi-funnel mode)
  const [funnelOptions, setFunnelOptions] = useState<FunnelOption[]>([]);
  const [funnelsLoading, setFunnelsLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    setFunnelsLoading(true);
    adminFunnelsApi
      .list()
      .then((items) => {
        if (!mounted) return;
        setFunnelOptions(items.map((f) => ({ id: f.id, title: f.title })));
      })
      .catch(() => {
        // Non-critical: audience picker will show empty list
      })
      .finally(() => {
        if (mounted) setFunnelsLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  // View state
  const [view, setView] = useState<View>('list');
  const [editingCampaign, setEditingCampaign] = useState<BroadcastCampaign | null>(null);
  const [detailCampaign, setDetailCampaign] = useState<BroadcastCampaign | null>(null);

  // Compose form state
  const [composerValue, setComposerValue] = useState<BroadcastComposerValue>(EMPTY_COMPOSER);
  const [audience, setAudience] = useState<AudienceConfig>(EMPTY_AUDIENCE);
  const [scheduledAt, setScheduledAt] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [confirmSend, setConfirmSend] = useState(false);
  const [recipientCount, setRecipientCount] = useState<number | null>(null);
  const [formError, setFormError] = useState('');

  function openNew() {
    setEditingCampaign(null);
    setComposerValue(EMPTY_COMPOSER);
    setAudience(EMPTY_AUDIENCE);
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
    setAudience(campaign.audience_config ?? EMPTY_AUDIENCE);
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
      adminBroadcastsApi.stats(id, failedPage, failedSize),
    [],
  );

  // --- Render: List ---
  if (view === 'list') {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <h2 className={styles.title}>Email Campaigns</h2>
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
        {/* Left: compose */}
        <div className={styles.composeLeft}>
          <BroadcastComposer
            value={composerValue}
            onChange={setComposerValue}
            variables={ADMIN_VARIABLES}
            onTestSend={(email) => {
              if (!editingCampaign) return Promise.resolve();
              return testCampaign(editingCampaign.id, email);
            }}
          />
        </div>

        {/* Right: audience + schedule + CTA */}
        <div className={styles.composeRight}>
          <div className={styles.panel}>
            <p className={styles.panelTitle}>Audience</p>
            <BroadcastAudiencePicker
              mode="admin"
              funnelOptions={funnelsLoading ? [] : funnelOptions}
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
