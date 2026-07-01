'use client';

import { AdminDashboardShell } from '../../components/admin-dashboard/AdminDashboardShell';

// Renders the System Admin dashboard with the Homepage menu pre-selected.
export default function AdminHomepagePage() {
  return <AdminDashboardShell initialMenuId="homepage" />;
}
