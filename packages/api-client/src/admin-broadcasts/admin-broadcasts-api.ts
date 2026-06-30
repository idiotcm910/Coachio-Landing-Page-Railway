import { apiClient } from '../http/api-client';
import { getApiErrorMessage } from '../http/error-message';
import type { ApiResponse } from '../http/types';
import type {
  AudienceConfig,
  AudienceFilters,
  AudiencePreview,
  BroadcastCampaign,
  BroadcastCampaignCreateInput,
  BroadcastCampaignUpdateInput,
  CampaignStats,
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

const F = (funnelId: string) => `/api/v1/admin/funnels/${funnelId}/broadcasts`;
const G = '/api/v1/admin/broadcasts';

export const adminFunnelBroadcastsApi = {
  async list(funnelId: string): Promise<BroadcastCampaign[]> {
    const r = await apiClient.get<ApiResponse<BroadcastCampaign[]>>(F(funnelId));
    return unwrap(r, 'Không tải được danh sách chiến dịch');
  },

  async create(funnelId: string, input: BroadcastCampaignCreateInput): Promise<BroadcastCampaign> {
    const r = await apiClient.post<ApiResponse<BroadcastCampaign>>(F(funnelId), asBody(input));
    return unwrap(r, 'Không tạo được chiến dịch');
  },

  async get(funnelId: string, id: string): Promise<BroadcastCampaign> {
    const r = await apiClient.get<ApiResponse<BroadcastCampaign>>(`${F(funnelId)}/${id}`);
    return unwrap(r, 'Không tải được chiến dịch');
  },

  async update(funnelId: string, id: string, input: BroadcastCampaignUpdateInput): Promise<BroadcastCampaign> {
    const r = await apiClient.patch<ApiResponse<BroadcastCampaign>>(`${F(funnelId)}/${id}`, asBody(input));
    return unwrap(r, 'Không cập nhật được chiến dịch');
  },

  async remove(funnelId: string, id: string): Promise<void> {
    await apiClient.delete<ApiResponse<null>>(`${F(funnelId)}/${id}`);
  },

  async audiencePreview(funnelId: string, id: string): Promise<AudiencePreview> {
    const r = await apiClient.post<ApiResponse<AudiencePreview>>(
      `${F(funnelId)}/${id}/audience-preview`,
      {},
    );
    return unwrap(r, 'Không đếm được người nhận');
  },

  async send(funnelId: string, id: string, scheduledAt: string | null = null): Promise<BroadcastCampaign> {
    const r = await apiClient.post<ApiResponse<BroadcastCampaign>>(
      `${F(funnelId)}/${id}/send`,
      { scheduled_at: scheduledAt },
    );
    return unwrap(r, 'Không gửi được chiến dịch');
  },

  async cancel(funnelId: string, id: string): Promise<BroadcastCampaign> {
    const r = await apiClient.post<ApiResponse<BroadcastCampaign>>(`${F(funnelId)}/${id}/cancel`, {});
    return unwrap(r, 'Không huỷ được chiến dịch');
  },

  async test(funnelId: string, id: string, email: string): Promise<void> {
    await apiClient.post<ApiResponse<null>>(`${F(funnelId)}/${id}/test`, { email });
  },

  async retryFailed(funnelId: string, id: string): Promise<BroadcastCampaign> {
    const r = await apiClient.post<ApiResponse<BroadcastCampaign>>(`${F(funnelId)}/${id}/retry-failed`, {});
    return unwrap(r, 'Không gửi lại được email lỗi');
  },

  async stats(funnelId: string, id: string, failedPage = 1, failedSize = 50): Promise<CampaignStats> {
    const r = await apiClient.get<ApiResponse<CampaignStats>>(`${F(funnelId)}/${id}/stats`, {
      queryParams: { failed_page: String(failedPage), failed_size: String(failedSize) },
    });
    return unwrap(r, 'Không tải được thống kê');
  },
};

export const adminBroadcastsApi = {
  async list(): Promise<BroadcastCampaign[]> {
    const r = await apiClient.get<ApiResponse<BroadcastCampaign[]>>(G);
    return unwrap(r, 'Không tải được danh sách chiến dịch');
  },

  async create(input: BroadcastCampaignCreateInput): Promise<BroadcastCampaign> {
    const r = await apiClient.post<ApiResponse<BroadcastCampaign>>(G, asBody(input));
    return unwrap(r, 'Không tạo được chiến dịch');
  },

  async get(id: string): Promise<BroadcastCampaign> {
    const r = await apiClient.get<ApiResponse<BroadcastCampaign>>(`${G}/${id}`);
    return unwrap(r, 'Không tải được chiến dịch');
  },

  async update(id: string, input: BroadcastCampaignUpdateInput): Promise<BroadcastCampaign> {
    const r = await apiClient.patch<ApiResponse<BroadcastCampaign>>(`${G}/${id}`, asBody(input));
    return unwrap(r, 'Không cập nhật được chiến dịch');
  },

  async remove(id: string): Promise<void> {
    await apiClient.delete<ApiResponse<null>>(`${G}/${id}`);
  },

  async audiencePreviewUnbound(funnelIds: string[], filters: AudienceFilters): Promise<AudiencePreview> {
    const r = await apiClient.post<ApiResponse<AudiencePreview>>(
      `${G}/audience-preview`,
      { funnel_ids: funnelIds, filters },
    );
    return unwrap(r, 'Không đếm được người nhận');
  },

  async audiencePreview(id: string): Promise<AudiencePreview> {
    const r = await apiClient.post<ApiResponse<AudiencePreview>>(`${G}/${id}/audience-preview`, {});
    return unwrap(r, 'Không đếm được người nhận');
  },

  async send(id: string, scheduledAt: string | null = null): Promise<BroadcastCampaign> {
    const r = await apiClient.post<ApiResponse<BroadcastCampaign>>(
      `${G}/${id}/send`,
      { scheduled_at: scheduledAt },
    );
    return unwrap(r, 'Không gửi được chiến dịch');
  },

  async cancel(id: string): Promise<BroadcastCampaign> {
    const r = await apiClient.post<ApiResponse<BroadcastCampaign>>(`${G}/${id}/cancel`, {});
    return unwrap(r, 'Không huỷ được chiến dịch');
  },

  async test(id: string, email: string): Promise<void> {
    await apiClient.post<ApiResponse<null>>(`${G}/${id}/test`, { email });
  },

  async retryFailed(id: string): Promise<BroadcastCampaign> {
    const r = await apiClient.post<ApiResponse<BroadcastCampaign>>(`${G}/${id}/retry-failed`, {});
    return unwrap(r, 'Không gửi lại được email lỗi');
  },

  async stats(id: string, failedPage = 1, failedSize = 50): Promise<CampaignStats> {
    const r = await apiClient.get<ApiResponse<CampaignStats>>(`${G}/${id}/stats`, {
      queryParams: { failed_page: String(failedPage), failed_size: String(failedSize) },
    });
    return unwrap(r, 'Không tải được thống kê');
  },
};

export type { AudienceConfig };
