'use client';

import { AdminDashboardShell } from '../../components/admin-dashboard/AdminDashboardShell';

// Renders the System Admin dashboard with the revenue menu pre-selected.
export default function AdminRevenuePage() {
  return <AdminDashboardShell initialMenuId="revenue" />;
}
