// Gift automation types — mirror the backend Pydantic schemas.

export interface ExternalItem {
  label: string;
  url: string;
  description?: string | null;
}

export interface Gift {
  id: string;
  name: string;
  description?: string | null;
  internal_config?: Record<string, unknown> | null;
  external_items?: ExternalItem[] | null;
  is_archived: boolean;
  created_at: string;
  updated_at?: string | null;
}

export interface GiftCreateInput {
  name: string;
  description?: string | null;
  external_items?: ExternalItem[];
}

export type GiftUpdateInput = Partial<GiftCreateInput> & { is_archived?: boolean };

export interface GiftEmailPreview {
  subject: string;
  html: string;
}

export interface GiftVariable {
  key: string;
  label: string;
  description?: string;
}

// --- Automation (mechanism 1) ---
export type GiftTriggerStatus = 'purchased' | 'subscribed' | 'lead';

export interface GiftAutomation {
  id: string;
  gift_ids?: string[] | null;
  funnel_id?: string | null;
  trigger_status: GiftTriggerStatus;
  is_active: boolean;
  max_total_grants?: number | null;
  grants_count: number;
  email_subject: string;
  email_html: string;
  created_at: string;
  updated_at?: string | null;
}

export interface GiftAutomationCreateInput {
  gift_ids: string[];
  funnel_id?: string | null;
  trigger_status: GiftTriggerStatus;
  is_active?: boolean;
  max_total_grants?: number | null;
  email_subject?: string;
  email_html?: string;
}

export type GiftAutomationUpdateInput = Partial<GiftAutomationCreateInput>;

// --- Audience + campaign (mechanism 2) ---
export type GiftDateField = 'registration' | 'purchase';
export type GiftOrderBy =
  | 'earliest_reg'
  | 'latest_reg'
  | 'earliest_purchase'
  | 'latest_purchase'
  | 'amount_desc';

export interface GiftAudienceConfig {
  funnel_ids?: string[];
  status?: string | null;
  date_field?: GiftDateField;
  date_from?: string | null;
  date_to?: string | null;
  order_by?: GiftOrderBy | null;
  limit?: number | null;
  include_emails?: string[];
  exclude_emails?: string[];
  exclude_already_granted?: boolean;
  amount_min?: number | null;
  amount_max?: number | null;
  utm_source?: string | null;
  utm_campaign?: string | null;
  product_id?: string | null;
  has_account?: boolean | null;
}

export interface GiftCampaign {
  id: string;
  name: string;
  gift_ids?: string[] | null;
  email_subject: string;
  email_html: string;
  audience_config?: GiftAudienceConfig | null;
  status: string;
  scheduled_at?: string | null;
  snapshot_at?: string | null;
  total_recipients: number;
  sent_count: number;
  failed_count: number;
  skipped_count: number;
  last_error?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  created_at: string;
  updated_at?: string | null;
}

export interface GiftCampaignCreateInput {
  name: string;
  gift_ids: string[];
  email_subject?: string;
  email_html?: string;
  audience_config?: GiftAudienceConfig | null;
  scheduled_at?: string | null;
}

export type GiftCampaignUpdateInput = Partial<GiftCampaignCreateInput>;

export interface GiftRecipientSample {
  email: string;
  name?: string | null;
}

export interface GiftAudiencePreview {
  matched: number;
  already_granted: number;
  will_receive: number;
  sample?: GiftRecipientSample[];
}

export interface GiftSendJob {
  id: string;
  email: string;
  name?: string | null;
  status: string;
  attempts: number;
  error?: string | null;
  sent_at?: string | null;
}

export interface GiftCampaignStats {
  total: number;
  sent: number;
  failed: number;
  pending: number;
  skipped: number;
  last_error?: string | null;
  failed_jobs: GiftSendJob[];
  failed_total: number;
}

// --- Grant tracking / audit ---
export interface GiftGrant {
  id: string;
  gift_id: string;
  user_id?: string | null;
  email: string;
  recipient_name?: string | null;
  recipient_phone?: string | null;
  source?: string | null;
  source_type?: string | null;
  gift_name?: string | null;
  unlocked_skills: boolean;
  credits_granted: number;
  api_enabled: boolean;
  new_account_created: boolean;
  status: string;
  email_status: string;
  email_sent_at?: string | null;
  email_error?: string | null;
  resend_count: number;
  granted_at: string;
}

export interface GiftGrantDetail extends GiftGrant {
  external_items_snapshot?: ExternalItem[] | null;
  current_credit_balance?: number | null;
  source_label?: string | null;
}

export interface GiftGrantListResponse {
  items: GiftGrant[];
  total: number;
}

export interface GiftPerGiftCount {
  gift_id: string;
  gift_name?: string | null;
  count: number;
}

export interface GiftGrantStats {
  total_grants: number;
  total_credits_granted: number;
  distinct_recipients: number;
  email_failed_count: number;
  per_gift: GiftPerGiftCount[];
}

export interface GiftGrantFilters {
  gift_id?: string;
  funnel_id?: string;
  source_type?: 'auto' | 'campaign';
  email_status?: 'sent' | 'pending' | 'failed';
  email?: string;
  content?: 'includes_credits' | 'skills_only';
  new_account_created?: boolean;
  date_from?: string;
  date_to?: string;
}

export interface GiftResendResult {
  resent: number;
  failed: number;
}
