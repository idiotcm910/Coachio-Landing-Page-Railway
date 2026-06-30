import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authApi } from './auth-api';
import { apiClient } from '../http/api-client';

vi.mock('../http/api-client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

vi.mock('../storage', () => ({
  setAuthTokens: vi.fn(),
  clearAuthTokens: vi.fn(),
  getAccessToken: vi.fn(() => 'mock-token'),
}));

const postRequest = vi.mocked(apiClient.post);
const getRequest = vi.mocked(apiClient.get);

beforeEach(() => {
  postRequest.mockReset();
  getRequest.mockReset();
});

describe('authApi.login', () => {
  it('posts to admin auth endpoint and returns token', async () => {
    postRequest.mockResolvedValueOnce({
      data: { access_token: 'tok-abc', token_type: 'bearer' },
    });

    const result = await authApi.login('admin@example.com', 'secret');

    expect(postRequest).toHaveBeenCalledWith(
      '/api/v1/admin/auth/login',
      { email: 'admin@example.com', password: 'secret' },
      { isPublic: true },
    );
    expect(result.data?.access_token).toBe('tok-abc');
  });
});

describe('authApi.me', () => {
  it('returns mapped user when token exists and API responds', async () => {
    getRequest.mockResolvedValueOnce({
      data: {
        id: 'admin-1',
        email: 'admin@example.com',
        full_name: 'Admin User',
        role: 'admin',
        is_active: true,
        credits: 0,
      },
    });

    const user = await authApi.me();

    expect(user?.email).toBe('admin@example.com');
    expect(user?.role).toBe('admin');
  });
});
