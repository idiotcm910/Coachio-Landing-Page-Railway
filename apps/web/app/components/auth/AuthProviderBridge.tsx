'use client';

import React from 'react';
import { AuthProvider } from '@coachio/api-client';

export default function AuthProviderBridge({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider
      reloadOnLogin={false}
      onSessionExpired={() => window.location.assign('/admin/login')}
    >
      {children}
    </AuthProvider>
  );
}
