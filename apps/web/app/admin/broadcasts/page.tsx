'use client';

import { AdminDashboardShell } from '../../components/admin-dashboard/AdminDashboardShell';

// Renders the System Admin dashboard with the broadcasts menu pre-selected.
export default function AdminBroadcastsPage() {
  return <AdminDashboardShell initialMenuId="broadcasts" />;
}
