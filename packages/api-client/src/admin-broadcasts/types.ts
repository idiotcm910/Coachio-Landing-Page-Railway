export type BroadcastOrigin = 'funnel' | 'admin';
export type BroadcastStatus = 'draft' | 'scheduled' | 'sending' | 'completed' | 'cancelled' | 'failed';

export interface AudienceFilters {
  status?: 'purchased' | 'lead' | 'subscribed' | null;
  converted?: boolean | null;
  created_from?: string | null;
  created_to?: string | null;
}

export interface AudienceConfig {
  funnel_ids: string[];
  filters: AudienceFilters;
}

export interface BroadcastCampaign {
  id: string;
  origin: BroadcastOrigin;
  funnel_id: string | null;
  title: string;
  subject: string;
  html_body: string;
  audience_config: AudienceConfig | null;
  status: BroadcastStatus;
  scheduled_at: string | null;
  total_recipients: number;
  sent_count: number;
  failed_count: number;
  last_error: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface BroadcastCampaignCreateInput {
  title: string;
  subject: string;
  html_body: string;
  audience_config?: AudienceConfig;
  scheduled_at?: string | null;
}

export type BroadcastCampaignUpdateInput = Partial<BroadcastCampaignCreateInput>;

export interface AudiencePreview {
  count: number;
}

export interface SendJob {
  id: string;
  email: string;
  name: string | null;
  status: string;
  attempts: number;
  error: string | null;
  sent_at: string | null;
}

export interface CampaignStats {
  total: number;
  sent: number;
  failed: number;
  pending: number;
  last_error: string | null;
  failed_jobs: SendJob[];
  failed_total: number;
}
