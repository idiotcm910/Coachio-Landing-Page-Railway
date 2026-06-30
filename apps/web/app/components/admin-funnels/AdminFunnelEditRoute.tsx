'use client';

import { useEffect, useState } from 'react';
import { adminFunnelsApi, getApiErrorMessage, type Funnel } from '@coachio/api-client';
import { AdminFunnelEditShell } from './AdminFunnelEditShell';
import type { FunnelWorkspace } from './AdminFunnelWorkspaceSidebar';

interface AdminFunnelEditRouteProps {
  funnelId: string;
  workspace: FunnelWorkspace;
}

export function AdminFunnelEditRoute({ funnelId, workspace }: AdminFunnelEditRouteProps) {
  const [funnel, setFunnel] = useState<Funnel | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    adminFunnelsApi
      .get(funnelId)
      .then((data) => setFunnel(data))
      .catch((caught) => setError(getApiErrorMessage(caught, 'Failed to load funnel')));
  }, [funnelId]);

  if (error) {
    return <main className="min-h-screen bg-[#f8f8f8] p-10 font-bold text-red-600">{error}</main>;
  }

  if (!funnel) {
    return <main className="min-h-screen bg-[#f8f8f8] p-10 text-slate-900">Loading...</main>;
  }

  return <AdminFunnelEditShell initialFunnel={funnel} workspace={workspace} />;
}
