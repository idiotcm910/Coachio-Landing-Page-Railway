'use client';

import type { Funnel, GiftAudiencePreview, GiftOrderBy } from '@coachio/api-client';
import {
  CHIP,
  CHIP_ON,
  COUNT_PILL,
  FIELD,
  INPUT,
  LABEL,
  SELECT,
  SEG_BTN,
  SEG_BTN_ON,
  SEG_WRAP,
} from '../gift-ui';
import { EmailListInput } from './EmailListInput';
import { HelpTooltip } from './HelpTooltip';
import {
  AUDIENCE_OPTIONS,
  SORT_OPTIONS,
  TIPS,
  type WizardState,
  summarySentence,
} from './wizard-config';

export function GiftWizardStepRecipients({
  state,
  update,
  funnels,
  preview,
  previewLoading,
}: {
  state: WizardState;
  update: (patch: Partial<WizardState>) => void;
  funnels: Funnel[];
  preview: GiftAudiencePreview | null;
  previewLoading: boolean;
}) {
  const toggleFunnel = (id: string) =>
    update({
      funnelIds: state.funnelIds.includes(id)
        ? state.funnelIds.filter((x) => x !== id)
        : [...state.funnelIds, id],
    });

  const willCount = previewLoading ? '…' : preview ? preview.will_receive : '—';

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[15px] font-bold text-[var(--coachio-admin-dashboard-text)]">
          Choose recipients
        </span>
        <span className={COUNT_PILL}>
          ≈ <b>{willCount}</b>&nbsp;will receive
        </span>
      </div>

      {/* Funnels */}
      <div className={FIELD}>
        <span className={LABEL}>Funnels</span>
        <div className="flex flex-wrap gap-2">
          {funnels.map((f) => {
            const on = state.funnelIds.includes(f.id);
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => toggleFunnel(f.id)}
                className={`${CHIP} ${on ? CHIP_ON : ''}`}
              >
                {f.title}
                {on && <span aria-hidden>×</span>}
              </button>
            );
          })}
          {funnels.length === 0 && (
            <span className="text-xs text-[var(--coachio-admin-dashboard-text-soft)]">
              No funnels available.
            </span>
          )}
        </div>
      </div>

      {/* Audience segmented control */}
      <div className={FIELD}>
        <span className={LABEL}>Audience</span>
        <div className={SEG_WRAP}>
          {AUDIENCE_OPTIONS.map((a) => (
            <button
              key={a.value || 'all'}
              type="button"
              onClick={() => update({ audience: a.value })}
              className={`${SEG_BTN} ${state.audience === a.value ? SEG_BTN_ON : ''}`}
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>

      {/* How many & order */}
      <div className={FIELD}>
        <span className={LABEL}>
          How many &amp; order <HelpTooltip text={TIPS.orderby} />
        </span>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          Send to
          <select
            className={`${SELECT} w-auto`}
            value={state.limitMode}
            onChange={(e) => update({ limitMode: e.target.value as 'all' | 'n' })}
          >
            <option value="all">all recipients</option>
            <option value="n">the first</option>
          </select>
          {state.limitMode === 'n' && (
            <>
              <input
                type="number"
                min={1}
                className={`${INPUT} w-24`}
                value={state.limitN}
                onChange={(e) => update({ limitN: e.target.value })}
              />
              recipients
            </>
          )}
          ordered by
          <select
            className={`${SELECT} w-auto`}
            value={state.orderBy}
            onChange={(e) => update({ orderBy: e.target.value as GiftOrderBy })}
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Advanced filters */}
      <details className="rounded-[var(--coachio-admin-dashboard-radius-sm)] border border-dashed border-[var(--coachio-admin-dashboard-border)]">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-3 text-sm font-semibold text-[var(--coachio-admin-dashboard-text-muted)]">
          Advanced filters
          <span className="font-normal text-[var(--coachio-admin-dashboard-text-soft)]">
            — date · spend · UTM · account · add/exclude emails
          </span>
        </summary>
        <div className="grid grid-cols-1 gap-4 px-3 pb-4 pt-1 sm:grid-cols-2">
          <label className={FIELD}>
            <span className={LABEL}>
              Date field <HelpTooltip text={TIPS.datefield} />
            </span>
            <select
              className={SELECT}
              value={state.dateField}
              onChange={(e) => update({ dateField: e.target.value })}
            >
              <option value="registration">Registration date</option>
              <option value="purchase">Purchase date</option>
            </select>
          </label>
          <label className={FIELD}>
            <span className={LABEL}>
              Has account? <HelpTooltip text={TIPS.hasaccount} />
            </span>
            <select
              className={SELECT}
              value={state.hasAccount}
              onChange={(e) => update({ hasAccount: e.target.value })}
            >
              <option value="">No filter</option>
              <option value="true">Has account</option>
              <option value="false">No account</option>
            </select>
          </label>
          <label className={FIELD}>
            <span className={LABEL}>
              From date <HelpTooltip text={TIPS.fromdate} />
            </span>
            <input
              type="datetime-local"
              className={INPUT}
              value={state.dateFrom}
              onChange={(e) => update({ dateFrom: e.target.value })}
            />
          </label>
          <label className={FIELD}>
            <span className={LABEL}>
              To date <HelpTooltip text={TIPS.todate} />
            </span>
            <input
              type="datetime-local"
              className={INPUT}
              value={state.dateTo}
              onChange={(e) => update({ dateTo: e.target.value })}
            />
          </label>
          <label className={FIELD}>
            <span className={LABEL}>
              Minimum spend <HelpTooltip text={TIPS.minspend} />
            </span>
            <input
              type="number"
              className={INPUT}
              placeholder="0"
              value={state.amountMin}
              onChange={(e) => update({ amountMin: e.target.value })}
            />
          </label>
          <label className={FIELD}>
            <span className={LABEL}>
              Maximum spend <HelpTooltip text={TIPS.maxspend} />
            </span>
            <input
              type="number"
              className={INPUT}
              placeholder="—"
              value={state.amountMax}
              onChange={(e) => update({ amountMax: e.target.value })}
            />
          </label>
          <label className={FIELD}>
            <span className={LABEL}>
              UTM source <HelpTooltip text={TIPS.utmsource} />
            </span>
            <input
              className={INPUT}
              value={state.utmSource}
              onChange={(e) => update({ utmSource: e.target.value })}
            />
          </label>
          <label className={FIELD}>
            <span className={LABEL}>
              UTM campaign <HelpTooltip text={TIPS.utmcampaign} />
            </span>
            <input
              className={INPUT}
              value={state.utmCampaign}
              onChange={(e) => update({ utmCampaign: e.target.value })}
            />
          </label>
          <div className={`${FIELD} sm:col-span-2`}>
            <span className={LABEL}>
              Manually added emails <HelpTooltip text={TIPS.manual} />
            </span>
            <EmailListInput
              emails={state.includeEmails}
              onChange={(includeEmails) => update({ includeEmails })}
            />
          </div>
          <div className={`${FIELD} sm:col-span-2`}>
            <span className={LABEL}>
              Excluded emails <HelpTooltip text={TIPS.excluded} />
            </span>
            <EmailListInput
              emails={state.excludeEmails}
              onChange={(excludeEmails) => update({ excludeEmails })}
            />
          </div>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input
              type="checkbox"
              checked={state.excludeGranted}
              onChange={(e) => update({ excludeGranted: e.target.checked })}
            />
            Skip people who already received all these gifts
          </label>
        </div>
      </details>

      {/* Live summary + breakdown */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--coachio-admin-dashboard-radius-sm)] border border-[var(--coachio-admin-dashboard-accent)] bg-[var(--coachio-admin-dashboard-accent-soft,#fff7ed)] px-3.5 py-3">
        <span className="text-sm text-[var(--coachio-admin-dashboard-text)]">
          {summarySentence(state)}
        </span>
        <span className="text-xs text-[var(--coachio-admin-dashboard-text-muted)]">
          Matched <b className="text-[var(--coachio-admin-dashboard-text)]">{preview?.matched ?? '—'}</b> · already{' '}
          <b className="text-[var(--coachio-admin-dashboard-text)]">{preview?.already_granted ?? '—'}</b> ·{' '}
          <b className="text-[var(--coachio-admin-dashboard-text)]">{preview?.will_receive ?? '—'}</b> new
        </span>
      </div>
    </div>
  );
}
