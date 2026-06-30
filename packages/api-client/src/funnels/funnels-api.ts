import { apiClient } from '../http/api-client';
import { getApiErrorMessage } from '../http/error-message';
import type { ApiResponse } from '../http/types';
import type {
  FunnelCheckoutInput,
  FunnelCheckoutResult,
  FunnelOrderStatus,
  FunnelPageType,
  FunnelQuote,
  PublicFunnelLanding,
} from './types';

/** Public (anonymous) funnel endpoints — landing, quote, checkout, order status. */
export const funnelsApi = {
  async getPublicFunnel(slug: string): Promise<PublicFunnelLanding> {
    const response = await apiClient.get<ApiResponse<PublicFunnelLanding>>(
      `/api/v1/public/funnels/${slug}`,
      { isPublic: true },
    );
    if (!response.data) throw new Error(getApiErrorMessage(response.error, 'Load funnel failed'));
    return response.data;
  },

  async quoteFunnelOrder(slug: string, discountCodes: string[]): Promise<FunnelQuote> {
    const response = await apiClient.post<ApiResponse<FunnelQuote>>(
      `/api/v1/public/funnels/${slug}/quote`,
      { discount_codes: discountCodes },
      { isPublic: true },
    );
    if (!response.data) throw new Error(getApiErrorMessage(response.error, 'Quote failed'));
    return response.data;
  },

  async checkoutFunnel(slug: string, input: FunnelCheckoutInput): Promise<FunnelCheckoutResult> {
    const response = await apiClient.post<ApiResponse<FunnelCheckoutResult>>(
      `/api/v1/public/funnels/${slug}/checkout`,
      input as unknown as Record<string, unknown>,
      { isPublic: true },
    );
    if (!response.data) throw new Error(getApiErrorMessage(response.error, 'Checkout failed'));
    return response.data;
  },

  async getFunnelOrderStatus(orderId: string): Promise<FunnelOrderStatus> {
    const response = await apiClient.get<ApiResponse<FunnelOrderStatus>>(
      `/api/v1/public/funnels/orders/${orderId}/status`,
      { isPublic: true },
    );
    if (!response.data) throw new Error(getApiErrorMessage(response.error, 'Load order status failed'));
    return response.data;
  },

  /** Best-effort anonymous page-view tracking. Never throws — analytics must not break UX. */
  async trackPageView(slug: string, page: FunnelPageType, visitorId?: string): Promise<void> {
    try {
      await apiClient.post(
        `/api/v1/public/funnels/${slug}/track`,
        { page, visitor_id: visitorId },
        { isPublic: true },
      );
    } catch {
      // swallow — tracking failures are non-critical
    }
  },
};
