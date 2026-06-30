// Shared state shape + option maps + helpers for the gift-campaign wizard.
// Keeps the step components thin and the parent (GiftCampaignFormModal) the single
// owner of all form state.

import type { GiftAudienceConfig, GiftOrderBy } from '@coachio/api-client';

/** Segmented "Audience" control → maps to audience_config.status. */
export const AUDIENCE_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Everyone' },
  { value: 'purchased', label: 'Buyers (paid)' },
  { value: 'subscribed', label: 'Subscribers (not bought)' },
];

/** order_by values with friendly labels used in the "ordered by" sentence. */
export const SORT_OPTIONS: { value: GiftOrderBy; label: string }[] = [
  { value: 'earliest_reg', label: 'earliest sign-up' },
  { value: 'latest_reg', label: 'newest sign-up' },
  { value: 'earliest_purchase', label: 'earliest purchase' },
  { value: 'latest_purchase', label: 'latest purchase' },
  { value: 'amount_desc', label: 'highest spend' },
];

/** Help-tooltip copy (verbatim from the approved mockup). */
export const TIPS = {
  datefield:
    'Choose whether the date range filters by when a lead registered or when they purchased.',
  hasaccount:
    "Only include recipients who already have (or don't have) a Coachio account.",
  fromdate: 'Earliest date to include. Applies to the date field selected on the left.',
  todate: 'Latest date to include. Leave empty for no upper bound.',
  minspend: 'Only include buyers whose total spend is at least this amount (VND).',
  maxspend: 'Only include buyers whose total spend is at most this amount (VND).',
  utmsource: 'Match leads captured with this utm_source tag (e.g. facebook).',
  utmcampaign: 'Match leads captured with this utm_campaign tag.',
  manual: "Always include these emails, even if they don't match the filters above.",
  excluded: 'Never send to these emails, even if they match the filters.',
  orderby:
    'When you limit to "the first N", this decides WHICH N are picked — e.g. the 10 earliest sign-ups vs the 10 biggest spenders. Ignored when sending to everyone.',
} as const;

export const AV_COLORS = ['#f97316', '#0ea5e9', '#8b5cf6', '#10b981', '#ef4444', '#6366f1'];

export function initials(name?: string | null, email?: string): string {
  const src = (name && name.trim()) || email || '?';
  const parts = src.split(/\s+/).filter(Boolean).slice(-2);
  return parts.map((w) => w[0]).join('').toUpperCase().slice(0, 2) || '?';
}

/** All wizard form state — owned by the parent modal. */
export interface WizardState {
  name: string;
  giftIds: string[];
  emailSubject: string;
  emailHtml: string;
  funnelIds: string[];
  audience: string; // '' | 'purchased' | 'subscribed'
  limitMode: 'all' | 'n';
  limitN: string;
  orderBy: GiftOrderBy;
  dateField: string; // 'registration' | 'purchase'
  dateFrom: string;
  dateTo: string;
  amountMin: string;
  amountMax: string;
  utmSource: string;
  utmCampaign: string;
  hasAccount: string; // '' | 'true' | 'false'
  includeEmails: string[];
  excludeEmails: string[];
  excludeGranted: boolean;
}

export function buildAudienceConfig(s: WizardState): GiftAudienceConfig {
  return {
    funnel_ids: s.funnelIds,
    status: s.audience || null,
    date_field: s.dateField as GiftAudienceConfig['date_field'],
    date_from: s.dateFrom || null,
    date_to: s.dateTo || null,
    order_by: s.orderBy || null,
    limit: s.limitMode === 'all' ? null : Number(s.limitN) || null,
    include_emails: s.includeEmails,
    exclude_emails: s.excludeEmails,
    exclude_already_granted: s.excludeGranted,
    amount_min: s.amountMin ? Number(s.amountMin) : null,
    amount_max: s.amountMax ? Number(s.amountMax) : null,
    utm_source: s.utmSource || null,
    utm_campaign: s.utmCampaign || null,
    has_account: s.hasAccount === '' ? null : s.hasAccount === 'true',
  };
}

/** Plain-text summary sentence shown in step 2 + step 3. */
export function summarySentence(s: WizardState): string {
  const audienceLabel = (
    AUDIENCE_OPTIONS.find((a) => a.value === s.audience)?.label ?? 'Everyone'
  ).toLowerCase();
  const sortLabel = SORT_OPTIONS.find((o) => o.value === s.orderBy)?.label ?? 'earliest sign-up';
  const limitText = s.limitMode === 'all' ? 'all' : `the first ${Number(s.limitN) || 0}`;
  const funnelText =
    s.funnelIds.length === 0
      ? 'all funnels'
      : `${s.funnelIds.length} funnel${s.funnelIds.length > 1 ? 's' : ''}`;
  return `Send to ${limitText} ${audienceLabel}, ordered by ${sortLabel}, from ${funnelText}.`;
}
