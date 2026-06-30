import { apiClient } from '../http/api-client';
import { getApiErrorMessage } from '../http/error-message';
import type { ApiResponse } from '../http/types';
import type {
  Gift,
  GiftAudienceConfig,
  GiftAudiencePreview,
  GiftAutomation,
  GiftAutomationCreateInput,
  GiftAutomationUpdateInput,
  GiftCampaign,
  GiftCampaignCreateInput,
  GiftCampaignStats,
  GiftCampaignUpdateInput,
  GiftCreateInput,
  GiftEmailPreview,
  GiftGrantDetail,
  GiftGrantFilters,
  GiftGrantListResponse,
  GiftGrantStats,
  GiftResendResult,
  GiftUpdateInput,
  GiftVariable,
} from './types';

function asBody<T extends object>(input: T): Record<string, unknown> {
  return input as Record<string, unknown>;
}

function unwrap<T>(response: ApiResponse<T>, fallback: string): T {
  if (response.data === undefined || response.data === null) {
    throw new Error(getApiErrorMessage(response.error, fallback));
  }
  return response.data;
}

const G = '/api/v1/admin/gifts';
const GA = '/api/v1/admin/gift-automations';
const GC = '/api/v1/admin/gift-campaigns';

export const adminGiftsApi = {
  async list(includeArchived = false): Promise<Gift[]> {
    const r = await apiClient.get<ApiResponse<Gift[]>>(`${G}?include_archived=${includeArchived}`);
    return unwrap(r, 'Failed to load gifts');
  },
  async create(input: GiftCreateInput): Promise<Gift> {
    const r = await apiClient.post<ApiResponse<Gift>>(G, asBody(input));
    return unwrap(r, 'Failed to create gift');
  },
  async get(id: string): Promise<Gift> {
    const r = await apiClient.get<ApiResponse<Gift>>(`${G}/${id}`);
    return unwrap(r, 'Failed to load gift');
  },
  async update(id: string, input: GiftUpdateInput): Promise<Gift> {
    const r = await apiClient.patch<ApiResponse<Gift>>(`${G}/${id}`, asBody(input));
    return unwrap(r, 'Failed to update gift');
  },
  async archive(id: string): Promise<Gift> {
    const r = await apiClient.delete<ApiResponse<Gift>>(`${G}/${id}`);
    return unwrap(r, 'Failed to archive gift');
  },
};

export const adminGiftAutomationsApi = {
  async list(): Promise<GiftAutomation[]> {
    const r = await apiClient.get<ApiResponse<GiftAutomation[]>>(GA);
    return unwrap(r, 'Failed to load automations');
  },
  async create(input: GiftAutomationCreateInput): Promise<GiftAutomation> {
    const r = await apiClient.post<ApiResponse<GiftAutomation>>(GA, asBody(input));
    return unwrap(r, 'Failed to create automation');
  },
  async get(id: string): Promise<GiftAutomation> {
    const r = await apiClient.get<ApiResponse<GiftAutomation>>(`${GA}/${id}`);
    return unwrap(r, 'Failed to load automation');
  },
  async update(id: string, input: GiftAutomationUpdateInput): Promise<GiftAutomation> {
    const r = await apiClient.patch<ApiResponse<GiftAutomation>>(`${GA}/${id}`, asBody(input));
    return unwrap(r, 'Failed to update automation');
  },
  async remove(id: string): Promise<void> {
    await apiClient.delete<ApiResponse<null>>(`${GA}/${id}`);
  },
};

export const adminGiftCampaignsApi = {
  async list(): Promise<GiftCampaign[]> {
    const r = await apiClient.get<ApiResponse<GiftCampaign[]>>(GC);
    return unwrap(r, 'Failed to load gift campaigns');
  },
  async create(input: GiftCampaignCreateInput): Promise<GiftCampaign> {
    const r = await apiClient.post<ApiResponse<GiftCampaign>>(GC, asBody(input));
    return unwrap(r, 'Failed to create gift campaign');
  },
  async get(id: string): Promise<GiftCampaign> {
    const r = await apiClient.get<ApiResponse<GiftCampaign>>(`${GC}/${id}`);
    return unwrap(r, 'Failed to load gift campaign');
  },
  async update(id: string, input: GiftCampaignUpdateInput): Promise<GiftCampaign> {
    const r = await apiClient.patch<ApiResponse<GiftCampaign>>(`${GC}/${id}`, asBody(input));
    return unwrap(r, 'Failed to update gift campaign');
  },
  async remove(id: string): Promise<void> {
    await apiClient.delete<ApiResponse<null>>(`${GC}/${id}`);
  },
  async audiencePreview(giftIds: string[], audienceConfig: GiftAudienceConfig): Promise<GiftAudiencePreview> {
    const r = await apiClient.post<ApiResponse<GiftAudiencePreview>>(`${GC}/audience-preview`, {
      gift_ids: giftIds,
      audience_config: audienceConfig,
    });
    return unwrap(r, 'Failed to count recipients');
  },
  // Delivery-email editor helpers (shared by campaign + automation editors).
  async emailVariables(): Promise<GiftVariable[]> {
    const r = await apiClient.get<ApiResponse<GiftVariable[]>>(`${GC}/email-variables`);
    return unwrap(r, 'Failed to load variables');
  },
  async previewEmail(giftIds: string[], emailSubject: string, emailHtml: string): Promise<GiftEmailPreview> {
    const r = await apiClient.post<ApiResponse<GiftEmailPreview>>(`${GC}/preview-email`, {
      gift_ids: giftIds, email_subject: emailSubject, email_html: emailHtml,
    });
    return unwrap(r, 'Failed to preview email');
  },
  async testSendEmail(giftIds: string[], emailSubject: string, emailHtml: string, toEmail: string): Promise<void> {
    await apiClient.post<ApiResponse<null>>(`${GC}/test-send-email`, {
      gift_ids: giftIds, email_subject: emailSubject, email_html: emailHtml, to_email: toEmail,
    });
  },
  async audiencePreviewBound(id: string): Promise<GiftAudiencePreview> {
    const r = await apiClient.post<ApiResponse<GiftAudiencePreview>>(`${GC}/${id}/audience-preview`, {});
    return unwrap(r, 'Failed to count recipients');
  },
  async confirm(id: string): Promise<GiftCampaign> {
    const r = await apiClient.post<ApiResponse<GiftCampaign>>(`${GC}/${id}/confirm`, {});
    return unwrap(r, 'Failed to confirm recipients');
  },
  async send(id: string, scheduledAt?: string | null): Promise<GiftCampaign> {
    const r = await apiClient.post<ApiResponse<GiftCampaign>>(`${GC}/${id}/send`, {
      scheduled_at: scheduledAt ?? null,
    });
    return unwrap(r, 'Failed to send gift campaign');
  },
  async cancel(id: string): Promise<GiftCampaign> {
    const r = await apiClient.post<ApiResponse<GiftCampaign>>(`${GC}/${id}/cancel`, {});
    return unwrap(r, 'Failed to cancel gift campaign');
  },
  async retryFailed(id: string): Promise<GiftCampaign> {
    const r = await apiClient.post<ApiResponse<GiftCampaign>>(`${GC}/${id}/retry-failed`, {});
    return unwrap(r, 'Failed to resend failed emails');
  },
  async stats(id: string, failedPage = 1, failedSize = 50): Promise<GiftCampaignStats> {
    const r = await apiClient.get<ApiResponse<GiftCampaignStats>>(
      `${GC}/${id}/stats?failed_page=${failedPage}&failed_size=${failedSize}`,
    );
    return unwrap(r, 'Failed to load campaign stats');
  },
};

const GG = '/api/v1/admin/gift-grants';

function qs(filters: GiftGrantFilters & { page?: number; size?: number } = {}): string {
  const p = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') p.set(k, String(v));
  });
  const s = p.toString();
  return s ? `?${s}` : '';
}

export const adminGiftGrantsApi = {
  async list(filters: GiftGrantFilters & { page?: number; size?: number } = {}): Promise<GiftGrantListResponse> {
    const r = await apiClient.get<ApiResponse<GiftGrantListResponse>>(`${GG}${qs(filters)}`);
    return unwrap(r, 'Failed to load gift grant history');
  },
  async stats(filters: GiftGrantFilters = {}): Promise<GiftGrantStats> {
    const r = await apiClient.get<ApiResponse<GiftGrantStats>>(`${GG}/stats${qs(filters)}`);
    return unwrap(r, 'Failed to load gift grant stats');
  },
  async detail(id: string): Promise<GiftGrantDetail> {
    const r = await apiClient.get<ApiResponse<GiftGrantDetail>>(`${GG}/${id}`);
    return unwrap(r, 'Failed to load grant detail');
  },
  async resend(id: string): Promise<GiftResendResult> {
    const r = await apiClient.post<ApiResponse<GiftResendResult>>(`${GG}/${id}/resend`, {});
    return unwrap(r, 'Failed to resend email');
  },
  async bulkRetry(filters: GiftGrantFilters = {}): Promise<GiftResendResult> {
    const r = await apiClient.post<ApiResponse<GiftResendResult>>(`${GG}/bulk-retry${qs(filters)}`, {});
    return unwrap(r, 'Failed to bulk resend emails');
  },
};
