'use client';

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import {
  adminGiftCampaignsApi,
  getApiErrorMessage,
  type Funnel,
  type Gift,
  type GiftAudiencePreview,
  type GiftCampaign,
  type GiftCampaignCreateInput,
  type GiftOrderBy,
} from '@coachio/api-client';
import { AdminModal } from '../shared/AdminModal';
import { useToast } from '../shared/toast';
import { BTN_PRIMARY, BTN_SECONDARY } from './gift-ui';
import { GiftWizardStepGifts } from './gift-wizard/GiftWizardStepGifts';
import { GiftWizardStepRecipients } from './gift-wizard/GiftWizardStepRecipients';
import { GiftWizardStepReview } from './gift-wizard/GiftWizardStepReview';
import { buildAudienceConfig, type WizardState } from './gift-wizard/wizard-config';

type Step = 1 | 2 | 3;

const STEPS: { n: Step; label: string }[] = [
  { n: 1, label: 'Gifts & Email' },
  { n: 2, label: 'Recipients' },
  { n: 3, label: 'Review & Send' },
];

function initialState(campaign: GiftCampaign | null): WizardState {
  const cfg = campaign?.audience_config ?? {};
  return {
    name: campaign?.name ?? '',
    giftIds: campaign?.gift_ids ?? [],
    emailSubject: campaign?.email_subject ?? 'Your gift from Coachio',
    emailHtml:
      campaign?.email_html ?? '<p>Hi {{recipient_name}},</p>\n<p>Thank you! Here is your gift.</p>',
    funnelIds: cfg.funnel_ids ?? [],
    audience: cfg.status ?? '',
    limitMode: cfg.limit ? 'n' : 'all',
    limitN: cfg.limit ? String(cfg.limit) : '10',
    orderBy: (cfg.order_by ?? 'earliest_reg') as GiftOrderBy,
    dateField: cfg.date_field ?? 'registration',
    dateFrom: cfg.date_from ?? '',
    dateTo: cfg.date_to ?? '',
    amountMin: cfg.amount_min != null ? String(cfg.amount_min) : '',
    amountMax: cfg.amount_max != null ? String(cfg.amount_max) : '',
    utmSource: cfg.utm_source ?? '',
    utmCampaign: cfg.utm_campaign ?? '',
    hasAccount: cfg.has_account == null ? '' : String(cfg.has_account),
    includeEmails: cfg.include_emails ?? [],
    excludeEmails: cfg.exclude_emails ?? [],
    excludeGranted: cfg.exclude_already_granted ?? true,
  };
}

/**
 * 3-step gift-campaign wizard. The parent holds ALL form state; APIs are only
 * called for the live audience preview (debounced) and on Save / Send.
 */
export function GiftCampaignFormModal({
  campaign,
  gifts,
  funnels,
  onClose,
  onSaved,
}: {
  campaign: GiftCampaign | null;
  gifts: Gift[];
  funnels: Funnel[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { success, error: toastError } = useToast();
  const [step, setStep] = useState<Step>(1);
  const [state, setState] = useState<WizardState>(() => initialState(campaign));
  const [delivery, setDelivery] = useState<'now' | 'later'>('now');
  const [scheduledAt, setScheduledAt] = useState('');
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<GiftAudiencePreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const update = useCallback((patch: Partial<WizardState>) => setState((s) => ({ ...s, ...patch })), []);

  // Live audience preview — debounced; needs at least 1 gift.
  const previewKey = useMemo(
    () => JSON.stringify({ g: state.giftIds, c: buildAudienceConfig(state) }),
    [state],
  );
  useEffect(() => {
    if (state.giftIds.length === 0) {
      setPreview(null);
      setPreviewLoading(false);
      return;
    }
    let cancelled = false;
    setPreviewLoading(true);
    const timer = setTimeout(async () => {
      try {
        const p = await adminGiftCampaignsApi.audiencePreview(state.giftIds, buildAudienceConfig(state));
        if (!cancelled) setPreview(p);
      } catch {
        if (!cancelled) setPreview(null);
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [previewKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const buildPayload = (): GiftCampaignCreateInput => ({
    name: state.name.trim(),
    gift_ids: state.giftIds,
    email_subject: state.emailSubject,
    email_html: state.emailHtml,
    audience_config: buildAudienceConfig(state),
  });

  const validate = (): boolean => {
    if (!state.name.trim() || state.giftIds.length === 0) {
      toastError('Enter a campaign name and select at least 1 gift');
      return false;
    }
    return true;
  };

  // Persist current state, returning the campaign id (create or update).
  const persist = async (): Promise<string> => {
    if (campaign) {
      await adminGiftCampaignsApi.update(campaign.id, buildPayload());
      return campaign.id;
    }
    const created = await adminGiftCampaignsApi.create(buildPayload());
    return created.id;
  };

  const handleSaveDraft = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      await persist();
      success(campaign ? 'Draft saved' : 'Campaign created');
      onSaved();
    } catch (e) {
      toastError(getApiErrorMessage(e, 'Failed to save campaign'));
    } finally {
      setSaving(false);
    }
  };

  const handleSend = async () => {
    if (!validate()) return;
    if (delivery === 'later' && !scheduledAt) {
      toastError('Pick a date & time to schedule the send');
      return;
    }
    setSaving(true);
    try {
      const id = await persist();
      await adminGiftCampaignsApi.confirm(id);
      await adminGiftCampaignsApi.send(id, delivery === 'later' ? scheduledAt : null);
      success(delivery === 'later' ? 'Scheduled' : 'Sending gifts');
      onSaved();
    } catch (e) {
      toastError(getApiErrorMessage(e, 'Failed to send campaign'));
    } finally {
      setSaving(false);
    }
  };

  const footer =
    step === 1 ? (
      <>
        <button type="button" className={BTN_SECONDARY} onClick={onClose}>
          Cancel
        </button>
        <button type="button" className={BTN_PRIMARY} onClick={() => setStep(2)}>
          Next: Recipients →
        </button>
      </>
    ) : step === 2 ? (
      <>
        <button type="button" className={`${BTN_SECONDARY} mr-auto`} onClick={() => setStep(1)}>
          ← Back
        </button>
        <button type="button" className={BTN_SECONDARY} onClick={onClose}>
          Cancel
        </button>
        <button type="button" className={BTN_PRIMARY} onClick={() => setStep(3)}>
          Next: Review →
        </button>
      </>
    ) : (
      <>
        <button type="button" className={`${BTN_SECONDARY} mr-auto`} onClick={() => setStep(2)}>
          ← Back
        </button>
        <button type="button" className={BTN_SECONDARY} onClick={handleSaveDraft} disabled={saving}>
          Save draft
        </button>
        <button type="button" className={BTN_PRIMARY} onClick={handleSend} disabled={saving}>
          {saving ? 'Working…' : delivery === 'later' ? 'Schedule send' : 'Send now'}
        </button>
      </>
    );

  return (
    <AdminModal
      title={campaign ? 'Edit gift campaign' : 'Create gift campaign'}
      subtitle="Pick gifts, write the email, then choose recipients."
      onClose={onClose}
      maxWidthClassName="max-w-[80rem]"
      footer={footer}
    >
      {/* Step header */}
      <div className="mb-5 flex items-center gap-1.5">
        {STEPS.map((s, idx) => (
          <Fragment key={s.n}>
            <button type="button" onClick={() => setStep(s.n)} className={stepPillClass(s.n, step)}>
              <span className={stepNumClass(s.n, step)}>{s.n}</span>
              {s.label}
            </button>
            {idx < STEPS.length - 1 && (
              <span className="h-px flex-1 bg-[var(--coachio-admin-dashboard-border)]" />
            )}
          </Fragment>
        ))}
      </div>

      {step === 1 && <GiftWizardStepGifts state={state} update={update} gifts={gifts} />}
      {step === 2 && (
        <GiftWizardStepRecipients
          state={state}
          update={update}
          funnels={funnels}
          preview={preview}
          previewLoading={previewLoading}
        />
      )}
      {step === 3 && (
        <GiftWizardStepReview
          state={state}
          gifts={gifts}
          preview={preview}
          delivery={delivery}
          scheduledAt={scheduledAt}
          onDeliveryChange={setDelivery}
          onScheduledAtChange={setScheduledAt}
        />
      )}
    </AdminModal>
  );
}

function stepPillClass(n: Step, current: Step): string {
  const base =
    'inline-flex items-center gap-2 whitespace-nowrap rounded-full border px-3.5 py-2 text-sm transition';
  if (n === current)
    return `${base} border-[var(--coachio-admin-dashboard-accent)] bg-[var(--coachio-admin-dashboard-accent-soft,#fff7ed)] font-semibold text-[var(--coachio-admin-dashboard-accent)]`;
  if (n < current)
    return `${base} border-[var(--coachio-admin-dashboard-border)] text-[var(--coachio-admin-dashboard-text)]`;
  return `${base} border-[var(--coachio-admin-dashboard-border)] text-[var(--coachio-admin-dashboard-text-muted)]`;
}

function stepNumClass(n: Step, current: Step): string {
  const base = 'grid h-5 w-5 place-items-center rounded-full text-xs font-bold';
  if (n === current) return `${base} bg-[var(--coachio-admin-dashboard-accent)] text-white`;
  if (n < current) return `${base} bg-emerald-100 text-emerald-600`;
  return `${base} bg-[var(--coachio-admin-dashboard-surface-muted)] text-[var(--coachio-admin-dashboard-text-soft)]`;
}
