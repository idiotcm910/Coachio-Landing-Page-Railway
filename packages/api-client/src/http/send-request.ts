import queryString from 'query-string';
import { clearAuthTokens, getAccessToken } from '../storage/local-storage';
import type { ApiRequest } from './types';

const SESSION_EXPIRED_EVENT = 'coachio:session-expired';

function notifySessionExpired(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
}

export async function sendRequest<T>(props: ApiRequest): Promise<T> {
  const {
    method,
    body,
    queryParams = {},
    useCredentials = false,
    headers = {},
    nextOption = {},
    url,
    isPublic = false,
    isFormData = false,
  } = props;

  const defaultHeaders: Record<string, string> = { ...headers };

  if (!isFormData) {
    defaultHeaders['content-type'] = 'application/json';
  }

  if (!isPublic) {
    const token = getAccessToken();
    if (!token) {
      throw new Error('No token found');
    }
    defaultHeaders.Authorization = `Bearer ${token}`;
  }

  const options: RequestInit = {
    method,
    headers: new Headers(defaultHeaders),
    ...(body ? { body: isFormData ? (body as BodyInit) : JSON.stringify(body) } : {}),
    ...nextOption,
  };

  if (useCredentials) {
    options.credentials = 'include';
  }

  const requestUrl = queryParams && Object.keys(queryParams).length > 0
    ? `${url}?${queryString.stringify(queryParams)}`
    : url;

  const response = await fetch(requestUrl, options);

  if (response.ok) {
    if (response.status === 204) {
      return { data: null } as T;
    }
    return { data: await response.json() } as T;
  }

  if (!isPublic && response.status === 401) {
    clearAuthTokens();
    notifySessionExpired();
  }

  const json = await response.json().catch(() => ({}));
  return {
    statusCode: response.status,
    message: json?.message ?? '',
    error: json?.detail ?? json?.error ?? '',
  } as T;
}
