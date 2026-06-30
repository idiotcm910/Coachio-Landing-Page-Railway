'use client';

import { Info } from 'lucide-react';
import type { Gift } from '@coachio/api-client';
import { GiftEmailEditor } from '../GiftEmailEditor';
import { FIELD, INPUT, LABEL } from '../gift-ui';
import type { WizardState } from './wizard-config';

/**
 * Wizard step 1 — pick the gifts (multi-select) + compose the delivery email.
 * The campaign name lives here too (required by the create/update API; the
 * mockup omits it because its demo opens on step 2).
 */
export function GiftWizardStepGifts({
  state,
  update,
  gifts,
}: {
  state: WizardState;
  update: (patch: Partial<WizardState>) => void;
  gifts: Gift[];
}) {
  const toggleGift = (id: string) =>
    update({
      giftIds: state.giftIds.includes(id)
        ? state.giftIds.filter((x) => x !== id)
        : [...state.giftIds, id],
    });

  return (
    <div className="flex flex-col gap-5">
      <label className={FIELD}>
        <span className={LABEL}>Campaign name</span>
        <input
          className={INPUT}
          value={state.name}
          onChange={(e) => update({ name: e.target.value })}
          placeholder="e.g. Workshop closing gift"
        />
      </label>

      <div className={FIELD}>
        <span className={LABEL}>Gifts (select one or more)</span>
        <div className="flex flex-wrap gap-x-4 gap-y-2 rounded-[var(--coachio-admin-dashboard-radius-sm)] border border-[var(--coachio-admin-dashboard-border)] p-3">
          {gifts.map((g) => (
            <label key={g.id} className="flex items-center gap-1.5 text-sm">
              <input
                type="checkbox"
                checked={state.giftIds.includes(g.id)}
                onChange={() => toggleGift(g.id)}
              />
              {g.name}
            </label>
          ))}
          {gifts.length === 0 && (
            <span className="text-xs text-[var(--coachio-admin-dashboard-text-soft)]">
              No gifts yet — create one in the Gifts tab first.
            </span>
          )}
        </div>
      </div>

      <div>
        <span className={LABEL}>Delivery email</span>
        <div className="mt-2 mb-3 flex items-start gap-2.5 rounded-[var(--coachio-admin-dashboard-radius-md,0.5rem)] border border-sky-200 bg-sky-50 px-3.5 py-3">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-700" />
          <div>
            <p className="text-xs font-semibold text-sky-900">
              A separate account email is sent automatically
            </p>
            <p className="mt-1 text-xs leading-relaxed text-sky-800">
              When a gift unlocks AI Skills or grants credits, recipients also get the standard
              Coachio account email (login + password for new accounts), same as other flows. You
              don&apos;t write that here; this email is just the gift message.
            </p>
          </div>
        </div>
        <div className="mt-2">
          <GiftEmailEditor
            gifts={gifts}
            giftIds={state.giftIds}
            subject={state.emailSubject}
            html={state.emailHtml}
            onChange={(patch) => {
              const next: Partial<WizardState> = {};
              if (patch.subject !== undefined) next.emailSubject = patch.subject;
              if (patch.html !== undefined) next.emailHtml = patch.html;
              update(next);
            }}
          />
        </div>
      </div>
    </div>
  );
}
