import { sendRequest } from './send-request';
import type { ApiRequest } from './types';

type RequestOptions = Omit<ApiRequest, 'url' | 'method'>;

export class ApiClient {
  constructor(private readonly baseUrl = '') {}

  get<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    return sendRequest<T>({
      url: this.baseUrl + endpoint,
      method: 'GET',
      ...options,
    });
  }

  post<T>(endpoint: string, body?: Record<string, unknown> | BodyInit, options: RequestOptions = {}): Promise<T> {
    return sendRequest<T>({
      url: this.baseUrl + endpoint,
      method: 'POST',
      body,
      ...options,
    });
  }

  put<T>(endpoint: string, body?: Record<string, unknown> | BodyInit, options: RequestOptions = {}): Promise<T> {
    return sendRequest<T>({
      url: this.baseUrl + endpoint,
      method: 'PUT',
      body,
      ...options,
    });
  }

  patch<T>(endpoint: string, body?: Record<string, unknown> | BodyInit, options: RequestOptions = {}): Promise<T> {
    return sendRequest<T>({
      url: this.baseUrl + endpoint,
      method: 'PATCH',
      body,
      ...options,
    });
  }

  delete<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    return sendRequest<T>({
      url: this.baseUrl + endpoint,
      method: 'DELETE',
      ...options,
    });
  }
}

export function createApiClient(baseUrl = ''): ApiClient {
  return new ApiClient(baseUrl);
}

export const apiClient = createApiClient(process.env.NEXT_PUBLIC_BACKEND_URL || '');
