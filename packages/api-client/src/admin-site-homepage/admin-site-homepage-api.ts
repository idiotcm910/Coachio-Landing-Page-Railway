import { apiClient } from '../http/api-client';
import { getApiErrorMessage } from '../http/error-message';
import type { ApiResponse } from '../http/types';
import type {
  HomepageOptionsResponse,
  PublicHomepage,
  SiteHomepageSetInput,
  SiteHomepageSetting,
} from './types';

const BASE = '/api/v1/admin/site-homepage';
const PUBLIC = '/api/v1/public/homepage';

function requireData<T>(response: ApiResponse<T>, fallback: string): T {
  if (!response.data) throw new Error(getApiErrorMessage(response.error, fallback));
  return response.data;
}

export const adminSiteHomepageApi = {
  async get(): Promise<SiteHomepageSetting> {
    const response = await apiClient.get<ApiResponse<SiteHomepageSetting>>(BASE);
    return requireData(response, 'Failed to load homepage setting');
  },

  async listOptions(): Promise<HomepageOptionsResponse> {
    const response = await apiClient.get<ApiResponse<HomepageOptionsResponse>>(`${BASE}/options`);
    return requireData(response, 'Failed to load homepage options');
  },

  async setTarget(input: SiteHomepageSetInput): Promise<SiteHomepageSetting> {
    const response = await apiClient.put<ApiResponse<SiteHomepageSetting>>(
      BASE,
      input as unknown as Record<string, unknown>,
    );
    return requireData(response, 'Failed to set homepage');
  },

  async clear(): Promise<SiteHomepageSetting> {
    const response = await apiClient.delete<ApiResponse<SiteHomepageSetting>>(BASE);
    return requireData(response, 'Failed to clear homepage');
  },
};

/** Resolve the public homepage payload (no auth). Used by the root `/` page. */
export async function fetchPublicHomepage(): Promise<PublicHomepage> {
  const response = await apiClient.get<ApiResponse<PublicHomepage>>(PUBLIC, { isPublic: true });
  return requireData(response, 'Failed to load homepage');
}
