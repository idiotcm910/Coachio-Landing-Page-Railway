import { apiClient } from '../http/api-client';
import { getApiErrorMessage } from '../http/error-message';
import type { ApiResponse } from '../http/types';
import type {
  FunnelRevenueAnalyticsParams,
  FunnelRevenuePage,
  ProductRevenueDetail,
  ProductRevenuePage,
} from './types';

type DateRangeParams = Pick<FunnelRevenueAnalyticsParams, 'startDate' | 'endDate'>;

function buildQuery(params: FunnelRevenueAnalyticsParams = {}): Record<string, unknown> {
  return {
    ...(params.startDate ? { start_date: params.startDate } : {}),
    ...(params.endDate ? { end_date: params.endDate } : {}),
    ...(params.page ? { page: params.page } : {}),
    ...(params.pageSize ? { page_size: params.pageSize } : {}),
    ...(params.search ? { search: params.search } : {}),
  };
}

function requireData<T>(response: ApiResponse<T>, fallback: string): T {
  if (!response.data) throw new Error(getApiErrorMessage(response.error, fallback));
  return response.data;
}

export const funnelRevenueAnalyticsApi = {
  async getRevenueByFunnel(params: FunnelRevenueAnalyticsParams = {}): Promise<FunnelRevenuePage> {
    const response = await apiClient.get<ApiResponse<FunnelRevenuePage>>(
      '/api/v1/admin/funnel-analytics/revenue/by-funnel',
      { queryParams: buildQuery(params) },
    );
    return requireData(response, 'Load funnel revenue failed');
  },

  async getRevenueByProduct(params: FunnelRevenueAnalyticsParams = {}): Promise<ProductRevenuePage> {
    const response = await apiClient.get<ApiResponse<ProductRevenuePage>>(
      '/api/v1/admin/funnel-analytics/revenue/by-product',
      { queryParams: buildQuery(params) },
    );
    return requireData(response, 'Load product revenue failed');
  },

  async getProductRevenueDetail(productId: string, params: DateRangeParams = {}): Promise<ProductRevenueDetail> {
    const response = await apiClient.get<ApiResponse<ProductRevenueDetail>>(
      `/api/v1/admin/funnel-analytics/revenue/by-product/${productId}`,
      { queryParams: buildQuery(params) },
    );
    return requireData(response, 'Load product detail failed');
  },
};
