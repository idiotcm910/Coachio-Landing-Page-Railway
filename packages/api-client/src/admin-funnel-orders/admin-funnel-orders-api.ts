import { apiClient } from '../http/api-client';
import { getApiErrorMessage } from '../http/error-message';
import type { ApiResponse } from '../http/types';
import type {
  AdminFunnelOrderDetail,
  AdminFunnelOrderFilterParams,
  AdminFunnelOrderListParams,
  AdminFunnelOrderListResponse,
  AdminFunnelOrderSummary,
} from './types';

const BASE = '/api/v1/admin/funnel-orders';

/** Per-request options — currently just an AbortSignal for cancelling stale searches. */
export interface AdminFunnelOrderRequestOptions {
  signal?: AbortSignal;
}

function buildFilterQuery(params: AdminFunnelOrderFilterParams = {}): Record<string, unknown> {
  return {
    ...(params.status ? { status: params.status } : {}),
    ...(params.q ? { q: params.q } : {}),
    ...(params.funnel_id ? { funnel_id: params.funnel_id } : {}),
    ...(params.date_from ? { date_from: params.date_from } : {}),
    ...(params.date_to ? { date_to: params.date_to } : {}),
  };
}

function requireData<T>(response: ApiResponse<T>, fallback: string): T {
  if (!response.data) throw new Error(getApiErrorMessage(response.error, fallback));
  return response.data;
}

export const adminFunnelOrdersApi = {
  async list(
    params: AdminFunnelOrderListParams = {},
    opts: AdminFunnelOrderRequestOptions = {},
  ): Promise<AdminFunnelOrderListResponse> {
    const response = await apiClient.get<ApiResponse<AdminFunnelOrderListResponse>>(BASE, {
      queryParams: {
        ...buildFilterQuery(params),
        ...(params.cursor ? { cursor: params.cursor } : {}),
        ...(params.per_page ? { per_page: params.per_page } : {}),
        ...(params.sort_by ? { sort_by: params.sort_by } : {}),
        ...(params.sort_order ? { sort_order: params.sort_order } : {}),
      },
      nextOption: opts.signal ? { signal: opts.signal } : {},
    });
    return requireData(response, 'Load funnel orders failed');
  },

  async summary(
    params: AdminFunnelOrderFilterParams = {},
    opts: AdminFunnelOrderRequestOptions = {},
  ): Promise<AdminFunnelOrderSummary> {
    const response = await apiClient.get<ApiResponse<AdminFunnelOrderSummary>>(`${BASE}/summary`, {
      queryParams: buildFilterQuery(params),
      nextOption: opts.signal ? { signal: opts.signal } : {},
    });
    return requireData(response, 'Load funnel orders summary failed');
  },

  async detail(
    orderId: string,
    opts: AdminFunnelOrderRequestOptions = {},
  ): Promise<AdminFunnelOrderDetail> {
    const response = await apiClient.get<ApiResponse<AdminFunnelOrderDetail>>(`${BASE}/${orderId}`, {
      nextOption: opts.signal ? { signal: opts.signal } : {},
    });
    return requireData(response, 'Load funnel order detail failed');
  },

  /**
   * Manually activate a PENDING order: marks it SUCCESS and runs every
   * success-flow (receipt email, lead conversion, fulfilment, Meta CAPI).
   * For buyers who paid but altered the SePay transfer memo so the webhook
   * could not auto-match. Returns 409 if the order is no longer pending.
   */
  async activate(orderId: string): Promise<AdminFunnelOrderDetail> {
    const response = await apiClient.post<ApiResponse<AdminFunnelOrderDetail>>(
      `${BASE}/${orderId}/activate`,
      {},
    );
    return requireData(response, 'Activate funnel order failed');
  },
};
