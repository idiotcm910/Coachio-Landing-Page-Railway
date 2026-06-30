'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { authApi } from './auth-api';
import { AuthContext } from './useAuth';
import type { User } from '../types/user';
import { getAccessToken } from '../storage';

export interface AuthProviderProps {
  children: React.ReactNode;
  onSessionExpired?: () => void;
  reloadOnLogin?: boolean;
}

export function AuthProvider({
  children,
  onSessionExpired,
  reloadOnLogin = true,
}: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    function handleSessionExpired() {
      setUser(null);
      onSessionExpired?.();
    }

    window.addEventListener('coachio:session-expired', handleSessionExpired);
    return () => {
      window.removeEventListener('coachio:session-expired', handleSessionExpired);
    };
  }, [onSessionExpired]);

  useEffect(() => {
    let isMounted = true;

    async function initSession() {
      try {
        const token = getAccessToken();
        if (!token) return;

        const currentUser = await authApi.me();
        if (isMounted) {
          setUser(currentUser);
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    initSession();

    return () => {
      isMounted = false;
    };
  }, []);

  const value = useMemo(() => ({
    user,
    isAuthenticated: Boolean(user),
    isLoading,

    async login(email: string, pass: string) {
      const response = await authApi.login(email, pass);

      if (!response.data) {
        throw new Error(response?.error || 'Login failed');
      }

      const currentUser = await authApi.me();
      setUser(currentUser);

      if (reloadOnLogin) {
        window.location.reload();
      }
    },

    logout() {
      authApi.logout();
      setUser(null);
    },
  }), [isLoading, reloadOnLogin, user]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
