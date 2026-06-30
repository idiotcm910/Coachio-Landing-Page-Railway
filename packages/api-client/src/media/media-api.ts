import { apiClient } from '../http/api-client';
import { getApiErrorMessage } from '../http/error-message';
import type { ApiResponse } from '../http/types';
import type { MediaAsset, MediaListQuery, MediaListResponse } from './types';

function unwrap<T>(response: ApiResponse<T>, errorLabel: string): T {
  if (response.data === undefined || response.data === null) {
    throw new Error(getApiErrorMessage(response.error, errorLabel));
  }
  return response.data;
}

/** Admin Media Library — /api/v1/admin/media (global catalog on S3). */
export const adminMediaApi = {
  async list(query: MediaListQuery = {}): Promise<MediaListResponse> {
    const queryParams: Record<string, string> = {};
    if (query.page != null) queryParams.page = String(query.page);
    if (query.page_size != null) queryParams.page_size = String(query.page_size);
    if (query.kind) queryParams.kind = query.kind;
    if (query.search) queryParams.search = query.search;

    const response = await apiClient.get<ApiResponse<MediaListResponse>>(
      '/api/v1/admin/media',
      { queryParams },
    );
    return unwrap(response, 'Load media failed');
  },

  async upload(file: File): Promise<MediaAsset> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await apiClient.post<ApiResponse<MediaAsset>>(
      '/api/v1/admin/media',
      formData,
      { isFormData: true },
    );
    return unwrap(response, 'Upload media failed');
  },

  async remove(assetId: string): Promise<void> {
    await apiClient.delete<ApiResponse<unknown>>(`/api/v1/admin/media/${assetId}`);
  },
};
