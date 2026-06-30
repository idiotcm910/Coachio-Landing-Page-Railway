import { apiClient } from '../http/api-client';
import type { ApiResponse } from '../http/types';
import {
  clearAuthTokens,
  getAccessToken,
  setAuthTokens,
} from '../storage';
import { UserRole, type User } from '../types/user';

interface BackendUser {
  id: string;
  email: string;
  username?: string;
  full_name?: string;
  role?: UserRole;
  phone?: string;
  avatar_url?: string;
  traffic_source?: string | null;
  created_at?: string;
  is_active?: boolean;
  credits?: number;
  can_access_api?: boolean;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
}

export function mapBackendUser(userData: BackendUser): User {
  return {
    id: userData.id,
    email: userData.email,
    full_name: userData.full_name || userData.username || userData.email?.split('@')[0] || '',
    role: userData.role || UserRole.NORMAL_USER,
    phone: userData.phone || '',
    avatar_url: userData.avatar_url || `https://i.pravatar.cc/150?u=${userData.id}`,
    traffic_source: userData.traffic_source || null,
    created_at: userData.created_at,
    purchasedProductIds: [],
    status: userData.is_active,
    credits: userData.credits || 0,
    can_access_api: userData.can_access_api,
  };
}

export const authApi = {
  /** Admin-only login — POSTs to /api/v1/admin/auth/login */
  async login(email: string, password: string): Promise<ApiResponse<LoginResponse>> {
    const response = await apiClient.post<ApiResponse<LoginResponse>>(
      '/api/v1/admin/auth/login',
      { email, password },
      { isPublic: true },
    );

    if (response.data) {
      setAuthTokens(response.data.access_token, response.data.token_type);
    }

    return response;
  },

  async me(): Promise<User | null> {
    const token = getAccessToken();
    if (!token) return null;

    const response = await apiClient.get<ApiResponse<BackendUser>>('/api/v1/auth/me');

    if (!response.data && response.statusCode === 401) {
      clearAuthTokens();
      return null;
    }

    return response.data ? mapBackendUser(response.data) : null;
  },

  logout(): void {
    clearAuthTokens();
  },
};
