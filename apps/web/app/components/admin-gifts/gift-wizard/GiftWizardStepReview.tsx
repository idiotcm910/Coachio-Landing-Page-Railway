'use client';

import { AlertTriangle, Gift as GiftIcon, Mail, Target } from 'lucide-react';
import type { Gift, GiftAudiencePreview } from '@coachio/api-client';
import { PILL, SEG_BTN, SEG_BTN_ON, SEG_WRAP, FIELD, INPUT, LABEL } from '../gift-ui';
import { AV_COLORS, initials, type WizardState, summarySentence } from './wizard-config';

export function GiftWizardStepReview({
  state,
  gifts,
  preview,
  delivery,
  scheduledAt,
  onDeliveryChange,
  onScheduledAtChange,
}: {
  state: WizardState;
  gifts: Gift[];
  preview: GiftAudiencePreview | null;
  delivery: 'now' | 'later';
  scheduledAt: string;
  onDeliveryChange: (d: 'now' | 'later') => void;
  onScheduledAtChange: (v: string) => void;
}) {
  const selectedGifts = gifts.filter((g) => state.giftIds.includes(g.id));
  const sample = preview?.sample ?? [];
  const willReceive = preview?.will_receive ?? 0;
  const moreCount = Math.max(willReceive - sample.length, 0);

  return (
    <div className="flex flex-col gap-4">
      {/* Tiles */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-[var(--coachio-admin-dashboard-radius-md,0.5rem)] border border-[var(--coachio-admin-dashboard-accent)] bg-[var(--coachio-admin-dashboard-accent)] p-4 text-[var(--coachio-admin-dashboard-text-inverse,#fff)]">
          <div className="text-2xl font-extrabold tracking-tight">{willReceive}</div>
          <div className="mt-0.5 text-xs opacity-90">Will receive</div>
        </div>
        <div className="rounded-[var(--coachio-admin-dashboard-radius-md,0.5rem)] border border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface)] p-4">
          <div className="text-2xl font-extrabold tracking-tight">{preview?.matched ?? '—'}</div>
          <div className="mt-0.5 text-xs text-[var(--coachio-admin-dashboard-text-soft)]">Matched</div>
        </div>
        <div className="rounded-[var(--coachio-admin-dashboard-radius-md,0.5rem)] border border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface)] p-4">
          <div className="text-2xl font-extrabold tracking-tight">{preview?.already_granted ?? '—'}</div>
          <div className="mt-0.5 text-xs text-[var(--coachio-admin-dashboard-text-soft)]">Already have it</div>
        </div>
      </div>

      {/* Summary card: gifts / audience / email */}
      <div className="overflow-hidden rounded-[var(--coachio-admin-dashboard-radius-md,0.5rem)] border border-[var(--coachio-admin-dashboard-border)]">
        <ReviewRow icon={<GiftIcon className="h-4 w-4" />} label="Gifts">
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {selectedGifts.length > 0 ? (
              selectedGifts.map((g) => (
                <span key={g.id} className={PILL}>
                  {g.name}
                </span>
              ))
            ) : (
              <span className="text-sm text-[var(--coachio-admin-dashboard-text-soft)]">No gifts selected</span>
            )}
          </div>
        </ReviewRow>
        <ReviewRow icon={<Target className="h-4 w-4" />} label="Audience" bordered>
          <div className="mt-0.5 text-sm text-[var(--coachio-admin-dashboard-text)]">
            {summarySentence(state)}
          </div>
        </ReviewRow>
        <ReviewRow icon={<Mail className="h-4 w-4" />} label="Email" bordered>
          <div className="mt-0.5 text-sm text-[var(--coachio-admin-dashboard-text)]">
            “{state.emailSubject}”
          </div>
        </ReviewRow>
      </div>

      {/* Recipients card */}
      <div className="overflow-hidden rounded-[var(--coachio-admin-dashboard-radius-md,0.5rem)] border border-[var(--coachio-admin-dashboard-border)]">
        <div className="flex items-center justify-between border-b border-[var(--coachio-admin-dashboard-border)] px-4 py-3 text-sm font-semibold">
          <span>Recipients</span>
          <span className="font-normal text-[var(--coachio-admin-dashboard-text-soft)]">
            {willReceive} people
            {state.includeEmails.length > 0 ? ` · +${state.includeEmails.length} added manually` : ''}
          </span>
        </div>
        <div className="p-2">
          {sample.length > 0 ? (
            sample.map((p, i) => (
              <div key={p.email} className="flex items-center gap-3 rounded-lg px-2 py-2">
                <span
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold text-white"
                  style={{ backgroundColor: AV_COLORS[i % AV_COLORS.length] }}
                >
                  {initials(p.name, p.email)}
                </span>
                <div className="min-w-0">
                  {p.name && <div className="text-sm font-semibold">{p.name}</div>}
                  <div className="truncate text-xs text-[var(--coachio-admin-dashboard-text-soft)]">{p.email}</div>
                </div>
              </div>
            ))
          ) : (
            <p className="px-2 py-3 text-sm text-[var(--coachio-admin-dashboard-text-soft)]">
              No recipients preview available.
            </p>
          )}
        </div>
        {moreCount > 0 && (
          <div className="border-t border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface-muted)] px-4 py-2.5 text-xs text-[var(--coachio-admin-dashboard-text-muted)]">
            + {moreCount} more recipients
          </div>
        )}
      </div>

      {/* Delivery */}
      <div className={FIELD}>
        <span className={LABEL}>Delivery</span>
        <div className="flex flex-col gap-2.5">
          <div className={SEG_WRAP}>
            <button
              type="button"
              onClick={() => onDeliveryChange('now')}
              className={`${SEG_BTN} ${delivery === 'now' ? SEG_BTN_ON : ''}`}
            >
              Send now
            </button>
            <button
              type="button"
              onClick={() => onDeliveryChange('later')}
              className={`${SEG_BTN} ${delivery === 'later' ? SEG_BTN_ON : ''}`}
            >
              Schedule for later
            </button>
          </div>
          {delivery === 'later' && (
            <input
              type="datetime-local"
              className={`${INPUT} max-w-xs`}
              value={scheduledAt}
              onChange={(e) => onScheduledAtChange(e.target.value)}
            />
          )}
        </div>
      </div>

      {/* Irreversible warning */}
      <div className="flex items-start gap-2.5 rounded-[var(--coachio-admin-dashboard-radius-sm)] border border-amber-300 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
        <div>
          Sending gifts that include <b>credits</b> grants real balance to recipients and{' '}
          <b>cannot be undone</b>. Double-check the audience above.
        </div>
      </div>
    </div>
  );
}

function ReviewRow({
  icon,
  label,
  children,
  bordered,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
  bordered?: boolean;
}) {
  return (
    <div
      className={`flex items-start gap-3 px-4 py-3.5 ${
        bordered ? 'border-t border-[var(--coachio-admin-dashboard-border)]' : ''
      }`}
    >
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[var(--coachio-admin-dashboard-accent-soft,#fff7ed)] text-[var(--coachio-admin-dashboard-accent)]">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-xs font-semibold uppercase tracking-wide text-[var(--coachio-admin-dashboard-text-soft)]">
          {label}
        </div>
        {children}
      </div>
    </div>
  );
}
