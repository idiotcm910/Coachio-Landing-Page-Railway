import { apiClient } from '../http/api-client';
import { getApiErrorMessage } from '../http/error-message';
import type { ApiResponse } from '../http/types';
import type {
  NotFoundConfig,
  RedirectCreateInput,
  RedirectListResponse,
  RedirectPublicConfig,
  RedirectRule,
  RedirectUpdateInput,
} from './types';

const BASE = '/api/v1/admin/url-redirects';
const PUBLIC_CONFIG = '/api/v1/public/url-redirects/config';

function requireData<T>(response: ApiResponse<T>, fallback: string): T {
  if (!response.data) throw new Error(getApiErrorMessage(response.error, fallback));
  return response.data;
}

export const adminUrlRedirectsApi = {
  async list(): Promise<RedirectListResponse> {
    const response = await apiClient.get<ApiResponse<RedirectListResponse>>(BASE);
    return requireData(response, 'Failed to load redirects');
  },

  async create(input: RedirectCreateInput): Promise<RedirectRule> {
    const response = await apiClient.post<ApiResponse<RedirectRule>>(BASE, input as unknown as Record<string, unknown>);
    return requireData(response, 'Failed to create redirect');
  },

  async update(id: string, input: RedirectUpdateInput): Promise<RedirectRule> {
    const response = await apiClient.patch<ApiResponse<RedirectRule>>(
      `${BASE}/${id}`,
      input as unknown as Record<string, unknown>,
    );
    return requireData(response, 'Failed to update redirect');
  },

  async remove(id: string): Promise<void> {
    const response = await apiClient.delete<ApiResponse<unknown>>(`${BASE}/${id}`);
    if (response.error) throw new Error(getApiErrorMessage(response.error, 'Failed to delete redirect'));
  },

  async getNotFoundConfig(): Promise<NotFoundConfig> {
    const response = await apiClient.get<ApiResponse<NotFoundConfig>>(`${BASE}/not-found-config`);
    return requireData(response, 'Failed to load 404 settings');
  },

  async updateNotFoundConfig(input: NotFoundConfig): Promise<NotFoundConfig> {
    const response = await apiClient.put<ApiResponse<NotFoundConfig>>(
      `${BASE}/not-found-config`,
      input as unknown as Record<string, unknown>,
    );
    return requireData(response, 'Failed to save 404 settings');
  },
};

/**
 * Fetch the public redirect config directly (no auth). Usable from the Next.js
 * middleware (edge) and the not-found server component. Cached `revalidateSeconds`.
 * Returns null on any failure so callers fall back to default behaviour.
 */
export async function fetchRedirectPublicConfig(
  revalidateSeconds = 60,
): Promise<RedirectPublicConfig | null> {
  const baseUrl = process.env.NEXT_PUBLIC_BACKEND_URL || '';
  // `next.revalidate` is a Next.js fetch extension; api-client tsconfig lacks the
  // Next types, so widen the init type locally instead of pulling in next/* deps.
  type NextFetchInit = RequestInit & { next?: { revalidate?: number } };
  const init: NextFetchInit = { next: { revalidate: revalidateSeconds } };
  try {
    const res = await fetch(`${baseUrl}${PUBLIC_CONFIG}`, init);
    if (!res.ok) return null;
    const json = (await res.json()) as ApiResponse<RedirectPublicConfig> | RedirectPublicConfig;
    // Backend may wrap in { data } or return raw — handle both.
    const data = (json as ApiResponse<RedirectPublicConfig>).data ?? (json as RedirectPublicConfig);
    if (!data || !Array.isArray((data as RedirectPublicConfig).rules)) return null;
    return data as RedirectPublicConfig;
  } catch {
    return null;
  }
}
